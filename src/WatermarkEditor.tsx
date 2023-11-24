import React, { useState, useEffect, useRef, forwardRef, Ref } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';

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
      setWatermarkImageSize({ width: watermarkImage.naturalWidth * scale, height: watermarkImage.naturalHeight * scale });
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

export default WatermarkEditor;
