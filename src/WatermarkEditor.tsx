/* eslint-disable react/display-name */
import React, { useState, useEffect, useRef, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUpLeft,
    ArrowUpRight,
    ArrowDownLeft,
    ArrowDownRight,
    Plus,
} from "lucide-react";
import Konva from "konva";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import { WatermarkPosition } from "./types";

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
    currentWatermarkPosition: WatermarkPosition | undefined;
    onAllTransform: (position: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
    }) => void;
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
    currentWatermarkPosition,
    onTransform,
    onAllTransform,
}) => {
    // 背景图片相关设置
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
    const [backgroundScale, setBackgroundScale] = useState(0.2);
    // 当前设置的比例，为了方便按钮操作（这是水印的比例，不是背景的比例）
    const [currentScale, setCurrentScale] = useState(1);

    // 批量or单独
    const [isBatch, setIsBatch] = useState<boolean>(true);

    // 水印相关设置
    const [watermarkImage] = useImage(watermarkUrl);
    const [watermarkSize, setWatermarkSize] = useState({ width: 0, height: 0 });
    const [position, setPosition] = useState(
        currentWatermarkPosition || {
            x: 0.1,
            y: 0.1,
            scaleX: backgroundScale,
            scaleY: backgroundScale,
            rotation: 0,
        }
    );

    const watermarkRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const [backgroundSliderValue, setBackgroundSliderValue] = useState(1);
    const stageRef = useRef(null);

    // 处理背景图片缩放滑动条变化的函数
    const handleBackgroundSliderChange = (e) => {
        const newScale = parseFloat(e.target.value);
        setBackgroundSliderValue(newScale);
    };

    // 更新参考线的函数
    const updateGuideLines = () => {
        const stage = stageRef.current;
        if (!stage) return;

        const layer = stage.getLayers()[0];
        const guideLines = layer.find(".guide-line");
        guideLines.forEach((line) => line.destroy());

        drawGuideLines(
            layer,
            backgroundImageSize.width,
            backgroundImageSize.height
        );
    };

    // 更新背景图片宽度的状态
    const updateBackgroundWidth = () => {
        const vwWidth = window.innerHeight * 0.8;
        setBackgroundFixWidthVW(vwWidth);
    };

    // 添加resize事件监听器
    useEffect(() => {
        window.addEventListener("resize", updateBackgroundWidth);
        const handleResize = () => {
            updateBackgroundWidth();
            updateWatermarkSize(currentScale);
        };
        window.addEventListener("resize", handleResize);
        handleResize();
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
            if (width > 0 && height > 0) {
                setWatermarkSize({
                    width: width,
                    height: height,
                });
            }
        }
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
        }
    }, [backgroundImage, backgroundImageStatus, backgroundFixWidthVW]);

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

    // 清理背景图片的 URL
    useEffect(() => {
        return () => {
            if (backgroundImageFile) {
                URL.revokeObjectURL(URL.createObjectURL(backgroundImageFile));
            }
        };
    }, [backgroundImageFile]);

    useEffect(() => {
        if (currentWatermarkPosition) {
            setPosition(currentWatermarkPosition);
        }
    }, [currentWatermarkPosition]);

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

    // 按钮回调函数，设置水印位置
    const onTopLeft = () => updateWatermarkPosition(0, 0);
    const onTopMid = () => updateWatermarkPosition(0.5, 0);
    const onTopRight = () => updateWatermarkPosition(1, 0);
    const onMidLeft = () => updateWatermarkPosition(0, 0.5);
    const onCenterMid = () => updateWatermarkPosition(0.5, 0.5);
    const onMidRight = () => updateWatermarkPosition(1, 0.5);
    const onBottomLeft = () => updateWatermarkPosition(0, 1);
    const onBottomMid = () => updateWatermarkPosition(0.5, 1);
    const onBottomRight = () => updateWatermarkPosition(1, 1);

    return (
        <div className="flex flex-1 flex-col space-y-4">
            <div className="relative bg-muted rounded-lg overflow-hidden">
                <Stage
                    width={backgroundImageSize.width}
                    height={backgroundImageSize.height}
                    ref={stageRef}
                    className="mx-auto"
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
                                <Transformer
                                    ref={transformerRef}
                                    enabledAnchors={[
                                        "top-left",
                                        "top-right",
                                        "bottom-left",
                                        "bottom-right",
                                    ]}
                                    keepRatio
                                    centeredScaling={false}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (
                                            newBox.width < 5 ||
                                            newBox.height < 5
                                        ) {
                                            return oldBox;
                                        }
                                        return newBox;
                                    }}
                                />
                            </>
                        )}
                    </Layer>
                </Stage>
            </div>

            <div className="space-y-4">
                <Tabs defaultValue="batch" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger
                            value="batch"
                            onClick={() => setIsBatch(true)}
                            className={isBatch ? "bg-primary text-primary-foreground" : ""}
                        >
                            批量操作
                        </TabsTrigger>
                        <TabsTrigger
                            value="single"
                            onClick={() => setIsBatch(false)}
                            className={!isBatch ? "bg-primary text-primary-foreground" : ""}
                        >
                            单独操作
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="grid grid-cols-3 gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onTopLeft}
                                >
                                    <ArrowUpLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>左上角</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onTopMid}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>上</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onTopRight}
                                >
                                    <ArrowUpRight className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>右上角</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onMidLeft}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>左</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onCenterMid}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>中</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onMidRight}
                                >
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>右</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onBottomLeft}
                                >
                                    <ArrowDownLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>左下角</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onBottomMid}
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>下</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onBottomRight}
                                >
                                    <ArrowDownRight className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>右下角</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
};

export default WatermarkEditor;