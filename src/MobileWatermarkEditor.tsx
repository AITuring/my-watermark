import React, { useState, useEffect, useRef } from "react";
import {
    Stage,
    Layer,
    Image as KonvaImage,
    Transformer,
    Line,
    Text,
} from "react-konva";
import useImage from "use-image";
import { WatermarkPosition } from "./types";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    RotateCcw,
    RotateCw,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import Konva from "konva";
import ImageWithFixedWidth from "./ImageWithFixedWidth";

// 绘制辅助线函数
const drawGuideLines = (layer: Konva.Layer, width: number, height: number) => {
    const lineStroke = "red";
    const lineStrokeWidth = 1;
    const dash = [4, 6];

    // 清除旧的参考线
    const oldLines = layer.find(".guide-line");
    oldLines.forEach((line) => line.destroy());

    // 生成多条水平辅助线
    for (let i = 1; i <= 3; i++) {
        const yPos = (height / 4) * i;
        const horizontalLine = new Konva.Line({
            points: [0, yPos, width, yPos],
            stroke: lineStroke,
            strokeWidth: lineStrokeWidth,
            dash: dash,
            name: "guide-line", // 给参考线添加名称
        });
        layer.add(horizontalLine);
    }

    // 生成多条垂直辅助线
    for (let i = 1; i <= 3; i++) {
        const xPos = (width / 4) * i;
        const verticalLine = new Konva.Line({
            points: [xPos, 0, xPos, height],
            stroke: lineStroke,
            strokeWidth: lineStrokeWidth,
            dash: dash,
            name: "guide-line", // 给参考线添加名称
        });
        layer.add(verticalLine);
    }

    layer.batchDraw(); // 重新绘制图层以显示所有辅助线
};

interface MobileWatermarkEditorProps {
    watermarkUrl: string;
    backgroundImageFile: File;
    currentWatermarkPosition?: WatermarkPosition;
    onTransform: (position: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
    }) => void;
    onAllTransform: (position: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
    }) => void;
    currentIndex?: number;
    totalImages?: number;
    onPrevImage?: () => void;
    onNextImage?: () => void;
}

const MobileWatermarkEditor: React.FC<MobileWatermarkEditorProps> = ({
    watermarkUrl,
    backgroundImageFile,
    currentWatermarkPosition,
    onTransform,
    onAllTransform,
    currentIndex = 0,
    totalImages = 0,
    onPrevImage,
    onNextImage,
}) => {
    // 背景图片相关设置
    const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
    const [backgroundImage, backgroundImageStatus] =
        useImage(backgroundImageUrl);
    const [backgroundImageSize, setBackgroundImageSize] = useState({
        width: 0,
        height: 0,
    });
    const [stageSize, setStageSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight * 0.6,
    });

    // 水印相关设置
    const [watermarkImage] = useImage(watermarkUrl);
    const [watermarkSize, setWatermarkSize] = useState({ width: 0, height: 0 });
    const [position, setPosition] = useState(
        currentWatermarkPosition || {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
        }
    );

    // 是否显示辅助线
    const [showGuideLines, setShowGuideLines] = useState(true);

    // 批量or单独
    const [isBatch, setIsBatch] = useState<boolean>(true);

    const [backgroundScale, setBackgroundScale] = useState(0.2);

    const [watermarkStandardScale, setWatermarkStandardScale] = useState(0.1);
    // 添加：当前设置的比例，为了方便按钮操作
    const [currentScale, setCurrentScale] = useState(1);

    const [backgroundFixWidthVW, setBackgroundFixWidthVW] = useState(
        () => window.innerHeight * 0.8
    );

    // 添加加载状态
    const [isLoading, setIsLoading] = useState(true);

    const watermarkRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 添加触摸相关状态
    const [touchStartDistance, setTouchStartDistance] = useState<number | null>(
        null
    );
    const [touchStartRotation, setTouchStartRotation] = useState<number | null>(
        null
    );
    const [initialScale, setInitialScale] = useState<number>(1);
    const [initialRotation, setInitialRotation] = useState<number>(0);

    // 计算两个触摸点之间的距离
    const getDistance = (touch1: Touch, touch2: Touch) => {
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    };

    // 计算两个触摸点形成的角度
    const getRotation = (touch1: Touch, touch2: Touch) => {
        return Math.atan2(
            touch2.clientY - touch1.clientY,
            touch2.clientX - touch1.clientX
        );
    };

    useEffect(() => {
        if (watermarkRef.current) {
            // 处理触摸开始事件
            watermarkRef.current.on("touchstart", (e) => {
                const touches = e.evt.touches;
                if (touches.length === 2) {
                    e.evt.preventDefault();
                    const distance = getDistance(touches[0], touches[1]);
                    const rotation = getRotation(touches[0], touches[1]);
                    setTouchStartDistance(distance);
                    setTouchStartRotation(rotation);
                    setInitialScale(position.scaleX);
                    setInitialRotation(position.rotation);
                }
            });

            // 处理触摸移动事件
            watermarkRef.current.on("touchmove", (e) => {
                const touches = e.evt.touches;
                if (
                    touches.length === 2 &&
                    touchStartDistance &&
                    touchStartRotation !== null
                ) {
                    e.evt.preventDefault();
                    const distance = getDistance(touches[0], touches[1]);
                    const rotation = getRotation(touches[0], touches[1]);

                    // 计算缩放比例
                    const scale =
                        (distance / touchStartDistance) * initialScale;
                    // 计算旋转角度
                    const newRotation =
                        initialRotation +
                        ((rotation - touchStartRotation) * 180) / Math.PI;

                    // 更新位置
                    const newPosition = {
                        ...position,
                        scaleX: Math.max(0.1, Math.min(5, scale)),
                        scaleY: Math.max(0.1, Math.min(5, scale)),
                        rotation: newRotation,
                    };
                    setPosition(newPosition);
                    onTransform(newPosition);
                }
            });

            // 处理触摸结束事件
            watermarkRef.current.on("touchend", () => {
                setTouchStartDistance(null);
                setTouchStartRotation(null);
            });
        }

        return () => {
            if (watermarkRef.current) {
                watermarkRef.current.off("touchstart");
                watermarkRef.current.off("touchmove");
                watermarkRef.current.off("touchend");
            }
        };
    }, [position, initialScale, initialRotation, onTransform]);

    // 当背景图片文件改变时，更新背景图片的 URL 和尺寸
    useEffect(() => {
        if (backgroundImageFile) {
            setIsLoading(true);
            // 释放之前的URL
            if (backgroundImageUrl) {
                URL.revokeObjectURL(backgroundImageUrl);
            }

            // 创建新的URL
            const objectURL = URL.createObjectURL(backgroundImageFile);
            setBackgroundImageUrl(objectURL);

            return () => {
                URL.revokeObjectURL(objectURL);
            };
        }
    }, [backgroundImageFile]);

    // 当背景图片加载完成时，计算并设置 watermarkStandardScale
    useEffect(() => {
        if (backgroundImage && backgroundImageStatus === "loaded") {
            setIsLoading(false);
            const scaleWidth =
                backgroundFixWidthVW / backgroundImage.naturalWidth;
            const windowHeight = window.innerHeight * 0.74;
            const scaleHeight = windowHeight / backgroundImage.naturalHeight;
            const scale = Math.min(scaleWidth, scaleHeight);

            const ratio =
                backgroundImage.naturalWidth / backgroundImage.naturalHeight;
            const width = windowHeight * ratio;
            const height = windowHeight;
            setBackgroundImageSize({ width, height });
            updateGuideLines();
            setCurrentScale(scale);

            // 添加：计算水印标准化比例
            if (watermarkImage) {
                const minDimension = Math.min(
                    backgroundImage.naturalWidth,
                    backgroundImage.naturalHeight
                );
                const standardWatermarkSize = minDimension * 0.1; // 水印大小为较短边的10%
                const standardScale =
                    standardWatermarkSize / watermarkImage.naturalWidth;
                setWatermarkStandardScale(standardScale);
            }
        }
    }, [
        backgroundImage,
        backgroundImageStatus,
        backgroundFixWidthVW,
        watermarkImage,
    ]);

    // 当背景图片加载完成时，更新背景图片的尺寸和舞台尺寸
    useEffect(() => {
        if (backgroundImage && backgroundImageStatus === "loaded") {
            // 计算适合屏幕的图片尺寸
            const containerWidth = window.innerWidth;
            const containerHeight = window.innerHeight * 0.6;

            const imageRatio =
                backgroundImage.naturalWidth / backgroundImage.naturalHeight;

            let width, height;

            // 根据图片比例决定宽高
            if (imageRatio >= 1) {
                // 横图
                width = containerWidth;
                height = width / imageRatio;
                if (height > containerHeight) {
                    height = containerHeight;
                    width = height * imageRatio;
                }
            } else {
                // 竖图
                height = containerHeight;
                width = height * imageRatio;
                if (width > containerWidth) {
                    width = containerWidth;
                    height = width / imageRatio;
                }
            }

            setBackgroundImageSize({ width, height });
            setStageSize({ width, height });
            const scaleWidth = width / backgroundImage.naturalWidth;
            const scaleHeight = height / backgroundImage.naturalHeight;
            const scale = Math.min(scaleWidth, scaleHeight);
            setBackgroundScale(scale);
            setCurrentScale(scale);
        }
    }, [backgroundImage, backgroundImageStatus]);

    // 当水印图片加载完成时，更新水印尺寸
    useEffect(() => {
        if (watermarkImage && backgroundImageSize.width > 0) {
            // 设置水印初始大小为背景图的20%宽度
            const scale =
                (backgroundImageSize.height * 0.2) /
                watermarkImage.naturalHeight;
            setWatermarkSize({
                width: watermarkImage.naturalWidth * scale,
                height: watermarkImage.naturalHeight * scale,
            });

            // 如果没有现有位置，则设置初始位置
            if (!currentWatermarkPosition) {
                setPosition({
                    x:
                        backgroundImageSize.width / 2 -
                        (watermarkImage.naturalWidth * scale) / 2,
                    y:
                        backgroundImageSize.height / 2 -
                        (watermarkImage.naturalHeight * scale) / 2,
                    scaleX: scale,
                    scaleY: scale,
                    rotation: 0,
                });
            }
        }
    }, [watermarkImage, backgroundImageSize, currentWatermarkPosition]);

    // 绘制辅助线
    useEffect(() => {
        if (
            layerRef.current &&
            showGuideLines &&
            backgroundImageSize.width > 0 &&
            backgroundImageSize.height > 0
        ) {
            drawGuideLines(
                layerRef.current,
                backgroundImageSize.width,
                backgroundImageSize.height
            );
        } else if (layerRef.current && !showGuideLines) {
            // 清除辅助线
            const oldLines = layerRef.current.find(".guide-line");
            oldLines.forEach((line) => line.destroy());
            layerRef.current.batchDraw();
        }
    }, [
        showGuideLines,
        backgroundImageSize,
        layerRef.current,
        backgroundImageFile,
    ]);

    // 初始化水印尺寸
    useEffect(() => {
        if (watermarkImage) {
            console.log(
                "watermarkImage",
                watermarkImage.naturalWidth,
                watermarkImage.naturalHeight,
                backgroundScale
            );
            setWatermarkSize({
                width: watermarkImage.naturalWidth * backgroundScale,
                height: watermarkImage.naturalHeight * backgroundScale,
            });
        }
    }, [watermarkImage, backgroundScale]);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        const layer = stage.getLayers()[0];
        drawGuideLines(
            layer,
            backgroundImageSize.width,
            backgroundImageSize.height
        );
    }, [backgroundImageSize.width, backgroundImageSize.height]);

    // 当位置变化时，通知父组件
    useEffect(() => {
        if (currentWatermarkPosition) {
            setPosition(currentWatermarkPosition);
        }
    }, [currentWatermarkPosition]);

    // 清理背景图片的 URL
    useEffect(() => {
        if (backgroundImageFile) {
            URL.revokeObjectURL(URL.createObjectURL(backgroundImageFile));
        }
    }, [backgroundImageFile]);

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
        const newPosition = {
            x: adjustedLeftTopX,
            y: adjustedLeftTopY,
            scaleX: currentScale,
            scaleY: currentScale,
            rotation: 0,
        };

        setPosition(newPosition);

        if (isBatch) {
            onAllTransform(newPosition);
        } else {
            onTransform(newPosition);
        }
    };

    // 处理水印拖动结束事件
    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        let newX = node.x();
        let newY = node.y();

        // 检查是否超出背景的边界
        if (newX < 0) {
            newX = 0;
        }
        if (newY < 0) {
            newY = 0;
        }
        if (newX + watermarkSize.width > backgroundImageSize.width) {
            newX = backgroundImageSize.width - watermarkSize.width;
        }
        if (newY + watermarkSize.height > backgroundImageSize.height) {
            newY = backgroundImageSize.height - watermarkSize.height;
        }

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

        // 传递给onTransform回调
        if (isBatch) {
            onAllTransform({
                x: actualX,
                y: actualY,
                scaleX: actualScaleX,
                scaleY: actualScaleX,
                rotation: actualRotation,
            });
        } else {
            onTransform({
                x: actualX,
                y: actualY,
                scaleX: actualScaleX,
                scaleY: actualScaleX,
                rotation: actualRotation,
            });
        }

        node.getLayer().batchDraw();
    };

    // 更新水印尺寸
    const updateWatermarkSize = (scale) => {
    if (watermarkImage) {
        const standardWatermarkWidth = watermarkImage.naturalWidth * watermarkStandardScale;
        const standardWatermarkHeight = watermarkImage.naturalHeight * watermarkStandardScale;

        const width = standardWatermarkWidth * backgroundScale * scale;
        const height = standardWatermarkHeight * backgroundScale * scale;
        if (width > 0 && height > 0) {
            setWatermarkSize({
                width: width,
                height: height,
            });
        }
    }
};

    // 处理水印变换结束事件
    const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        let newX = node.x();
        let newY = node.y();

        // 检查是否超出背景的边界
        if (newX < 0) {
            newX = 0;
        }
        if (newY < 0) {
            newY = 0;
        }
        if (newX + watermarkSize.width > backgroundImageSize.width) {
            newX = backgroundImageSize.width - watermarkSize.width;
        }
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

        const newPosition = {
            x: actualX,
            y: actualY,
            scaleX: actualScaleX,
            scaleY: actualScaleX,
            rotation: actualRotation,
        };

        setPosition(newPosition);

        if (isBatch) {
            onAllTransform(newPosition);
        } else {
            onTransform(newPosition);
        }
    };

    // 更新参考线的函数
    const updateGuideLines = () => {
        if (
            !layerRef.current ||
            !showGuideLines ||
            backgroundImageSize.width <= 0 ||
            backgroundImageSize.height <= 0
        )
            return;

        drawGuideLines(
            layerRef.current,
            backgroundImageSize.width,
            backgroundImageSize.height
        );
    };

    // 移动端简化的控制按钮
    const handleRotate = (direction: "left" | "right") => {
        const newRotation =
            position.rotation + (direction === "left" ? -15 : 15);
        const newPos = { ...position, rotation: newRotation };
        setPosition(newPos);

        // 根据批量模式决定调用哪个函数
        if (isBatch) {
            onAllTransform(newPos);
        } else {
            onTransform(newPos);
        }

        // 更新水印的旋转角度
        if (watermarkRef.current) {
            watermarkRef.current.rotation(newRotation);
            watermarkRef.current.getLayer()?.batchDraw();

            if (transformerRef.current) {
                transformerRef.current.nodes([watermarkRef.current]);
                transformerRef.current.getLayer()?.batchDraw();
            }
        }
    };

    const handleScale = (action: "increase" | "decrease") => {
        const scaleFactor = action === "increase" ? 1.1 : 0.9;
        const newPos = {
            ...position,
            scaleX: position.scaleX * scaleFactor,
            scaleY: position.scaleY * scaleFactor,
        };
        setPosition(newPos);
        if (isBatch) {
            onAllTransform(newPos);
        } else {
            onTransform(newPos);
        }
    };

    // 处理水印点击事件
    const onWatermarkClick = () => {
        if (watermarkRef.current && transformerRef.current) {
            transformerRef.current.nodes([watermarkRef.current]);
            transformerRef.current.getLayer().batchDraw();
        }
    };

    // 切换辅助线显示状态
    const toggleGuideLines = () => {
        setShowGuideLines(!showGuideLines);
    };

    // 处理位置选择变化
    const handlePositionChange = (value: string) => {
        switch (value) {
            case "topLeft":
                updateWatermarkPosition(0, 0);
                break;
            case "topCenter":
                updateWatermarkPosition(0.5, 0);
                break;
            case "topRight":
                updateWatermarkPosition(1, 0);
                break;
            case "middleLeft":
                updateWatermarkPosition(0, 0.5);
                break;
            case "middleCenter":
                updateWatermarkPosition(0.5, 0.5);
                break;
            case "middleRight":
                updateWatermarkPosition(1, 0.5);
                break;
            case "bottomLeft":
                updateWatermarkPosition(0, 1);
                break;
            case "bottomCenter":
                updateWatermarkPosition(0.5, 1);
                break;
            case "bottomRight":
                updateWatermarkPosition(1, 1);
                break;
            default:
                updateWatermarkPosition(0.5, 0.5);
        }
    };

    // 处理批量/单独模式切换
    const handleModeChange = (value: string) => {
        setIsBatch(value === "batch");
    };

    // 处理切换图片
    const handlePrevImage = () => {
        if (onPrevImage) {
            onPrevImage();
        }
    };

    const handleNextImage = () => {
        if (onNextImage) {
            onNextImage();
        }
    };

    return (
        <div ref={containerRef} className="relative flex flex-col h-full">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-50">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                        <p className="mt-2 text-sm text-gray-600">
                            加载图片中...
                        </p>
                    </div>
                </div>
            )}
            <div className="flex-1 relative flex justify-center items-center">
                {/* 图片索引指示器 */}
                {totalImages > 0 && (
                    <div className="absolute top-2 left-0 right-0 z-10 flex justify-center">
                        <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                            {currentIndex + 1} / {totalImages}
                        </div>
                    </div>
                )}

                {/* 左右切换按钮 */}
                {totalImages > 1 && (
                    <>
                        <Button
                            variant="outline"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-70 rounded-full"
                            onClick={handlePrevImage}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-70 rounded-full"
                            onClick={handleNextImage}
                            disabled={currentIndex === totalImages - 1}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </>
                )}

                <Stage
                    ref={stageRef}
                    width={backgroundImageSize.width}
                    height={backgroundImageSize.height}
                    className="bg-gray-100"
                    style={{
                        margin: "0 auto",
                        maxWidth: "100%",
                        maxHeight: "100%",
                    }}
                >
                    <Layer ref={layerRef}>
                        {backgroundImage && (
                            <KonvaImage
                                image={backgroundImage}
                                width={backgroundImageSize.width}
                                height={backgroundImageSize.height}
                                x={0}
                                y={0}
                            />
                        )}
                        {watermarkImage && (
                            <ImageWithFixedWidth
                                src={watermarkUrl}
                                fixedWidth={
                                   watermarkImage.naturalWidth * watermarkStandardScale * backgroundScale
                                }
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
                        )}
                        <Transformer
                            ref={transformerRef}
                            boundBoxFunc={(oldBox, newBox) => {
                                // 限制变换的最小尺寸
                                if (newBox.width < 5 || newBox.height < 5) {
                                    return oldBox;
                                }
                                return newBox;
                            }}
                            enabledAnchors={[
                                "top-left",
                                "top-right",
                                "bottom-left",
                                "bottom-right",
                            ]}
                            rotationSnaps={[0, 90, 180, 270]}
                        />
                    </Layer>
                </Stage>
            </div>

            {/* 移动端控制面板 */}
            <div className="p-3 bg-white border-t">
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={toggleGuideLines}
                                    >
                                        {showGuideLines ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {showGuideLines
                                        ? "隐藏辅助线"
                                        : "显示辅助线"}
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleRotate("left")}
                                    >
                                        <RotateCcw className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>左旋转</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleRotate("right")}
                                    >
                                        <RotateCw className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>右旋转</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleScale("increase")}
                                    >
                                        <ZoomIn className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>放大</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleScale("decrease")}
                                    >
                                        <ZoomOut className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>缩小</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Select onValueChange={handlePositionChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="选择位置" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>水印位置</SelectLabel>
                                        <SelectItem value="topLeft">
                                            左上角
                                        </SelectItem>
                                        <SelectItem value="topCenter">
                                            顶部居中
                                        </SelectItem>
                                        <SelectItem value="topRight">
                                            右上角
                                        </SelectItem>
                                        <SelectItem value="middleLeft">
                                            左侧居中
                                        </SelectItem>
                                        <SelectItem value="middleCenter">
                                            正中心
                                        </SelectItem>
                                        <SelectItem value="middleRight">
                                            右侧居中
                                        </SelectItem>
                                        <SelectItem value="bottomLeft">
                                            左下角
                                        </SelectItem>
                                        <SelectItem value="bottomCenter">
                                            底部居中
                                        </SelectItem>
                                        <SelectItem value="bottomRight">
                                            右下角
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Select
                                onValueChange={handleModeChange}
                                defaultValue="batch"
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="应用模式" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>应用模式</SelectLabel>
                                        <SelectItem value="single">
                                            单独应用
                                        </SelectItem>
                                        <SelectItem value="batch">
                                            批量应用
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileWatermarkEditor;
