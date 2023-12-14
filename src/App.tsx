import React, { useState } from "react";
import { Progress, message } from "antd";
// import { SpeedInsights } from "@vercel/speed-insights/react"
import ImageUploader from "./ImageUploader";
import WatermarkEditor from "./WatermarkEditor";
import EmojiBg from "./EmojiBg";
import "./App.css";

interface ImageType {
  id: string;
  file: File;
  width: number;
  height: number;
}

function uuid() {
  let idStr = Date.now().toString(36);
  idStr += Math.random().toString(36).substr(2);
  return idStr;
}

const App: React.FC = () => {
  const [images, setImages] = useState<ImageType[]>([]);
  const [watermarkUrl, setWatermarkUrl] = useState("");
  // TODO支持定制每一个水印
  const [watermarkPosition, setWatermarkPosition] = useState({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  });

  const [loading, setLoading] = useState(false);
  // 图片处理进度
  const [imgProgress, setImgProgress] = useState<number>(0);
  // 第一步：上传图片
  const [imageUploaderVisible, setImageUploaderVisible] = useState(true);

  const loadImages = (files) => {
    const promises = files.map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          const img = new Image();
          img.onload = function () {
            resolve({
              id: uuid(),
              width: img.width,
              height: img.height,
              file: file,
            });
          };
          img.onerror = reject;
          img.src = e.target.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises)
      .then((images) => {
        setImages(images); // 现在这里更新状态
      })
      .catch((error) => {
        console.error("Error loading images: ", error);
      });
  };

  const handleImagesUpload = (files: File[]) => {
    loadImages(files);
    setImageUploaderVisible(false);

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
        message.success(`图${i + index + 1}下载成功！`);
        const progress = ((i + index + 1) / files.length) * 100;
        setImgProgress(Math.min(progress, 100));
        downloadLink.href = url;
        downloadLink.download = `watermarked-${i + index + 1}.png`;
        downloadLink.click();
        URL.revokeObjectURL(url);
      });

      // 等待一会儿，让浏览器有时间回收内存
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    document.body.removeChild(downloadLink);
    setLoading(false);
    setImgProgress(0);
  }

  const handleApplyWatermark = () => {
    if (!watermarkUrl) {
      return;
    }
    setLoading(true);
    const watermarkImage = new Image();
    watermarkImage.onload = () => {
      message.success("水印下载开始！");
      const imageFiles = images.map((image) => image.file);
      downloadImagesWithWatermarkBatch(
        imageFiles,
        watermarkImage,
        watermarkPosition,
      );
    };

    watermarkImage.onerror = () => {
      message.error("Failed to load the watermark image.");
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
      {/* <SpeedInsights /> */}
      {/* <EmojiBg direction="vertical" emojiSize={52} /> */}
      <img src="https://bing.img.run/rand_uhd.php" alt="bg" className="bg" />
      <div>
        {imageUploaderVisible ? (
          <div className="upbutton">
            <ImageUploader onUpload={handleImagesUpload} fileType="背景" />
          </div>
        ) : (
          <div className="watermark">
            <div className="image-part">
              {images.length > 0 && (
                <div className="img-gallery">
                  {images.map((image, index) => (
                    <img
                      key={index}
                      src={URL.createObjectURL(image.file)}
                      style={{
                        width: "16vw",
                        height: `${(image.height / image.width) * 16}vw`,
                      }}
                      alt="bg"
                      className="bg-img"
                    />
                  ))}
                </div>
              )}
              {watermarkUrl && (
                <WatermarkEditor
                  watermarkUrl={watermarkUrl}
                  backgroundImageFile={images[0].file}
                  onTransform={handleWatermarkTransform}
                />
              )}
            </div>
            <div className="markButtons">
              <ImageUploader onUpload={handleWatermarkUpload} fileType="水印" />
              {watermarkUrl && (
                <img
                  src={watermarkUrl}
                  alt="watermark"
                  style={{
                    width: "16vw",
                  }}
                />
              )}
              <button
                onClick={handleApplyWatermarkDebounced}
                className="button"
              >
                水印生成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
