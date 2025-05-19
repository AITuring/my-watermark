/* eslint-disable react/display-name */
import React, { useState, useEffect, useRef } from "react";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import Konva from "konva";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import { WatermarkPosition } from "./types";
import { extractDominantColors, applyColorToWatermark } from "./utils";
import ImageWithFixedWidth from "./ImageWithFixedWidth";
import "./watermark.css";

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
    watermarkColor?: string; // 添加当前水印颜色
    onColorChange?: (color: string) => void; // 添加颜色变更回调
}

interface Color {
    color: string; // rgb(255, 255, 255)
    b: number;
    g: number;
    r: number;
    brightness: number;
    count: number;
}

const WatermarkEditor: React.FC<WatermarkEditorProps> = ({
    watermarkUrl,
    backgroundImageFile,
    currentWatermarkPosition,
    onTransform,
    onAllTransform,
    watermarkColor = "",
    onColorChange,
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
    // logo颜色状态
    const [dominantColors, setDominantColors] = useState<Color[]>([]);
    const [coloredWatermarkUrl, setColoredWatermarkUrl] =
        useState(watermarkUrl);
    const [isProcessingColor, setIsProcessingColor] = useState(false);
    const [watermarkImage] = useImage(coloredWatermarkUrl);
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

    const [customColor, setCustomColor] = useState(""); // 自定义颜色状态

    // 应用水印颜色的函数
    const applyWatermarkColor = async (color: string) => {
        if (!color || isProcessingColor) return;

        setIsProcessingColor(true);
        try {
            const newWatermarkUrl = await applyColorToWatermark(
                watermarkUrl,
                color
            );

            setColoredWatermarkUrl(newWatermarkUrl as string);
            onColorChange?.(newWatermarkUrl as string);
        } catch (error) {
            console.error("应用颜色到水印失败:", error);
        } finally {
            // 延迟重置处理状态，避免快速连续点击
            requestAnimationFrame(() => {
                setTimeout(() => {
                    setIsProcessingColor(false);
                }, 300);
            });
        }
    };

    // 当水印URL改变时，重置彩色水印URL
    useEffect(() => {
        setColoredWatermarkUrl(watermarkUrl);
    }, [watermarkUrl]);

    // 当传入的水印颜色改变时，应用颜色
    useEffect(() => {
        if (watermarkColor && watermarkUrl) {
            applyWatermarkColor(watermarkColor);
        } else if (!watermarkColor) {
            setColoredWatermarkUrl(watermarkUrl);
        }
    }, [watermarkColor, watermarkUrl]);

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
            // 提取图片颜色
            const colors = extractDominantColors(backgroundImage, 5);
            console.log("colors", colors);
            setDominantColors(colors);
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
                    className="flex items-center justify-center"
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
                                    src={coloredWatermarkUrl}
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

            <div className="space-y-2">
                <div className="flex flex-col space-y-2">
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-medium">位置调整</div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">
                                单独调整
                            </span>
                            <button
                                type="button"
                                title="切换批量模式"
                                onClick={() => setIsBatch(!isBatch)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isBatch ? "bg-primary" : "bg-gray-200"
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        isBatch
                                            ? "translate-x-4"
                                            : "translate-x-0"
                                    }`}
                                />
                            </button>
                            <span className="text-xs text-muted-foreground">
                                批量模式
                            </span>
                        </div>
                        {/* 使用下拉选择器替代九宫格按钮 */}
                        <div className="flex flex-wrap gap-2">
                            <Select
                                defaultValue="center"
                                onValueChange={(value) => {
                                    switch (value) {
                                        case "top-left":
                                            onTopLeft();
                                            break;
                                        case "top-mid":
                                            onTopMid();
                                            break;
                                        case "top-right":
                                            onTopRight();
                                            break;
                                        case "mid-left":
                                            onMidLeft();
                                            break;
                                        case "center":
                                            onCenterMid();
                                            break;
                                        case "mid-right":
                                            onMidRight();
                                            break;
                                        case "bottom-left":
                                            onBottomLeft();
                                            break;
                                        case "bottom-mid":
                                            onBottomMid();
                                            break;
                                        case "bottom-right":
                                            onBottomRight();
                                            break;
                                    }
                                }}
                            >
                                <SelectTrigger className="w-[90px] h-6 text-xs py-0 px-2">
                                    <SelectValue placeholder="选择位置" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>位置选择</SelectLabel>
                                        <SelectItem value="top-left">
                                            左上角
                                        </SelectItem>
                                        <SelectItem value="top-mid">
                                            上
                                        </SelectItem>
                                        <SelectItem value="top-right">
                                            右上角
                                        </SelectItem>
                                        <SelectItem value="mid-left">
                                            左
                                        </SelectItem>
                                        <SelectItem value="center">
                                            中心
                                        </SelectItem>
                                        <SelectItem value="mid-right">
                                            右
                                        </SelectItem>
                                        <SelectItem value="bottom-left">
                                            左下角
                                        </SelectItem>
                                        <SelectItem value="bottom-mid">
                                            下
                                        </SelectItem>
                                        <SelectItem value="bottom-right">
                                            右下角
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                {/* 颜色选择区域 */}
                {/* 颜色选择区域 */}
{dominantColors.length > 0 && (
    <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">背景主色调</h3>
        <div className="flex gap-2">
            {dominantColors.map((color, index) => (
                <button
                    title="点击应用此颜色"
                    key={index}
                    className={`w-8 h-8 rounded-full transition-opacity duration-200 ${isProcessingColor ? "opacity-50 cursor-not-allowed" : ""}`}
                    style={{ backgroundColor: color.color }}
                    onClick={() =>
                        !isProcessingColor &&
                        applyWatermarkColor(color.color)
                    }
                    disabled={isProcessingColor}
                />
            ))}
            <button
                className={`w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center transition-opacity duration-200 ${isProcessingColor ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() =>
                    !isProcessingColor &&
                    applyWatermarkColor("transparent")
                }
                disabled={isProcessingColor}
            >
                <span className="text-xs">原色</span>
            </button>
            <div className="relative">
                <button
                    title="选择自定义颜色"
                    className={`w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center overflow-hidden transition-opacity duration-200 ${isProcessingColor ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={isProcessingColor}
                >
                    <div
                        className="w-8 h-8 rounded-full absolute inset-0 flex items-center justify-center transition-colors duration-200"
                        style={{
                            backgroundColor:
                                customColor || "#ffffff",
                        }}
                    >
                        {!customColor && (
                            <span className="text-xs">
                                自选
                            </span>
                        )}
                    </div>
                    <input
                        type="color"
                        value={customColor || "#ffffff"}
                        onChange={(e) => {
                            setCustomColor(e.target.value);
                            !isProcessingColor &&
                                applyWatermarkColor(
                                    e.target.value
                                );
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isProcessingColor}
                    />
                </button>
            </div>
        </div>
    </div>
)}
            </div>
        </div>
    );
};

export default WatermarkEditor;
