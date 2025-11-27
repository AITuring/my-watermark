import React, { useState, useRef, ChangeEvent } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface SplitImage {
  id: number;
  url: string;
  blob: Blob;
  fileName: string;
}

const ImageSplitter: React.FC = () => {
  // --- State Management ---
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 网格比例配置
  const [aspectW, setAspectW] = useState<number>(1);
  const [aspectH, setAspectH] = useState<number>(1);

  // 水平/竖直配置
  const [hvMode, setHvMode] = useState<'ratio' | 'count'>('ratio');
  const [hvRatioW, setHvRatioW] = useState<number>(1);
  const [hvRatioH, setHvRatioH] = useState<number>(1);
  const [hvCount, setHvCount] = useState<number>(1);

  // 重叠率 (0-100)
  const [overlapPercent, setOverlapPercent] = useState<number>(10);

  const [generatedImages, setGeneratedImages] = useState<SplitImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- 1. 处理图片上传 ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new Image();
      img.src = url;
      img.onload = () => {
        setSourceImage(img);
        setGeneratedImages([]);
      };
    }
  };

  // --- 2. 水平/竖直切割（可选比例或数量，支持重叠） ---
  const handleAxisSplit = async (orientation: 'vertical' | 'horizontal') => {
    if (!sourceImage || !canvasRef.current) return;

    setIsProcessing(true);
    setGeneratedImages([]);

    const { naturalWidth, naturalHeight } = sourceImage;

    const ov = Math.min(Math.max(overlapPercent, 0), 90) / 100;

    const axisSize = orientation === 'vertical' ? naturalWidth : naturalHeight;
    const fixedOtherSize = orientation === 'vertical' ? naturalHeight : naturalWidth;

    let tileSize: number;
    let numSlices: number;
    let step: number;

    if (hvMode === 'ratio') {
      tileSize = orientation === 'vertical'
        ? Math.floor(fixedOtherSize * (hvRatioW / hvRatioH))
        : Math.floor(fixedOtherSize * (hvRatioH / hvRatioW));
      if (tileSize > axisSize) tileSize = axisSize;
      if (tileSize <= 0) {
        alert('切片尺寸过小');
        setIsProcessing(false);
        return;
      }
      if (tileSize === axisSize) {
        numSlices = 1;
        step = 0;
      } else {
        const maxStep = Math.floor(tileSize * (1 - ov));
        numSlices = Math.ceil((axisSize - tileSize) / Math.max(1, maxStep)) + 1;
        step = (axisSize - tileSize) / (numSlices - 1);
      }
    } else {
      numSlices = Math.max(1, Math.floor(hvCount));
      if (numSlices === 1) {
        tileSize = axisSize;
        step = 0;
      } else {
        const denom = (numSlices - 1) * (1 - ov) + 1;
        tileSize = axisSize / denom;
        step = tileSize * (1 - ov);
      }
    }

    const newImages: SplitImage[] = [];

    try {
      for (let i = 0; i < numSlices; i++) {
        const startPos = i === numSlices - 1 ? axisSize - tileSize : i * step;
        const start = Math.max(0, Math.round(startPos));
        const sliceSize = i === numSlices - 1 ? axisSize - start : Math.round(tileSize);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (orientation === 'vertical') {
          canvas.width = sliceSize;
          canvas.height = fixedOtherSize;
          if (ctx) {
            ctx.drawImage(
              sourceImage,
              start, 0, sliceSize, fixedOtherSize,
              0, 0, sliceSize, fixedOtherSize
            );
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/jpeg', 0.95)
            );
            if (blob) {
              const url = URL.createObjectURL(blob);
              const fileName = `split_${String(i + 1).padStart(3, '0')}.jpg`;
              newImages.push({ id: i, url, blob, fileName });
            }
          }
        } else {
          canvas.width = fixedOtherSize;
          canvas.height = sliceSize;
          if (ctx) {
            ctx.drawImage(
              sourceImage,
              0, start, fixedOtherSize, sliceSize,
              0, 0, fixedOtherSize, sliceSize
            );
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/jpeg', 0.95)
            );
            if (blob) {
              const url = URL.createObjectURL(blob);
              const fileName = `split_${String(i + 1).padStart(3, '0')}.jpg`;
              newImages.push({ id: i, url, blob, fileName });
            }
          }
        }
      }

      setGeneratedImages(newImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert('处理图片时出错');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerticalSplit = async () => handleAxisSplit('vertical');
  const handleHorizontalSplit = async () => handleAxisSplit('horizontal');

  const handleGridSplit = async () => {
    if (!sourceImage || !canvasRef.current) return;
    setIsProcessing(true);
    setGeneratedImages([]);
    const { naturalWidth, naturalHeight } = sourceImage;
    const cols = Math.max(1, Math.floor(aspectW));
    const rows = Math.max(1, Math.floor(aspectH));
    const baseTileWidth = Math.floor(naturalWidth / cols);
    const baseTileHeight = Math.floor(naturalHeight / rows);
    const newImages: SplitImage[] = [];
    try {
      let index = 0;
      for (let r = 0; r < rows; r++) {
        const startY = r * baseTileHeight;
        const tileHeight = r === rows - 1 ? naturalHeight - startY : baseTileHeight;
        for (let c = 0; c < cols; c++) {
          const startX = c * baseTileWidth;
          const tileWidth = c === cols - 1 ? naturalWidth - startX : baseTileWidth;
          const canvas = canvasRef.current;
          canvas.width = tileWidth;
          canvas.height = tileHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(sourceImage, startX, startY, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            if (blob) {
              const url = URL.createObjectURL(blob);
              index += 1;
              const fileName = `split_${String(index).padStart(3, '0')}.jpg`;
              newImages.push({ id: index - 1, url, blob, fileName });
            }
          }
        }
      }
      setGeneratedImages(newImages);
    } catch (error) {
      console.error("Error processing images:", error);
      alert("处理图片时出错");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. 导出 Zip ---
  const handleExport = async () => {
    if (generatedImages.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("split_images");
    generatedImages.forEach((img) => {
      if (folder) folder.file(img.fileName, img.blob);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "split_images.zip");
  };

  const styles = {};

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">长图智能切片</h2>
        <p className="text-sm text-slate-500 mt-1">水平/竖直切割（重叠可选）与按比例网格切分</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>切片设置</CardTitle>
          <CardDescription>上传图片后选择切割方式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">1. 上传长图</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">2. 水平/竖直切割</label>
              <div className="flex items-center gap-3">
                <Select value={hvMode} onValueChange={(v) => setHvMode(v as 'ratio' | 'count')}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="选择模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ratio">按比例</SelectItem>
                    <SelectItem value="count">按数量</SelectItem>
                  </SelectContent>
                </Select>
                {hvMode === 'ratio' ? (
                  <>
                    <input type="number" value={hvRatioW} min={1} onChange={(e) => setHvRatioW(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                    <span className="font-bold">:</span>
                    <input type="number" value={hvRatioH} min={1} onChange={(e) => setHvRatioH(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                  </>
                ) : (
                  <input type="number" value={hvCount} min={1} onChange={(e) => setHvCount(Number(e.target.value))} className="w-24 h-9 rounded-md border border-input px-3 text-sm" />
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">重叠比例 (%)</span>
                <input type="number" value={overlapPercent} min={0} max={90} onChange={(e) => setOverlapPercent(Number(e.target.value))} className="w-24 h-9 rounded-md border border-input px-3 text-sm" />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleVerticalSplit} disabled={!sourceImage || isProcessing} className="h-9">
                  {isProcessing ? '生成中...' : '竖直切割'}
                </Button>
                <Button onClick={handleHorizontalSplit} disabled={!sourceImage || isProcessing} variant="outline" className="h-9">
                  {isProcessing ? '生成中...' : '水平切割'}
                </Button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">3. 按比例网格 (列 : 行)</label>
              <div className="flex items-center gap-3">
                <input type="number" value={aspectW} min={1} onChange={(e) => setAspectW(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                <span className="font-bold">:</span>
                <input type="number" value={aspectH} min={1} onChange={(e) => setAspectH(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                <span className="text-xs text-slate-500">切片之间不重叠</span>
                <Button onClick={handleGridSplit} disabled={!sourceImage || isProcessing} className="ml-auto h-9">
                  {isProcessing ? '生成中...' : '按比例网格切割'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 隐藏 Canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {generatedImages.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">成功生成 {generatedImages.length} 张切片</CardTitle>
            <Button onClick={handleExport} variant="outline">下载全部 (.zip)</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {generatedImages.map((img, i) => (
                <div
                  key={img.id}
                  className="rounded-lg border bg-white shadow-sm overflow-hidden cursor-pointer hover:bg-slate-50 transition"
                  onClick={() => { setPreviewIndex(i); setIsPreviewOpen(true); }}
                >
                  <div className="relative">
                    <img src={img.url} alt={img.fileName} className="w-full h-auto block" />
                    <div className="absolute bottom-0 right-0 bg-black/50 text-white text-xs px-2 py-1">{i + 1}</div>
                  </div>
                  <div className="px-3 py-2 text-xs text-slate-600 text-center">{img.fileName}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {previewUrl && !generatedImages.length && (
        <Card>
          <CardHeader>
            <CardTitle>原图预览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border-2 border-dashed border-slate-200 rounded-lg p-3">
              <img src={previewUrl} alt="Original" className="max-h-40" />
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>生成图预览</DialogTitle>
            <DialogDescription>{previewIndex !== null ? generatedImages[previewIndex]?.fileName : ''}</DialogDescription>
          </DialogHeader>
          {previewIndex !== null && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border">
                <img src={generatedImages[previewIndex].url} alt={generatedImages[previewIndex].fileName} className="max-h-[70vh] w-auto mx-auto" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPreviewIndex((idx) => (idx !== null ? Math.max(0, idx - 1) : null))} disabled={(previewIndex ?? 0) <= 0}>上一张</Button>
                  <Button variant="outline" onClick={() => setPreviewIndex((idx) => (idx !== null ? Math.min(generatedImages.length - 1, idx + 1) : null))} disabled={(previewIndex ?? 0) >= generatedImages.length - 1}>下一张</Button>
                </div>
                <Button onClick={() => previewIndex !== null && saveAs(generatedImages[previewIndex].blob, generatedImages[previewIndex].fileName)}>下载此图</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageSplitter;
