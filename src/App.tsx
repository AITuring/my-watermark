import React, { useCallback,useState, useEffect, useRef, forwardRef, Ref } from 'react';
import { useDropzone } from 'react-dropzone';
import Konva from 'konva';
import { Progress } from 'antd';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import './App.css';

interface ImageWithFixedWidthProps {
  src: string;
  fixedWidth: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  draggable?: boolean;
  onClick?: () => void;
  onTap?: () => void;
  onDragEnd?: (e: any) => void; // 您可能需要根据实际情况替换 any 为更具体的类型
  onTransformEnd?: (e: any) => void; // 同上
  // 其他可能的属性...
}

const ImageWithFixedWidth = forwardRef<Konva.Image, ImageWithFixedWidthProps>(({
  src,
  fixedWidth,
  x,
  y,
  scaleX,
  scaleY,
  draggable,
  onClick,
  onTap,
  onDragEnd,
  onTransformEnd,
  ...otherProps
}: ImageWithFixedWidthProps, ref: Ref<Konva.Image>)  => {
  const [image] = useImage(src);
  const [size, setSize] = useState({ width: fixedWidth, height: 0 });

  useEffect(() => {
    if (image) {
      const height = (image.naturalHeight / image.naturalWidth) * fixedWidth;
      setSize({ width: fixedWidth, height });
    }
  }, [image, fixedWidth]);

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      scaleX={scaleX}
      scaleY={scaleY}
      draggable={draggable}
      ref={ref}
      onClick={onClick}
      onTap={onTap}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      {...otherProps}
      width={size.width}
      height={size.height}
    />
  );
});


const WatermarkEditor: React.FC<{
  watermarkUrl: string;
  backgroundImageFile: File | null;
  onTransform: (position: { x: number; y: number; scaleX: number; scaleY: number }) => void;
}> = ({ watermarkUrl, backgroundImageFile, onTransform }) => {
  const waterFixWidth = 100;
  const backgroundFixWidth = 800;

  const [watermarkImage] = useImage(watermarkUrl);
  const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(null);
  const [backgroundImage] = useImage(backgroundImageSrc || '');
  const [position, setPosition] = useState({ x: 20, y: 20, scaleX: 1, scaleY: 1 });
  // 背景图片大小
  const [backgroundImageSize, setBackgroundImageSize] = useState({ width: 0, height: 0 });
  // 水印图片大小
  const [watermarkImageSize, setWatermarkImageSize] = useState({ width: 0, height: 0 });

  const watermarkRef = useRef(null);
  const transformerRef = useRef(null);

   // 当背景图片文件改变时，更新 backgroundImageSrc 状态
  useEffect(() => {
    if (backgroundImageFile) {
      const src = URL.createObjectURL(backgroundImageFile);
      setBackgroundImageSrc(src);

      // 清理 URL 对象
      return () => URL.revokeObjectURL(src);
    }
  }, [backgroundImageFile]);

  useEffect(  () => {
    if (backgroundImage) {
      const height = (backgroundImage.naturalHeight / backgroundImage.naturalWidth) * backgroundFixWidth;
      const scale = backgroundFixWidth / backgroundImage.naturalWidth;
      setBackgroundImageSize({ width: backgroundFixWidth, height });
      if (watermarkImage) {
        setWatermarkImageSize({ width: watermarkImage.naturalWidth * scale, height: watermarkImage.naturalHeight * scale });
      }
      // setWatermarkImageSize({ width: watermarkImage.naturalWidth * scale, height: watermarkImage.naturalHeight * scale });
      // console.log(backgroundImage.naturalHeight, backgroundImage.naturalWidth, '背景大小', height, backgroundFixWidth, '比例', height / backgroundImage.naturalHeight)
    }

  }, [backgroundImage])

  // useEffect(() => {
  //   if (watermarkImage) {
  //     const height = (watermarkImage.naturalHeight / watermarkImage.naturalWidth) * waterFixWidth;
  //     setWatermarkImageSize({ width: waterFixWidth, height });
  //     console.log(watermarkImage.naturalHeight, watermarkImage.naturalWidth, '水印大小', height, waterFixWidth, '比例', height / watermarkImage.naturalHeight)
  //   }
  // }, [watermarkImage])

  const onWatermarkClick = () => {
    // set the transformer's nodes to the watermark image
    if (watermarkRef.current && transformerRef.current) {
      const selectedNodes = [watermarkRef.current];
      transformerRef.current.nodes(selectedNodes);
      transformerRef.current.getLayer().batchDraw();
    }
  };

  const handleDragEnd = (e: any) => {
    // console.log(e, 'end')
    const newPos = { ...position, x: e.target.x(), y: e.target.y(), scaleX: e.target.scaleX(), scaleY: e.target.scaleY(), rotation: e.target.rotation() };
    const newPosPercentage = {
      ...position,
      x: e.target.x() / backgroundImageSize.width,
      y: e.target.y() / backgroundImageSize.height,
      scaleX: e.target.scaleX(),
      scaleY: e.target.scaleY(),
      rotation: e.target.rotation()
    };
    // console.log(e.target.x(), e.target.x() / backgroundImageSize.width, '位置111')
    setPosition(newPos);
    onTransform(newPosPercentage);
  };

  const handleTransform = (e: any) => {
    const node = e.target;

    const newPos = {
      // 这里位置都是水印图片距背景左边和上边的百分比
      x: node.x(),
      y:node.y(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(), // Include rotation in the transformation if necessary
    };
    const newPosPercentage = {
      // 这里位置都是水印图片距背景左边和上边的百分比
      x: node.x() / backgroundImageSize.width,
      y:node.y() / backgroundImageSize.height,
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(), // Include rotation in the transformation if necessary
    };
    // console.log(node.x(), node.x() / backgroundImageSize.width)
    setPosition(newPos);
    onTransform(newPosPercentage);
  };

  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer>
      {backgroundImage && (
        <ImageWithFixedWidth src={backgroundImageSrc} fixedWidth={600} />
        )}
        {watermarkImage && (
          <>
          <ImageWithFixedWidth
            src={watermarkUrl}
            fixedWidth={watermarkImageSize.width}
            x={position.x}
            y={position.y}
            scaleX={position.scaleX}
            scaleY={position.scaleY}
            draggable
            ref={watermarkRef}
            // when clicking on the image, select it
            onClick={onWatermarkClick}
            onTap={onWatermarkClick}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransform}
          />
          <Transformer
              ref={transformerRef}
              // transformer configuration (optional)
              boundBoxFunc={(oldBox, newBox) => {
                // console.log(newBox, oldBox)
                // limit transformer's box size
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
                }
                return newBox;
              }}
            />
            </>
        )}
      </Layer>
    </Stage>
  );
};

const ImageUploader: React.FC<{ onUpload: (files: File[]) => void, fileType: string }> = ({ onUpload, fileType }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onUpload(acceptedFiles);
  }, [onUpload]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
    },
  });

  return (
    <div {...getRootProps()} className="dropzone">
      <input {...getInputProps()} />
      <p>选择（或拖拽）{fileType === '背景' ? '多' : '一'}张{fileType}图片</p>
    </div>
  );
};


function App() {
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
  const [positionArr, setPositionArr] = useState<Position[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 图片处理进度
  const [imgProcess, setImgProcess] = useState<number>(0);

  const handleImagesUpload = (files: File[]) => {
    setImages(files);
    // 初始化水印位置数组
    setPositionArr([
      ...new Array(files.length).fill({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      })
    ])
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
    // console.log(position)
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
          // console.log(watermarkX, watermarkY, watermarkWidth, watermarkHeight)
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

  function downloadImagesWithWatermark(files, watermarkImage, position) {
    files.forEach((file, index) => {
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
          // console.log(watermarkX, watermarkY, watermarkWidth, watermarkHeight)
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
          downloadLink.download = `watermarked-${index}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        };
        image.src = e.target.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  const handleApplyWatermark = () => {
    console.log(111111);
    console.trace();
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
}

export default App;
