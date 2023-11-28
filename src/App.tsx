import React, { useState } from 'react';
import { Progress } from 'antd';
import ImageUploader from './ImageUploader';
import WatermarkEditor from './WatermarkEditor';
import './App.css';
// const worker = new Worker(new URL('./imageProcessorWorker.ts', import.meta.url));

// worker.onmessage = function(e: MessageEvent<ProcessedImageData>) {
//   const { file, blob } = e.data;
//   const url = URL.createObjectURL(blob);

//   const downloadLink = document.createElement('a');
//   downloadLink.href = url;
//   downloadLink.download = file.name;
//   document.body.appendChild(downloadLink);
//   downloadLink.click();
//   document.body.removeChild(downloadLink);
//   URL.revokeObjectURL(url);
// };

// worker.onerror = function(e: ErrorEvent) {
//   console.error('Worker Error:', e.message);
// };

const App: React.FC = () => {
  const [images, setImages] = useState<File[]>([]);
  const [watermarkUrl, setWatermarkUrl] = useState('');
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
  const [imgProcess, setImgProcess] = useState<number>(0);

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

  async function processImage(file, watermarkImage, position) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const image = new Image();
        image.onload = () => {
          // 创建一个canvas元素
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = image.width;
          canvas.height = image.height;

          // 绘制原始图片
          ctx.drawImage(image, 0, 0, image.width, image.height);

          // 应用水印位置和变换
          const watermarkX = position.x * image.width;
          const watermarkY = position.y * image.height;
          const watermarkWidth = watermarkImage.width * position.scaleX;
          const watermarkHeight = watermarkImage.height * position.scaleY;
          console.log(watermarkX, watermarkY, watermarkWidth, watermarkHeight)
          ctx.drawImage(
            watermarkImage,
            watermarkX,
            watermarkY,
            watermarkWidth,
            watermarkHeight,
          );

          // ctx.restore();

          // 将canvas内容转换为DataURL
          const dataURL = canvas.toDataURL('image/png');

          // 创建下载链接并触发下载
          const downloadLink = document.createElement('a');
          downloadLink.href = dataURL;
          downloadLink.download = file.name;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        };
        image.onerror = reject;
        image.src = e.target.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function downloadImagesWithWatermarkBatch(files, watermarkImage, position, batchSize = 5) {
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      // 放弃web worker，实在太麻烦了
      // batch.forEach((file) => {
      //   const reader = new FileReader();
      //   reader.onload = function(e: ProgressEvent<FileReader>) {
      //     if (!e.target?.result) return;

      //     const imageData: WatermarkData = {
      //       imageSrc: e.target.result as string,
      //       file: file,
      //       watermarkDataURL: watermarkImage.src,
      //       position: position
      //     };

      //     worker.postMessage(imageData);
      //   };
      //   reader.readAsDataURL(file);
      // });

      const promises = batch.map((file, index) => processImage(file, watermarkImage, position));
      const dataURLs = await Promise.all(promises);

      dataURLs.forEach((dataURL, index) => {
        const downloadLink = document.createElement('a');
        downloadLink.href = dataURL;
        downloadLink.download = `watermarked-${i + index}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      });

      // 等待一会儿，让浏览器有时间回收内存
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }


  const handleApplyWatermark = () => {
    if (!watermarkUrl) {
      setError('Please upload a watermark image.');
      return;
    }
    setLoading(true);
    setError(null);
    const watermarkImage = new Image();
    watermarkImage.onload = () => {
      let count: number = 0;
      downloadImagesWithWatermarkBatch(images, watermarkImage, watermarkPosition);
      // applyWatermark(
      //   images,
      //   watermarkImage,
      //   watermarkPosition,
      //   (blob, index, total) => {
      //     count += 1;
      //     console.log('dowloading', count);
      //     // Update the progress bar
      //     const newProgress = (count / total) * 100;
      //     setImgProcess(newProgress);
      //     // Handle the blob here for preview or download
      //     if (index === total - 1) {
      //       setLoading(false);
      //     }
      //     console.log(`Processed ${index + 1} of ${total} images.`);
      //     saveAs(blob, `watermarked_image_${index}.png`);
      //     console.log(`Download watermarked_image_${index}.png`);
      //   },
      //   (error) => {
      //     setError(error);
      //     setLoading(false);
      //   },
      // );
    };

    watermarkImage.onerror = () => {
      setError('Failed to load the watermark image.');
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
    <div className='App'>
      {
        images.length === 0 && (
          <ImageUploader onUpload={handleImagesUpload} fileType="背景" />
        )
      }
      {images.length > 0 && (
        <div className='img-gallery'>
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
        <Progress percent={imgProcess} />
      </div>
    </div>
  );
};

export default App;
