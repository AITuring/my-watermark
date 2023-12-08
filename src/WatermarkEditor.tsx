/* eslint-disable react/display-name */
import React, { useState, useEffect, useRef, forwardRef } from 'react';
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
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (e: Konva.KonvaEventObject<Event>) => void;
}

const ImageWithFixedWidth = forwardRef<Konva.Image, ImageWithFixedWidthProps>(
  (
    {
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
    },
    ref,
  ) => {
    const [image, status] = useImage(src);
    const [size, setSize] = useState({ width: fixedWidth, height: 0 });

    useEffect(() => {
      if (image && status === 'loaded') {
        const height = (image.naturalHeight / image.naturalWidth) * fixedWidth;
        setSize({ width: fixedWidth, height });
      }
    }, [image, fixedWidth, status]);

    return (
      <KonvaImage
        image={image}
        x={x || 0}
        y={y || 0}
        scaleX={scaleX || 1}
        scaleY={scaleY || 1}
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
  },
);

interface WatermarkEditorProps {
  watermarkUrl: string;
  backgroundImageFile: File | null;
  onTransform: (position: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  }) => void;
}

const WatermarkEditor: React.FC<WatermarkEditorProps> = ({
  watermarkUrl,
  backgroundImageFile,
  onTransform,
}) => {
  // 还有问题，如果图片是竖屏，目前图片无法加载
  const backgroundFixWidth = 800;
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [backgroundImage, backgroundImageStatus] = useImage(backgroundImageUrl);
  // 背景图片的缩放比例
  const [backgroundScale, setBackgroundScale] = useState(1);
  const [watermarkImage] = useImage(watermarkUrl);
  const [position, setPosition] = useState({
    x: 20,
    y: 20,
    scaleX: 1,
    scaleY: 1,
  });
  const [backgroundImageSize, setBackgroundImageSize] = useState({
    width: 0,
    height: 0,
  });

  const watermarkRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // 当背景图片文件改变时，更新背景图片的 URL 和尺寸
  useEffect(() => {
    if (backgroundImageFile) {
      const objectURL = URL.createObjectURL(backgroundImageFile);
      setBackgroundImageUrl(objectURL);
      return () => URL.revokeObjectURL(objectURL);
    }
  }, [backgroundImageFile]);

  // 当背景图片加载完成时，更新背景图片的尺寸
  useEffect(() => {
    if (backgroundImage && backgroundImageStatus === 'loaded') {
      const scaleWidth = backgroundFixWidth / backgroundImage.naturalWidth;
      const windowHeight = window.innerHeight;
      const scaleHeight = windowHeight / backgroundImage.naturalHeight;
      // 选择宽度和高度中较小的缩放比例，以确保图片完全可见
      const scale = Math.min(scaleWidth, scaleHeight);
      setBackgroundScale(scale);
      const width = backgroundImage.naturalWidth * scale;
      const height = backgroundImage.naturalHeight * scale;
      setBackgroundImageSize({ width, height });
    }
  }, [backgroundImage, backgroundImageStatus, backgroundFixWidth]);

  // 清理背景图片的 URL
  useEffect(() => {
    return () => {
      if (backgroundImageFile) {
        URL.revokeObjectURL(URL.createObjectURL(backgroundImageFile));
      }
    };
  }, [backgroundImageFile]);

  const onWatermarkClick = () => {
    if (watermarkRef.current && transformerRef.current) {
      transformerRef.current.nodes([watermarkRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    let newX = node.x();
    let newY = node.y();
    console.log(newX, newY);

    // 检查是否超出背景的左边界
    if (newX < 0) {
      newX = 0;
    }
    // 检查是否超出背景的上边界
    if (newY < 0) {
      newY = 0;
    }
    // 水印当前的缩放后尺寸
    const watermarkWidth =
      watermarkImage.naturalWidth * node.scaleX() * backgroundScale;
    const watermarkHeight =
      watermarkImage.naturalHeight * node.scaleY() * backgroundScale;
    // 检查是否超出背景的右边界
    if (newX + watermarkWidth > backgroundImageSize.width) {
      newX = backgroundImageSize.width - watermarkWidth;
    }
    // 检查是否超出背景的下边界
    if (newY + watermarkHeight > backgroundImageSize.height) {
      newY = backgroundImageSize.height - watermarkHeight;
    }

    setPosition({
      x: newX,
      y: newY,
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
    });

    // 确保水印位置更新
    node.position({ x: newX, y: newY });

    // 计算水印在原图上的实际位置和尺寸
    const actualX = newX / backgroundImageSize.width;
    const actualY = newY / backgroundImageSize.height;
    const actualScaleX = node.scaleX();
    const actualScaleY = node.scaleY();

    // 传递给onTransform回调
    onTransform({
      x: actualX,
      y: actualY,
      scaleX: actualScaleX,
      scaleY: actualScaleY,
    });

    // 使更改生效并重新绘制层
    node.getLayer().batchDraw();
  };

  const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    let newX = node.x();
    let newY = node.y();

    // 检查是否超出背景的左边界
    if (newX < 0) {
      newX = 0;
    }
    // 检查是否超出背景的上边界
    if (newY < 0) {
      newY = 0;
    }
    const watermarkWidth = watermarkImage.naturalWidth * backgroundScale;
    const watermarkHeight = watermarkImage.naturalHeight * backgroundScale;
    // 检查是否超出背景的右边界
    if (newX + watermarkWidth > backgroundImageSize.width) {
      newX = backgroundImageSize.width - watermarkWidth;
    }
    // 检查是否超出背景的下边界
    if (newY + watermarkHeight > backgroundImageSize.height) {
      newY = backgroundImageSize.height - watermarkHeight;
    }

    setPosition({
      x: newX,
      y: newY,
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
    });

    // 计算水印在原图上的实际位置和尺寸
    const actualX = newX / backgroundImageSize.width;
    const actualY = newY / backgroundImageSize.height;
    const actualScaleX = node.scaleX();
    const actualScaleY = node.scaleY();

    // 传递给onTransform回调,这里x，y是比例
    onTransform({
      x: actualX,
      y: actualY,
      scaleX: actualScaleX,
      scaleY: actualScaleY,
    });
  };

  return (
    <Stage
      width={backgroundImageSize.width}
      height={backgroundImageSize.height}
    >
      <Layer>
        {backgroundImage && (
          <KonvaImage
            image={backgroundImage}
            width={backgroundImageSize.width}
            height={backgroundImageSize.height}
          />
        )}
        {watermarkImage && (
          <>
            <ImageWithFixedWidth
              src={watermarkUrl}
              fixedWidth={watermarkImage.naturalWidth * backgroundScale} // 使用您想要的固定宽度
              x={position.x}
              y={position.y}
              scaleX={position.scaleX}
              scaleY={position.scaleY}
              draggable
              ref={watermarkRef}
              onClick={onWatermarkClick}
              onTap={onWatermarkClick}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransform}
            />
            <Transformer
              ref={transformerRef}
              centeredScaling={false}
              boundBoxFunc={(oldBox, newBox) => {
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
