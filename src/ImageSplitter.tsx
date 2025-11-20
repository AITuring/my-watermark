import React, { useState, useRef, ChangeEvent } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

  // 比例配置
  const [aspectW, setAspectW] = useState<number>(1);
  const [aspectH, setAspectH] = useState<number>(1);

  // 新增：重叠率配置 (0-100 整数)

  const [generatedImages, setGeneratedImages] = useState<SplitImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // --- 2. 执行带重叠的裁剪逻辑 ---
  const handleSplit = async () => {
    if (!sourceImage || !canvasRef.current) return;

    setIsProcessing(true);
    setGeneratedImages([]);

    const { naturalWidth, naturalHeight } = sourceImage;

    // 1. 计算单张切片的标准宽度 (基于高度和比例)
    let splitWidth = Math.floor(naturalHeight * (aspectW / aspectH));
    if (splitWidth > naturalWidth) {
      splitWidth = naturalWidth;
    }

    // 2. 自动计算步进与张数，至少 10% 重叠，并强制覆盖到最右侧
    let numSlices: number;
    let step: number;
    if (splitWidth === naturalWidth) {
      numSlices = 1;
      step = 0;
    } else {
      const minOverlapRate = 0.1;
      const maxStep = Math.floor(splitWidth * (1 - minOverlapRate));
      numSlices = Math.ceil((naturalWidth - splitWidth) / Math.max(1, maxStep)) + 1;
      step = (naturalWidth - splitWidth) / (numSlices - 1);
    }

    // 自动步进有效性判断
    if (splitWidth <= 0 || numSlices < 1) {
      alert("图片过窄，无法生成切片");
      setIsProcessing(false);
      return;
    }

    const newImages: SplitImage[] = [];

    try {
      for (let i = 0; i < numSlices; i++) {
        const startX = i === numSlices - 1 ? naturalWidth - splitWidth : Math.round(i * step);

        const canvas = canvasRef.current;
        canvas.width = splitWidth;
        canvas.height = naturalHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(
            sourceImage,
            startX, 0, splitWidth, naturalHeight,
            0, 0, splitWidth, naturalHeight
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

  // --- Styles ---
  const styles = {
    container: { padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif' },
    controlPanel: { display: 'flex', flexWrap: 'wrap' as const, gap: '20px', marginBottom: '20px', alignItems: 'flex-end', padding: '20px', background: '#f8f9fa', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    inputGroup: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
    label: { fontSize: '14px', fontWeight: 600, color: '#333' },
    input: { padding: '8px', borderRadius: '4px', border: '1px solid #ddd' },
    button: { padding: '10px 24px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' },
    disabledBtn: { background: '#cbd5e0', cursor: 'not-allowed' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px', marginTop: '20px' },
    card: { border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    cardImg: { width: '100%', height: 'auto', display: 'block', borderBottom: '1px solid #f0f0f0' },
    cardMeta: { padding: '8px', fontSize: '12px', color: '#666', textAlign: 'center' as const }
  };

  return (
    <div style={styles.container}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>长图智能切片 (自动重叠，强制贴右)</h2>

      {/* 控制面板 */}
      <div style={styles.controlPanel}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>1. 上传长图</label>
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: '14px' }} />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>2. 切片比例 (宽 : 高)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number" value={aspectW} min="1"
              onChange={(e) => setAspectW(Number(e.target.value))}
              style={{ ...styles.input, width: '60px' }}
            />
            <span style={{ fontWeight: 'bold' }}>:</span>
            <input
              type="number" value={aspectH} min="1"
              onChange={(e) => setAspectH(Number(e.target.value))}
              style={{ ...styles.input, width: '60px' }}
            />
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>3. 重叠区域</label>
          <span style={{ fontSize: '12px', color: '#666' }}>自动计算，至少 10%</span>
        </div>

        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
           <button
            style={{ ...styles.button, ...( (!sourceImage || isProcessing) ? styles.disabledBtn : {}) }}
            onClick={handleSplit}
            disabled={!sourceImage || isProcessing}
          >
            {isProcessing ? '生成中...' : '开始生成切片'}
          </button>
        </div>
      </div>

      {/* 隐藏 Canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 结果展示区域 */}
      {generatedImages.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', background: '#e6fffa', borderRadius: '8px', border: '1px solid #b2f5ea' }}>
            <span style={{ color: '#2c7a7b', fontWeight: 600 }}>
              ✓ 成功生成 {generatedImages.length} 张切片
            </span>
            <button
              style={{...styles.button, background: '#38b2ac'}}
              onClick={handleExport}
            >
              下载全部 (.zip)
            </button>
          </div>

          <div style={styles.grid}>
            {generatedImages.map((img, i) => (
              <div key={img.id} style={styles.card}>
                {/* 图片容器 */}
                <div style={{ position: 'relative' }}>
                   <img src={img.url} alt={img.fileName} style={styles.cardImg} />
                   <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px', padding: '2px 6px' }}>
                     {i + 1}
                   </div>
                </div>
                <div style={styles.cardMeta}>
                  {img.fileName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 原图预览 (放在最底部) */}
      {previewUrl && !generatedImages.length && (
        <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
           <label style={styles.label}>原图预览：</label>
           <div style={{ marginTop: '10px', overflowX: 'auto', border: '2px dashed #eee', borderRadius: '8px', padding: '10px' }}>
            <img src={previewUrl} alt="Original" style={{ maxHeight: '150px' }} />
           </div>
        </div>
      )}
    </div>
  );
};

export default ImageSplitter;
