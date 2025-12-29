import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Icon } from "@iconify/react";
import ThreeLanding from "@/components/ThreeLanding";

type ImgItem = {
  id: string;
  blob: Blob;
  bitmap?: CanvasImageSource;
  width?: number;
  height?: number;
};

type ShapeType = "circle" | "heart" | "text";
type TileShape = "square" | "circle";
type FillOrder = "sequential" | "random";

function drawMask(maskCanvas: HTMLCanvasElement, shape: ShapeType, text: string) {
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const ctx = maskCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  if (shape === "circle") {
    const r = Math.min(w, h) * 0.45;
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  } else if (shape === "heart") {
    const r = Math.min(w, h) * 0.35;
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.4);
    ctx.bezierCurveTo(cx + r, cy - r * 1.2, cx + r * 1.2, cy + r * 0.5, cx, cy + r);
    ctx.bezierCurveTo(cx - r * 1.2, cy + r * 0.5, cx - r, cy - r * 1.2, cx, cy - r * 0.4);
    ctx.closePath();
    ctx.fill();
  } else {
    const max = Math.min(w, h) * 0.8;
    let fontSize = max;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    while (fontSize > 10) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000";
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
      const metrics = ctx.measureText(text || "文字");
      const textWidth = metrics.width;
      const textHeight = fontSize;
      if (textWidth <= w * 0.9 && textHeight <= h * 0.9) break;
      fontSize -= 10;
    }
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.fillText(text || "文字", w / 2, h / 2);
  }
}

function computePositions(maskCanvas: HTMLCanvasElement, tileSize: number, gap: number) {
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const ctx = maskCanvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, w, h).data;
  const positions: Array<{ x: number; y: number }> = [];
  const step = tileSize + gap;
  for (let y = step / 2; y < h; y += step) {
    const rowOffset = ((y / step) % 2) * ((tileSize + gap) / 2);
    for (let x = step / 2 + rowOffset; x < w; x += step) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const idx = (iy * w + ix) * 4 + 3;
      if (data[idx] > 10) positions.push({ x: ix - tileSize / 2, y: iy - tileSize / 2 });
    }
  }
  return positions;
}

function drawImageCover(ctx: CanvasRenderingContext2D, bitmap: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) {
  const anyBm: any = bitmap as any;
  const iw = anyBm.naturalWidth || anyBm.width;
  const ih = anyBm.naturalHeight || anyBm.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = Math.floor(dw / scale);
  const sh = Math.floor(dh / scale);
  const sx = Math.floor((iw - sw) / 2);
  const sy = Math.floor((ih - sh) / 2);
  ctx.drawImage(bitmap as any, sx, sy, sw, sh, dx, dy, dw, dh);
}

export default function CreativeMosaic() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<ImgItem[]>([]);
  const [isUpload, setIsUpload] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const [shape, setShape] = useState<ShapeType>("circle");
  const [textShape, setTextShape] = useState<string>("艺术");
  const [tileSize, setTileSize] = useState<number>(28);
  const [gap, setGap] = useState<number>(4);
  const [tileShape, setTileShape] = useState<TileShape>("circle");
  const [jitter, setJitter] = useState<number>(0.15);
  const [fillOrder, setFillOrder] = useState<FillOrder>("random");
  const [scale, setScale] = useState<number>(2);

  const [progress, setProgress] = useState<number>(0);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles?.length) return;
    setSpinning(true);
    try {
      const oversized = acceptedFiles.filter((f) => f.size > 200 * 1024 * 1024);
      if (oversized.length) {
        toast.error(`以下图片超过200MB: ${oversized.map((f) => f.name).join(", ")}`, { position: "top-center" });
      }
      const filtered = acceptedFiles.filter((f) => f.size <= 200 * 1024 * 1024);
      const compressionOptions = { maxSizeMB: 3, maxWidthOrHeight: 1280, useWebWorker: true };
      const results: ImgItem[] = [];
      for (const file of filtered) {
        const compressed = await imageCompression(file, compressionOptions);
        results.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, blob: compressed });
      }
      setFiles((prev) => [...prev, ...filtered]);
      setImages((prev) => [...prev, ...results]);
      setIsUpload(true);
    } catch (e: any) {
      toast.error(`图片处理失败: ${e?.message || e}`, { position: "top-center" });
    } finally {
      setSpinning(false);
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxSize: 200 * 1024 * 1024,
    onDropRejected: () => toast.error("图片大小不能超过200MB", { position: "top-center" }),
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      setCanvasSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (isUpload && (!canvasSize.w || !canvasSize.h)) {
      const c = containerRef.current;
      const w = c?.clientWidth || window.innerWidth;
      const h = c?.clientHeight || Math.floor(window.innerHeight * 0.6);
      setCanvasSize({ w, h });
    }
  }, [isUpload, canvasSize.w, canvasSize.h]);

  useEffect(() => {
    let cancelled = false;
    async function decode() {
      const pending = images.filter((img) => !img.bitmap);
      if (!pending.length) return;
      for (const item of pending) {
        try {
          if (typeof createImageBitmap === "function") {
            const bm = await createImageBitmap(item.blob);
            if (cancelled) return;
            item.bitmap = bm;
          } else {
            throw new Error("createImageBitmap not available");
          }
        } catch {
          const url = URL.createObjectURL(item.blob);
          const imgEl = document.createElement("img");
          await new Promise<void>((resolve) => {
            imgEl.onload = () => resolve();
            imgEl.onerror = () => resolve();
            imgEl.src = url;
          });
          URL.revokeObjectURL(url);
          if (cancelled) return;
          item.bitmap = imgEl as CanvasImageSource;
        }
      }
      setImages((prev) => [...prev]);
    }
    decode();
    return () => {
      cancelled = true;
    };
  }, [images]);

  const positions = useMemo(() => {
    if (!canvasSize.w || !canvasSize.h) return [];
    const mask = maskRef.current || document.createElement("canvas");
    mask.width = Math.max(1, Math.floor(canvasSize.w * scale));
    mask.height = Math.max(1, Math.floor(canvasSize.h * scale));
    maskRef.current = mask;
    drawMask(mask, shape, textShape);
    return computePositions(mask, Math.floor(tileSize * scale), Math.floor(gap * scale));
  }, [canvasSize.w, canvasSize.h, shape, textShape, tileSize, gap, scale]);

  const build = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !positions.length || !images.length) return;
    canvas.width = Math.max(1, Math.floor(canvasSize.w * scale));
    canvas.height = Math.max(1, Math.floor(canvasSize.h * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const list = images.filter((i) => i.bitmap) as ImgItem[];
    if (!list.length) return;
    const total = positions.length;
    setProgress(0);
    const batch = 600;
    let drawn = 0;
    for (let i = 0; i < total; i++) {
      const pos = positions[i];
      const rndx = (Math.random() - 0.5) * jitter * tileSize * scale;
      const rndy = (Math.random() - 0.5) * jitter * tileSize * scale;
      const dx = Math.floor(pos.x + rndx);
      const dy = Math.floor(pos.y + rndy);
      const idx = fillOrder === "random" ? Math.floor(Math.random() * list.length) : i % list.length;
      const bm = list[idx].bitmap!;
      if (tileShape === "circle") {
        ctx.save();
        ctx.beginPath();
        ctx.arc(dx + (tileSize * scale) / 2, dy + (tileSize * scale) / 2, (tileSize * scale) / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        drawImageCover(ctx, bm, dx, dy, Math.floor(tileSize * scale), Math.floor(tileSize * scale));
        ctx.restore();
      } else {
        drawImageCover(ctx, bm, dx, dy, Math.floor(tileSize * scale), Math.floor(tileSize * scale));
      }
      drawn++;
      if (drawn % batch === 0) {
        setProgress(Math.floor((drawn / total) * 100));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    }
    setProgress(100);
  }, [canvasSize.w, canvasSize.h, positions, images, tileShape, jitter, tileSize, scale, fillOrder]);

  useEffect(() => {
    build();
  }, [build]);

  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images.length) {
      toast.error("请选择并生成拼图后再导出", { position: "top-center" });
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "creative-mosaic.jpg";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    }, "image/jpeg", 0.92);
  }, [images]);

  return (
    <div className="h-[calc(100vh-56px)]">
      {spinning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center">
            <Icon icon="line-md:speedometer-loop" className="text-white mt-2" />
            <p className="mt-2 text-white">正在处理...</p>
          </div>
        </div>
      )}
      {isUpload ? (
        <div className="w-full h-full flex flex-col">
          <Card className="mx-auto max-w-5xl sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border rounded-lg">
            <CardHeader className="py-1 px-2 sm:py-2 sm:px-3">
              <CardTitle className="flex items-center gap-1 text-xs sm:text-sm">
                <Icon icon="tabler:settings" className="w-3 h-3 sm:w-4 sm:h-4" />
                创意拼图
                <Badge variant="outline" className="ml-auto text-[10px] sm:text-xs">{images.length} 张</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1 px-2 sm:py-2 sm:px-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <div>形状:</div>
                  <Select value={shape} onValueChange={(v) => setShape(v as ShapeType)}>
                    <SelectTrigger className="w-24 h-7 sm:h-8"><SelectValue placeholder="形状" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="circle">圆形</SelectItem>
                      <SelectItem value="heart">心形</SelectItem>
                      <SelectItem value="text">文本</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {shape === "text" && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <div>文本:</div>
                    <Input value={textShape} onChange={(e) => setTextShape(e.target.value)} className="h-8 w-32" />
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <div>颗粒尺寸:</div>
                  <Slider className="w-28" value={[tileSize]} min={12} max={64} step={2} onValueChange={(v) => setTileSize(v[0])} />
                  <input type="number" className="w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm" min={12} max={64} value={tileSize} onChange={(e) => setTileSize(Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <div>间距:</div>
                  <Slider className="w-28" value={[gap]} min={0} max={20} step={1} onValueChange={(v) => setGap(v[0])} />
                  <input type="number" className="w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm" min={0} max={20} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <div>图形类型:</div>
                  <Select value={tileShape} onValueChange={(v) => setTileShape(v as TileShape)}>
                    <SelectTrigger className="w-24 h-7 sm:h-8"><SelectValue placeholder="类型" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">方块</SelectItem>
                      <SelectItem value="circle">圆点</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <div>随机抖动:</div>
                  <Slider className="w-28" value={[jitter]} min={0} max={0.6} step={0.05} onValueChange={(v) => setJitter(Number(v[0]))} />
                  <input type="number" className="w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm" min={0} max={0.6} step={0.05} value={jitter} onChange={(e) => setJitter(Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <div>填充顺序:</div>
                  <Select value={fillOrder} onValueChange={(v) => setFillOrder(v as FillOrder)}>
                    <SelectTrigger className="w-24 h-7 sm:h-8"><SelectValue placeholder="顺序" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">顺序</SelectItem>
                      <SelectItem value="random">随机</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <div>输出规模:</div>
                  <Slider className="w-28" value={[scale]} min={1} max={4} step={1} onValueChange={(v) => setScale(v[0])} />
                  <input type="number" className="w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm" min={1} max={4} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
                </div>
              </div>
              <Separator className="my-2" />
              <div className="flex flex-wrap items-center gap-8 justify-center">
                <Button size="sm" onClick={build}>重新生成</Button>
                <Button size="sm" onClick={exportImage}>导出图片</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                >
                  继续添加
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setImages([]);
                    setFiles([]);
                    setIsUpload(false);
                    setProgress(0);
                  }}
                >
                  清空
                </Button>
              </div>
              <div className="mt-3">
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>
          <div style={{ display: "none" }}>
            <input {...getInputProps()} />
          </div>
          <div ref={containerRef} className="flex-1 overflow-auto p-6" style={{ minHeight: "60vh" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        </div>
      ) : (
        <div className="h-full">
          <ThreeLanding getRootProps={getRootProps} getInputProps={getInputProps} />
        </div>
      )}
    </div>
  );
}
