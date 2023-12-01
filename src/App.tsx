import React, { useState } from "react";
import { Progress, message } from "antd";
import ImageUploader from "./ImageUploader";
import WatermarkEditor from "./WatermarkEditor";
import "./App.css";

const App: React.FC = () => {
  const [images, setImages] = useState<File[]>([]);
  const [watermarkUrl, setWatermarkUrl] = useState("");
  // 支持定制每一个水印
  const [watermarkPosition, setWatermarkPosition] = useState({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 图片处理进度
  const [imgProgress, setImgProgress] = useState<number>(0);

  const handleImagesUpload = (files: File[]) => {
    setImages(files);
    if (files[0]) {
      // Update the original image dimensions when a new image is uploaded
      const image = new Image();
      image.onload = () => {
        setWatermarkPosition((prevPos) => ({
          ...prevPos,
        }));
      };
      image.src = URL.createObjectURL(files[0]);
    }
  };

  const handleWatermarkUpload = (files: File[]) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setWatermarkUrl(event.target!.result as string);
    };
    reader.readAsDataURL(files[0]);
  };

  const handleWatermarkTransform = (position: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  }) => {
    setWatermarkPosition(position);
  };

  // 使用canvas.toBlob提高性能
  async function canvasToBlob(
    canvas: HTMLCanvasElement,
    fileType: string,
    quality: number = 1,
  ) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas to Blob conversion failed"));
          }
        },
        fileType,
        quality,
      );
    });
  }

  async function processImage(file, watermarkImage, position) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const image = new Image();
        image.onload = async () => {
          // 创建一个canvas元素
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = image.width;
          canvas.height = image.height;

          // 绘制原始图片
          ctx.drawImage(image, 0, 0, image.width, image.height);

          // 应用水印位置和变换
          const watermarkX = position.x * image.width;
          const watermarkY = position.y * image.height;
          const watermarkWidth = watermarkImage.width * position.scaleX;
          const watermarkHeight = watermarkImage.height * position.scaleY;
          console.log(watermarkX, watermarkY, watermarkWidth, watermarkHeight);
          ctx.drawImage(
            watermarkImage,
            watermarkX,
            watermarkY,
            watermarkWidth,
            watermarkHeight,
          );

          // ctx.restore();
          try {
            const blob = await canvasToBlob(canvas, "image/png");
            const url = URL.createObjectURL(blob as Blob);
            resolve({ url, name: file.name });
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = reject;
        image.src = e.target.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function downloadImagesWithWatermarkBatch(
    files,
    watermarkImage,
    position,
    batchSize = 5,
  ) {
    const downloadLink = document.createElement("a");
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const promises = batch.map((file) =>
        processImage(file, watermarkImage, position),
      );
      const imageBlobs = await Promise.all(promises);

      imageBlobs.forEach(({ url, name }, index) => {
        message.success(`第${index}张图下载完成！`);
        downloadLink.href = url;
        downloadLink.download = `watermarked-${i + index}.png`;
        downloadLink.click();
        URL.revokeObjectURL(url);
      });
      const progress = ((i + batchSize) / files.length) * 100;
      setImgProgress(Math.min(progress, 100));

      // 等待一会儿，让浏览器有时间回收内存
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    document.body.removeChild(downloadLink);
  }

  const handleApplyWatermark = () => {
    if (!watermarkUrl) {
      setError("Please upload a watermark image.");
      return;
    }
    setLoading(true);
    setError(null);
    const watermarkImage = new Image();
    watermarkImage.onload = () => {
      message.success("水印下载开始！");
      const count: number = 0;
      downloadImagesWithWatermarkBatch(
        images,
        watermarkImage,
        watermarkPosition,
      );
    };

    watermarkImage.onerror = () => {
      message.error("Failed to load the watermark image.");
      setError("Failed to load the watermark image.");
      setLoading(false);
    };
    watermarkImage.src = watermarkUrl;
  };

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 使用 debounce 包裹你的事件处理函数
  const handleApplyWatermarkDebounced = debounce(handleApplyWatermark, 500);

  return (
    <div className="App">
      {images.length === 0 && (
        <ImageUploader onUpload={handleImagesUpload} fileType="背景" />
      )}
      {images.length > 0 && (
        <div className="img-gallery">
          {images.map((image, index) => (
            <img
              key={index}
              src={URL.createObjectURL(image)}
              alt="bg"
              className="bg-img"
            />
          ))}
        </div>
      )}
      <ImageUploader onUpload={handleWatermarkUpload} fileType="水印" />
      {loading && <p className="loading">Processing images...</p>}
      {error && <p className="error">{error}</p>}
      {watermarkUrl && (
        <WatermarkEditor
          watermarkUrl={watermarkUrl}
          backgroundImageFile={images[0]}
          onTransform={handleWatermarkTransform}
        />
      )}
      <button onClick={handleApplyWatermarkDebounced} className="button">
        Apply Watermark
      </button>
      <div className="progress">
        <h4>图片处理进度</h4>
        <Progress percent={imgProgress} />
      </div>
    </div>
  );
};

export default App;
