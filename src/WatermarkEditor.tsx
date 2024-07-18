/* eslint-disable react/display-name */
import React, { useState, useEffect, useRef, forwardRef } from "react";
// import { button } from "antd";
import Konva from "konva";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import "./watermark.css";
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

const drawGuideLines = (layer, stageWidth, stageHeight) => {
    const lineStroke = "red";
    const lineStrokeWidth = 1;
    const dash = [4, 6];

    // 清除旧的参考线
    const oldLines = layer.find(".guide-line");
    oldLines.forEach((line) => line.destroy());

    // 生成多条水平辅助线
    for (let i = 1; i <= 3; i++) {
        const yPos = (stageHeight / 4) * i;
        const horizontalLine = new Konva.Line({
            points: [0, yPos, stageWidth, yPos],
            stroke: lineStroke,
            strokeWidth: lineStrokeWidth,
            dash: dash,
            name: "guide-line", // 给参考线添加名称
        });
        layer.add(horizontalLine);
    }

    // 生成多条垂直辅助线
    for (let i = 1; i <= 3; i++) {
        const xPos = (stageWidth / 4) * i;
        const verticalLine = new Konva.Line({
            points: [xPos, 0, xPos, stageHeight],
            stroke: lineStroke,
            strokeWidth: lineStrokeWidth,
            dash: dash,
            name: "guide-line", // 给参考线添加名称
        });
        layer.add(verticalLine);
    }

    layer.batchDraw(); // 重新绘制图层以显示所有辅助线
};

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
                {...otherProps}
                width={size.width}
                height={size.height}
            />
        );
    }
);

interface WatermarkEditorProps {
    watermarkUrl: string;
    backgroundImageFile: File | null;
    onTransform: (position: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
    }) => void;
}
const WatermarkEditor: React.FC<WatermarkEditorProps> = ({
    watermarkUrl,
    backgroundImageFile,
    onTransform,
}) => {
    // TODO
    // 1.水印的缩放比例应该要和背景图片的比例保持一致 done
    // 2.保存水印位置时，统一都用百分比百分比，而不是尺寸
    // 3.水印统一一个scale， 不用scaleX和scaleY，也就是说水印的长宽比不变，要不然会拉伸 done
    // 4.水印的透明度，可以设置
    // 5.水印的旋转角度，可以设置
    // 6.背景图片放大是在预览图宽高范围内放大，不应该超过这个区域
    // 7.设置水印颜色
    // 8.编辑撤销重做

    // 背景图片相关设置
    // 背景图片的固定宽度（或者高度），预览时图片固定就这么大，太大超过屏幕
    // 这些都是固定的
    // 将固定宽度的常量转换为状态
    const [backgroundFixWidthVW, setBackgroundFixWidthVW] = useState(
        () => window.innerHeight * 0.8
    );
    const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
    const [backgroundImage, backgroundImageStatus] =
        useImage(backgroundImageUrl);
    // 预览时背景图片尺寸
    const [backgroundImageSize, setBackgroundImageSize] = useState({
        width: 0,
        height: 0,
    });
    // 背景图片的缩放比例（预览/原图）
    const [backgroundScale, setBackgroundScale] = useState(1);

    // 水印相关设置
    const [watermarkImage] = useImage(watermarkUrl);
    const [watermarkSize, setWatermarkSize] = useState({ width: 0, height: 0 }); // 新增水印尺寸状态
    const [position, setPosition] = useState({
        x: 0.1,
        y: 0.1,
        scaleX: backgroundScale,
        scaleY: backgroundScale,
        rotation: 0,
    });

    // 当前设置的比例，为了方便按钮操作（这是水印的比例，不是背景的比例，搞错了）
    const [currentScale, setCurrentScale] = useState(1);
    const watermarkRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);

    // 添加新的状态来控制背景图片缩放的滑动条的值
    const [backgroundSliderValue, setBackgroundSliderValue] = useState(1);

    const stageRef = useRef(null);

    // 处理背景图片缩放滑动条变化的函数
    const handleBackgroundSliderChange = (e) => {
        const newScale = parseFloat(e.target.value);
        setBackgroundSliderValue(newScale);
        // 更新背景图片的缩放状态
        // setBackgroundScale(newScale);
    };

    // 更新参考线的函数
    const updateGuideLines = () => {
        const stage = stageRef.current; // 获取Stage引用
        if (!stage) return;

        const layer = stage.getLayers()[0]; // 假设只有一个图层
        // 只移除具有'guide-line'名称的元素
        const guideLines = layer.find(".guide-line");
        guideLines.forEach((line) => line.destroy());

        drawGuideLines(
            layer,
            backgroundImageSize.width,
            backgroundImageSize.height
        ); // 绘制新的参考线
    };

    // 更新背景图片宽度的状态
    const updateBackgroundWidth = () => {
        const vwWidth = window.innerHeight * 0.8; // 假设你想要80vw的宽度
        setBackgroundFixWidthVW(vwWidth);
    };

    // 添加resize事件监听器，以便在窗口大小改变时更新背景图片宽度
    useEffect(() => {
        window.addEventListener("resize", updateBackgroundWidth);
        // 当窗口大小改变时，同时更新背景图片和水印的尺寸和位置
        const handleResize = () => {
            updateBackgroundWidth();
            updateWatermarkSize(currentScale);
        };
        window.addEventListener("resize", handleResize);
        handleResize(); // 初始化尺寸和位置
        return () => {
            window.removeEventListener("resize", updateBackgroundWidth);
            window.removeEventListener("resize", handleResize);
        };
    }, [currentScale]);

    // 更新水印尺寸
    const updateWatermarkSize = (scale) => {
        if (watermarkImage) {
            const width = watermarkImage.naturalWidth * backgroundScale * scale;
            const height =
                watermarkImage.naturalHeight * backgroundScale * scale;
            // 确保水印尺寸不为0
            if (width > 0 && height > 0) {
                setWatermarkSize({
                    width: width,
                    height: height,
                });
            }
        }
    };

    // 计算并获取当前缩放的百分比
    const getCurrentScalePercentage = () => {
        // 假设初始的滑动条值为1，即100%
        return Math.round(backgroundSliderValue * 100);
    };

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
        if (backgroundImage && backgroundImageStatus === "loaded") {
            const scaleWidth =
                backgroundFixWidthVW / backgroundImage.naturalWidth;
            const windowHeight = window.innerHeight;
            const scaleHeight = windowHeight / backgroundImage.naturalHeight;
            // 选择宽度和高度中较小的缩放比例，以确保图片完全可见
            const scale = Math.min(scaleWidth, scaleHeight);
            setBackgroundScale(scale);
            const width = backgroundImage.naturalWidth * scale;
            const height = backgroundImage.naturalHeight * scale;
            setBackgroundImageSize({ width, height });
            updateGuideLines();
            setCurrentScale(scale);
            // updateWatermarkSize(scale); // 更新水印的缩放比例
        }
    }, [backgroundImage, backgroundImageStatus, backgroundFixWidthVW]);

    // 初始化水印尺寸
    useEffect(() => {
        if (watermarkImage) {
            setWatermarkSize({
                width: watermarkImage.naturalWidth * backgroundScale,
                height: watermarkImage.naturalHeight * backgroundScale,
            });
        }
    }, [watermarkImage, backgroundScale]);

    useEffect(() => {
        const stage = stageRef.current; // 获取Stage引用
        if (!stage) return;

        const layer = stage.getLayers()[0]; // 假设只有一个图层
        drawGuideLines(
            layer,
            backgroundImageSize.width,
            backgroundImageSize.height
        ); // 绘制辅助线
    }, [backgroundImageSize.width, backgroundImageSize.height]);

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

    // TODO 添加水印的拖拽功能，但目前还有问题，边缘检测也不对，后续修改
    // const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    //   const node = e.target;

    //   // 获取旋转角度
    //   const rotationRadians = (node.rotation() * Math.PI) / 180;

    //   // 获取缩放后的宽度和高度
    //   const width = node.width() * node.scaleX();
    //   const height = node.height() * node.scaleY();

    //   // 计算旋转后的中心点
    //   const cx = node.x() + width / 2;
    //   const cy = node.y() + height / 2;

    //   // 辅助函数计算旋转后的点
    //   const getRotatedPoint = (cx, cy, x, y, angle) => {
    //     const cos = Math.cos(angle);
    //     const sin = Math.sin(angle);
    //     const nx = cos * (x - cx) + sin * (y - cy) + cx;
    //     const ny = cos * (y - cy) - sin * (x - cx) + cy;
    //     return { x: nx, y: ny };
    //   };

    //   // 获取旋转后的四个角点
    //   const corners = [
    //     getRotatedPoint(cx, cy, node.x(), node.y(), rotationRadians),
    //     getRotatedPoint(cx, cy, node.x() + width, node.y(), rotationRadians),
    //     getRotatedPoint(
    //       cx,
    //       cy,
    //       node.x() + width,
    //       node.y() + height,
    //       rotationRadians,
    //     ),
    //     getRotatedPoint(cx, cy, node.x(), node.y() + height, rotationRadians),
    //   ];

    //   // 获取边界框的最小和最大坐标
    //   const minX = Math.min(...corners.map((c) => c.x));
    //   const maxX = Math.max(...corners.map((c) => c.x));
    //   const minY = Math.min(...corners.map((c) => c.y));
    //   const maxY = Math.max(...corners.map((c) => c.y));

    //   // 边缘检测和调整
    //   let adjustX = 0;
    //   let adjustY = 0;

    //   // 检测左边界
    //   if (minX < 0) {
    //     adjustX = -minX;
    //   }
    //   // 检测右边界
    //   else if (maxX > backgroundImageSize.width) {
    //     adjustX = backgroundImageSize.width - maxX;
    //   }

    //   // 检测上边界
    //   if (minY < 0) {
    //     adjustY = -minY;
    //   }
    //   // 检测下边界
    //   else if (maxY > backgroundImageSize.height) {
    //     adjustY = backgroundImageSize.height - maxY;
    //   }

    //   // 这里应用调整，但仅当有必要时
    //   if (adjustX !== 0 || adjustY !== 0) {
    //     // 应用调整
    //     node.x(node.x() + adjustX);
    //     node.y(node.y() + adjustY);
    //   }

    //   // 更新水印在原图上的实际位置
    //   const actualX = (node.x() + adjustX) / backgroundImageSize.width;
    //   const actualY = (node.y() + adjustY) / backgroundImageSize.height;
    //   const actualScaleX = node.scaleX();

    //   setCurrentScale(actualScaleX);
    //   updateWatermarkSize(actualScaleX);

    //   // 设置新位置和缩放
    //   setPosition({
    //     x: actualX,
    //     y: actualY,
    //     scaleX: actualScaleX,
    //     scaleY: actualScaleX,
    //     rotation: node.rotation(),
    //   });

    //   // 传递给onTransform回调,这里x，y是比例
    //   onTransform({
    //     x: actualX,
    //     y: actualY,
    //     scaleX: actualScaleX,
    //     scaleY: actualScaleX,
    //     rotation: node.rotation(),
    //   });

    //   // 使更改生效并重新绘制层
    //   node.getLayer().batchDraw();
    // };

    // const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    //   const node = e.target;

    //   // 获取旋转角度
    //   const rotationRadians = (node.rotation() * Math.PI) / 180;

    //   // 获取缩放后的宽度和高度
    //   const width = node.width() * node.scaleX();
    //   const height = node.height() * node.scaleY();

    //   // 计算旋转后的水印边界框的四个角
    //   const getRotatedPoint = (cx, cy, x, y, angle) => {
    //     const cos = Math.cos(angle);
    //     const sin = Math.sin(angle);
    //     const nx = cos * (x - cx) + sin * (y - cy) + cx;
    //     const ny = cos * (y - cy) - sin * (x - cx) + cy;
    //     return { x: nx, y: ny };
    //   };

    //   const cx = node.x() + width / 2;
    //   const cy = node.y() + height / 2;

    //   const bl = getRotatedPoint(
    //     cx,
    //     cy,
    //     node.x(),
    //     node.y() + height,
    //     rotationRadians,
    //   );
    //   const br = getRotatedPoint(
    //     cx,
    //     cy,
    //     node.x() + width,
    //     node.y() + height,
    //     rotationRadians,
    //   );
    //   const tl = getRotatedPoint(cx, cy, node.x(), node.y(), rotationRadians);
    //   const tr = getRotatedPoint(
    //     cx,
    //     cy,
    //     node.x() + width,
    //     node.y(),
    //     rotationRadians,
    //   );

    //   // 计算边界框的最小/最大 X 和 Y 值
    //   const minX = Math.min(tl.x, tr.x, br.x, bl.x);
    //   const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
    //   const minY = Math.min(tl.y, tr.y, br.y, bl.y);
    //   const maxY = Math.max(tl.y, tr.y, br.y, bl.y);

    //   // 边缘检测和调整
    //   let adjustX = 0;
    //   let adjustY = 0;

    //   // 检测左边界
    //   if (minX < 0) {
    //     adjustX = -minX;
    //   }
    //   // 检测右边界
    //   else if (maxX > backgroundImageSize.width) {
    //     adjustX = backgroundImageSize.width - maxX;
    //   }

    //   // 检测上边界
    //   if (minY < 0) {
    //     adjustY = -minY;
    //   }
    //   // 检测下边界
    //   else if (maxY > backgroundImageSize.height) {
    //     adjustY = backgroundImageSize.height - maxY;
    //   }

    //   // 应用调整
    //   node.x(node.x() + adjustX);
    //   node.y(node.y() + adjustY);

    //   // 计算水印在原图上的实际位置
    //   const actualX = (node.x() + adjustX) / backgroundImageSize.width;
    //   const actualY = (node.y() + adjustY) / backgroundImageSize.height;
    //   const actualScaleX = node.scaleX();

    //   setCurrentScale(actualScaleX);
    //   updateWatermarkSize(actualScaleX);

    //   // 设置新位置和缩放
    //   setPosition({
    //     x: actualX,
    //     y: actualY,
    //     scaleX: actualScaleX,
    //     scaleY: actualScaleX,
    //     rotation: node.rotation(),
    //   });

    //   // 传递给onTransform回调,这里x，y是比例
    //   onTransform({
    //     x: actualX,
    //     y: actualY,
    //     scaleX: actualScaleX,
    //     scaleY: actualScaleX,
    //     rotation: node.rotation(),
    //   });

    //   // 使更改生效并重新绘制层
    //   node.getLayer().batchDraw();
    // };

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        let newX = node.x();
        let newY = node.y();

        // 检查是否超出背景的左边界
        if (newX < 0) {
            console.log(newX, "x < 0");
            newX = 0;
        }
        // 检查是否超出背景的上边界
        if (newY < 0) {
            newY = 0;
        }
        // 检查是否超出背景的右边界
        if (newX + watermarkSize.width > backgroundImageSize.width) {
            newX = backgroundImageSize.width - watermarkSize.width;
        }
        // 检查是否超出背景的下边界
        if (newY + watermarkSize.height > backgroundImageSize.height) {
            newY = backgroundImageSize.height - watermarkSize.height;
        }
        // 确保水印位置更新
        node.position({ x: newX, y: newY });

        // 计算水印在原图上的实际位置和尺寸
        const actualX = newX / backgroundImageSize.width;
        const actualY = newY / backgroundImageSize.height;
        const actualScaleX = node.scaleX();
        const actualRotation = node.rotation();

        setCurrentScale(actualScaleX);

        updateWatermarkSize(actualScaleX);

        setPosition({
            x: actualX,
            y: actualY,
            scaleX: actualScaleX,
            scaleY: actualScaleX,
            rotation: actualRotation,
        });

        console.log(actualX, actualY, actualScaleX, "123");

        // 传递给onTransform回调
        onTransform({
            x: actualX,
            y: actualY,
            scaleX: actualScaleX,
            scaleY: actualScaleX,
            rotation: actualRotation,
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
        // 检查是否超出背景的右边界
        if (newX + watermarkSize.width > backgroundImageSize.width) {
            newX = backgroundImageSize.width - watermarkSize.width;
        }
        // 检查是否超出背景的下边界
        if (newY + watermarkSize.height > backgroundImageSize.height) {
            newY = backgroundImageSize.height - watermarkSize.height;
        }

        // 计算水印在原图上的实际位置和尺寸
        const actualX = newX / backgroundImageSize.width;
        const actualY = newY / backgroundImageSize.height;
        const actualScaleX = node.scaleX();
        const actualRotation = node.rotation();

        setCurrentScale(actualScaleX);

        updateWatermarkSize(actualScaleX);

        setPosition({
            x: actualX,
            y: actualY,
            scaleX: actualScaleX,
            scaleY: actualScaleX,
            rotation: actualRotation,
        });

        console.log(actualX, actualY, actualScaleX, "456");
        // 传递给onTransform回调,这里x，y是比例
        onTransform({
            x: actualX,
            y: actualY,
            scaleX: actualScaleX,
            scaleY: actualScaleX,
            rotation: actualRotation,
        });
    };

    // 更新水印位置的辅助函数
    const updateWatermarkPosition = (percentX, percentY) => {
        // 计算水印图片中心的坐标（百分比）
        const centerX = Math.max(0, Math.min(1, percentX));
        const centerY = Math.max(0, Math.min(1, percentY));

        // 计算水印图片左上角的坐标（百分比）
        const leftTopX =
            centerX - watermarkSize.width / 2 / backgroundImageSize.width;
        const leftTopY =
            centerY - watermarkSize.height / 2 / backgroundImageSize.height;

        // 调整坐标以确保水印不会超出背景图片的范围
        const adjustedLeftTopX = Math.max(
            0,
            Math.min(
                1 - watermarkSize.width / backgroundImageSize.width,
                leftTopX
            )
        );
        const adjustedLeftTopY = Math.max(
            0,
            Math.min(
                1 - watermarkSize.height / backgroundImageSize.height,
                leftTopY
            )
        );

        // 设置水印图片的新位置和缩放
        setPosition({
            x: adjustedLeftTopX,
            y: adjustedLeftTopY,
            scaleX: currentScale,
            scaleY: currentScale,
            rotation: 0,
        });

        // 如果有需要，可以调用 onTransform 来通知其他组件位置和缩放的变化
        console.log(adjustedLeftTopX, adjustedLeftTopY, currentScale, "789");
        onTransform({
            x: adjustedLeftTopX,
            y: adjustedLeftTopY,
            scaleX: currentScale,
            scaleY: currentScale,
            rotation: 0,
        });
    };

    // 按钮回调函数，设置水印位置
    const onTopLeft = () => {
        updateWatermarkPosition(0, 0);
    };
    const onTopMid = () => {
        updateWatermarkPosition(0.5, 0);
    };
    const onTopRight = () => {
        updateWatermarkPosition(1, 0);
    };
    const onMidLeft = () => {
        updateWatermarkPosition(0, 0.5);
    };
    const onCenterMid = () => {
        updateWatermarkPosition(0.5, 0.5);
    };
    const onMidRight = () => {
        updateWatermarkPosition(1, 0.5);
    };
    const onBottomLeft = () => {
        updateWatermarkPosition(0, 1);
    };
    const onBottomMid = () => {
        updateWatermarkPosition(0.5, 1);
    };
    const onBottomRight = () => {
        updateWatermarkPosition(1, 1);
    };

    return (
        <div className="watermarkEditor">
            {/* <h2>水印添加</h2> */}
            {/* 显示背景图片原始宽高信息 */}
            {/* {backgroundImage && (
        <div>
          <p>背景图片</p>
          <p>原始宽度: {backgroundImage.naturalWidth}px</p>
          <p>原始高度: {backgroundImage.naturalHeight}px</p>
          <p>当前缩放比例: {backgroundScale}</p>
          <p>当前宽度: {backgroundImageSize.width}px</p>
          <p>当前高度: {backgroundImageSize.height}px</p>
        </div>
      )} */}

            {/* 显示背景图片缩放的滑动条 */}
            {/* <div>
        <label htmlFor="background-scale-slider">背景缩放: </label>
        <input
          id="background-scale-slider"
          type="range"
          min="0.1"
          max="4"
          step="0.01"
          value={backgroundSliderValue}
          onChange={handleBackgroundSliderChange}
        />
        <span>{getCurrentScalePercentage()}%</span>
      </div> */}

            {/* 显示水印图片原始宽高信息 */}
            {/* {watermarkImage && (
        <div>
          <p>水印图片</p>
          <p>原始宽度: {watermarkImage.naturalWidth}px</p>
          <p>原始高度: {watermarkImage.naturalHeight}px</p>
          <p>
            当前缩放比例: {watermarkSize.width / watermarkImage.naturalWidth}
          </p>
          <p>当前宽度: {watermarkSize.width}px</p>
          <p>当前高度: {watermarkSize.height}px</p>
        </div>
      )} */}

            <Stage
                width={backgroundImageSize.width}
                height={backgroundImageSize.height}
                ref={stageRef}
            >
                <Layer>
                    {backgroundImage && (
                        <KonvaImage
                            image={backgroundImage}
                            width={
                                backgroundImageSize.width *
                                backgroundSliderValue
                            }
                            height={
                                backgroundImageSize.height *
                                backgroundSliderValue
                            }
                        />
                    )}
                    {watermarkImage && (
                        <>
                            <ImageWithFixedWidth
                                src={watermarkUrl}
                                fixedWidth={
                                    watermarkImage.naturalWidth *
                                    backgroundScale
                                } // 使用固定宽度
                                x={position.x * backgroundImageSize.width}
                                y={position.y * backgroundImageSize.height}
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
                                enabledAnchors={[
                                    "top-left",
                                    "top-right",
                                    "bottom-left",
                                    "bottom-right",
                                ]} // 设置只有对角线上的锚点
                                keepRatio // 新增属性，保持长宽比
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
            <div className="flex justify-between align-baseline w-full my-4 flex-wrap">
                <button onClick={onTopLeft}>左上</button>
                <button onClick={onTopMid}>中上</button>
                <button onClick={onTopRight}>右上</button>
                <button onClick={onMidLeft}>中左</button>
                <button onClick={onCenterMid}>中中</button>
                <button onClick={onMidRight}>中右</button>
                <button onClick={onBottomLeft}>左下</button>
                <button onClick={onBottomMid}>中下</button>
                <button onClick={onBottomRight}>右下</button>
            </div>
        </div>
    );
};

export default WatermarkEditor;
