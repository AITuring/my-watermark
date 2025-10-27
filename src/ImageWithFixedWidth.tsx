import { useState, useEffect, forwardRef } from "react";
import Konva from "konva";
import { Image as KonvaImage } from "react-konva";
import useImage from "use-image";

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
    opacity?: number; // 新增透明度属性
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
            opacity = 1, // 默认不透明
            ...otherProps
        },
        ref
    ) => {
        const [image, status] = useImage(src);
        const [size, setSize] = useState({ width: fixedWidth, height: 0 });

        useEffect(() => {
            if (image && status === "loaded") {
                const height =
                    (image.naturalHeight / image.naturalWidth) * fixedWidth;
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
                opacity={opacity} // 应用透明度
                {...otherProps}
                width={size.width}
                height={size.height}
            />
        );
    }
);

ImageWithFixedWidth.displayName = 'ImageWithFixedWidth';
export default ImageWithFixedWidth;
