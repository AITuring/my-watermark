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
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";

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

interface DominantColor {
    color: string;
    count: number;
    r: number;
    g: number;
    b: number;
    brightness: number;
}

interface WatermarkEditorProps {
    watermarkUrl: string;
    backgroundImageFile: File;
    currentWatermarkPosition?: WatermarkPosition;
    onTransform: (position: WatermarkPosition) => void;
    onAllTransform: (position: WatermarkPosition) => void;
    watermarkColor?: string;
    onColorChange?: (color: string) => void;
    watermarkOpacity?: number; // 新增透明度属性
}

const WatermarkEditor: React.FC<WatermarkEditorProps> = ({
    watermarkUrl,
    backgroundImageFile,
    currentWatermarkPosition,
    onTransform,
    onAllTransform,
    watermarkColor,
    onColorChange,
    watermarkOpacity = 1, // 默认不透明
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

    // 水印相对于背景图片的标准化比例（基于图片较短边的百分比）
    const [watermarkStandardScale, setWatermarkStandardScale] = useState(0.1);
    // 当前设置的比例，为了方便按钮操作（这是水印的比例，不是背景的比例）
    const [currentScale, setCurrentScale] = useState(1);

    // 批量or单独
    const [isBatch, setIsBatch] = useState<boolean>(true);

    // 添加选择位置的状态
    const [selectedPosition, setSelectedPosition] = useState("center");

    // 水印相关设置
    // logo颜色状态
    const [dominantColors, setDominantColors] = useState<DominantColor[]>([]);
    const [coloredWatermarkUrl, setColoredWatermarkUrl] =
        useState(watermarkUrl);
    const [isProcessingColor, setIsProcessingColor] = useState(false);
    const [watermarkImage] = useImage(coloredWatermarkUrl);
    const [watermarkSize, setWatermarkSize] = useState({ width: 0, height: 0 });
    const [position, setPosition] = useState<WatermarkPosition>(
        currentWatermarkPosition || {
            id: "default",
            x: 0.5,
            y: 0.5,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
        }
    );

    const watermarkRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const [backgroundSliderValue, setBackgroundSliderValue] = useState(1);
    const stageRef = useRef(null);

    const [customColor, setCustomColor] = useState(""); // 自定义颜色状态

    // 预览缩放状态
    const [previewScale, setPreviewScale] = useState(1);
    const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });

    const handleZoomIn = () => {
        setPreviewScale((prev) => Math.min(prev * 1.2, 5));
    };

    const handleZoomOut = () => {
        setPreviewScale((prev) => {
            const newScale = Math.max(prev / 1.2, 1);
            if (newScale <= 1.05) {
                setPreviewPos({ x: 0, y: 0 });
                return 1;
            }
            return newScale;
        });
    };

    const handleResetZoom = () => {
        setPreviewScale(1);
        setPreviewPos({ x: 0, y: 0 });
    };

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
            console.error("应用水印颜色到水印失败:", error);
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

    // 当传入的水印颜色改变时，应用水印颜色
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
            // updateWatermarkSize(currentScale);
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
        if (watermarkImage && backgroundImage) {
            // 使用与 calculateWatermarkPosition 相同的逻辑
            const minDimension = Math.min(
                backgroundImage.naturalWidth,
                backgroundImage.naturalHeight
            );
            const standardWatermarkSize = minDimension * 0.1;
            const standardScale =
                standardWatermarkSize / watermarkImage.naturalWidth;

            // 应用用户缩放比例
            const finalScale = standardScale * scale;

            const width =
                watermarkImage.naturalWidth * finalScale * backgroundScale;
            const height =
                watermarkImage.naturalHeight * finalScale * backgroundScale;

            if (width > 0 && height > 0) {
                setWatermarkSize({ width, height });
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

    // 当缩放或图片变化时，刷新用于边界判断的尺寸
    useEffect(() => {
        updateWatermarkSize(currentScale);
    }, [currentScale, watermarkImage, backgroundImage]);

    // 当背景图片加载完成时，更新背景图片的尺寸
    useEffect(() => {
        if (backgroundImage && backgroundImageStatus === "loaded") {
            const scaleWidth =
                backgroundFixWidthVW / backgroundImage.naturalWidth;
            const windowHeight = window.innerHeight * 0.82;
            const scaleHeight = windowHeight / backgroundImage.naturalHeight;
            const scale = Math.min(scaleWidth, scaleHeight);

            const ratio =
                backgroundImage.naturalWidth / backgroundImage.naturalHeight;
            const width = windowHeight * ratio;
            const height = windowHeight;
            setBackgroundImageSize({ width, height });
            setBackgroundScale(scale);
            updateGuideLines();
            // setCurrentScale(1); // 重置为1，因为我们现在使用标准化比例

            // 计算水印的标准化比例 - 基于原图较短边的10%
            // if (watermarkImage) {
            //     const minDimension = Math.min(
            //         backgroundImage.naturalWidth,
            //         backgroundImage.naturalHeight
            //     );
            //     const standardWatermarkSize = minDimension * 0.1; // 水印大小为较短边的10%
            //     const standardScale =
            //         standardWatermarkSize / watermarkImage.naturalWidth;
            //     setWatermarkStandardScale(standardScale);
            // }

            // 提取图片颜色
            const colors = extractDominantColors(backgroundImage, 5);
            console.log("colors", colors);
            setDominantColors(colors);
        }
    }, [
        backgroundImage,
        backgroundImageStatus,
        backgroundFixWidthVW,
        watermarkImage,
    ]);

    // 初始化水印尺寸 - 只在水印图片首次加载时设置
    // useEffect(() => {
    //     if (watermarkImage && backgroundImage && watermarkStandardScale === 0.1) {
    //         // 只有当watermarkStandardScale还是初始值时才重新计算
    //         const minDimension = Math.min(
    //             backgroundImage.naturalWidth,
    //             backgroundImage.naturalHeight
    //         );
    //         const standardWatermarkSize = minDimension * 0.1;
    //         const standardScale =
    //             standardWatermarkSize / watermarkImage.naturalWidth;
    //         setWatermarkStandardScale(standardScale);

    //         // 设置预览中的水印大小
    //         setWatermarkSize({
    //             width: watermarkImage.naturalWidth * standardScale,
    //             height: watermarkImage.naturalHeight * standardScale,
    //         });
    //     }
    // }, [watermarkImage, backgroundImage, watermarkStandardScale]);

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

    useEffect(() => {
        // 同步用于边界判断的水印尺寸（预览前的“原图尺寸”）
        if (!backgroundImage || !watermarkImage) return;

        // 与渲染时 fixedWidth 完全一致的计算逻辑：基于背景图较短边的 10%
        const minDimension = Math.min(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight
        );
        const standardWatermarkSize = minDimension * 0.1;
        const standardScale =
            standardWatermarkSize / watermarkImage.naturalWidth;

        const finalScale = standardScale * currentScale;

        // watermarkSize 存储的是未乘以 backgroundScale 的“原图尺寸”，
        // 后续在边界判断里会乘以 backgroundScale 转为预览尺寸
        setWatermarkSize({
            width: watermarkImage.naturalWidth * finalScale,
            height: watermarkImage.naturalHeight * finalScale,
        });
    }, [backgroundImage, watermarkImage, currentScale]);

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        let newX = node.x();
        let newY = node.y();

        // 统一渲染尺寸：标准10% * currentScale * backgroundScale
        if (!watermarkImage || !backgroundImage) return;

        const minDimension = Math.min(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight
        );
        const standardWatermarkSize = minDimension * 0.1;
        const standardScale =
            standardWatermarkSize / watermarkImage.naturalWidth;
        const finalScale = standardScale * currentScale;

        // 与 ImageWithFixedWidth 渲染一致的预览宽高
        const renderWidth =
            watermarkImage.naturalWidth * finalScale * backgroundScale;
        const renderHeight =
            (watermarkImage.naturalHeight / watermarkImage.naturalWidth) *
            renderWidth;

        // 4 像素偏移的预览值（不参与生成，仅用于保持操作体验）
        const pixelOffset = 4;
        const previewOffsetX = backgroundImage
            ? (pixelOffset / backgroundImage.naturalWidth) *
              backgroundImageSize.width
            : 0;
        const previewOffsetY = backgroundImage
            ? (pixelOffset / backgroundImage.naturalHeight) *
              backgroundImageSize.height
            : 0;

        // 边界检查（舞台像素坐标）
        const maxX = backgroundImageSize.width - renderWidth - previewOffsetX;
        const maxY = backgroundImageSize.height - renderHeight - previewOffsetY;

        if (newX < previewOffsetX) newX = previewOffsetX;
        if (newY < previewOffsetY) newY = previewOffsetY;
        if (newX > maxX) newX = maxX;
        if (newY > maxY) newY = maxY;

        node.position({ x: newX, y: newY });

        // 转换为百分比坐标（左上角百分比）
        const actualX = newX / backgroundImageSize.width;
        const actualY = newY / backgroundImageSize.height;
        const actualRotation = node.rotation();

        const newPosition = {
            id: position.id || "default",
            x: actualX,
            y: actualY,
            scaleX: currentScale,
            scaleY: currentScale,
            rotation: actualRotation,
        };

        setPosition(newPosition);
        setSelectedPosition("");

        if (isBatch) {
            onAllTransform(newPosition);
        } else {
            onTransform(newPosition);
        }

        node.getLayer().batchDraw();
    };

    const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target as Konva.Image;
        let newX = node.x();
        let newY = node.y();

        // 本次变换带来的临时缩放因子（保持等比，取 X 即可）
        const scaleFactor = node.scaleX();
        // 合并到全局缩放
        const nextScale = currentScale * scaleFactor;

        // 立即把节点缩放还原成 1，避免与 fixedWidth 叠加产生“弹一下”
        node.scaleX(1);
        node.scaleY(1);

        // 用 nextScale 计算预览尺寸做边界限制
        const previewWatermarkWidth =
            (watermarkImage ? watermarkImage.naturalWidth : 0) *
            watermarkStandardScale *
            nextScale *
            backgroundScale;

        const previewWatermarkHeight =
            (watermarkImage ? watermarkImage.naturalHeight : 0) *
            watermarkStandardScale *
            nextScale *
            backgroundScale;

        const pixelOffset = 4;
        const previewOffsetX = backgroundImage
            ? (pixelOffset / backgroundImage.naturalWidth) *
              backgroundImageSize.width
            : 0;
        const previewOffsetY = backgroundImage
            ? (pixelOffset / backgroundImage.naturalHeight) *
              backgroundImageSize.height
            : 0;

        if (newX < previewOffsetX) newX = previewOffsetX;
        if (newY < previewOffsetY) newY = previewOffsetY;
        if (
            newX + previewWatermarkWidth >
            backgroundImageSize.width - previewOffsetX
        ) {
            newX =
                backgroundImageSize.width -
                previewWatermarkWidth -
                previewOffsetX;
        }
        if (
            newY + previewWatermarkHeight >
            backgroundImageSize.height - previewOffsetY
        ) {
            newY =
                backgroundImageSize.height -
                previewWatermarkHeight -
                previewOffsetY;
        }

        const actualX = newX / backgroundImageSize.width;
        const actualY = newY / backgroundImageSize.height;
        const actualRotation = node.rotation();

        setCurrentScale(nextScale);

        const newPosition = {
            id: position.id || "default",
            x: actualX,
            y: actualY,
            scaleX: nextScale,
            scaleY: nextScale,
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

        if (!watermarkImage || !backgroundImage) return;

        const minDimension = Math.min(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight
        );
        const standardWatermarkSize = minDimension * 0.1;
        const standardScale =
            standardWatermarkSize / watermarkImage.naturalWidth;
        const finalScale = standardScale * currentScale;

        const renderWidth =
            watermarkImage.naturalWidth * finalScale * backgroundScale;
        const renderHeight =
            (watermarkImage.naturalHeight / watermarkImage.naturalWidth) *
            renderWidth;

        const pixelOffset = 4;
        const previewOffsetX = backgroundImage
            ? (pixelOffset / backgroundImage.naturalWidth) *
              backgroundImageSize.width
            : 0;
        const previewOffsetY = backgroundImage
            ? (pixelOffset / backgroundImage.naturalHeight) *
              backgroundImageSize.height
            : 0;

        // 将中心点转换为左上角坐标
        let leftTopX = centerX * backgroundImageSize.width - renderWidth / 2;
        let leftTopY = centerY * backgroundImageSize.height - renderHeight / 2;

        // 边界约束
        if (leftTopX < previewOffsetX) leftTopX = previewOffsetX;
        if (leftTopY < previewOffsetY) leftTopY = previewOffsetY;
        const maxX = backgroundImageSize.width - renderWidth - previewOffsetX;
        const maxY = backgroundImageSize.height - renderHeight - previewOffsetY;
        if (leftTopX > maxX) leftTopX = maxX;
        if (leftTopY > maxY) leftTopY = maxY;

        // 保存为百分比（左上角）
        const actualX = leftTopX / backgroundImageSize.width;
        const actualY = leftTopY / backgroundImageSize.height;

        const newPosition = {
            id: position.id || "default",
            x: actualX,
            y: actualY,
            scaleX: currentScale,
            scaleY: currentScale,
            rotation: position.rotation || 0,
        };

        setPosition(newPosition);
        if (isBatch) {
            onAllTransform(newPosition);
        } else {
            onTransform(newPosition);
        }
    };

    // 添加位置选择处理函数
    const handlePositionChange = (value: string) => {
        setSelectedPosition(value);
        applySelectedPosition(value, true); // 强制应用新选择的位置
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

    // 统一应用当前位置的辅助函数
    const applySelectedPosition = React.useCallback(
        (value?: string, forceApply = false) => {
            // 只有在强制应用或者没有外部位置时才应用
            if (!forceApply && currentWatermarkPosition) {
                return;
            }

            const pos = value ?? selectedPosition;
            switch (pos) {
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
                default:
                    break;
            }
        },
        [
            selectedPosition,
            currentWatermarkPosition,
            onTopLeft,
            onTopMid,
            onTopRight,
            onMidLeft,
            onCenterMid,
            onMidRight,
            onBottomLeft,
            onBottomMid,
            onBottomRight,
        ]
    );

    // 背景或尺寸变化后，自动重放一次当前位置，确保切换背景后位置生效
    useEffect(() => {
        if (!selectedPosition) return;
        if (!backgroundImage || !watermarkImage) return;
        if (!backgroundImageSize?.width || !backgroundImageSize?.height) return;
        applySelectedPosition();
    }, [
        backgroundImage,
        watermarkImage,
        backgroundImageSize?.width,
        backgroundImageSize?.height,
        backgroundScale,
        currentScale,
        watermarkSize?.width,
        watermarkSize?.height,
        selectedPosition,
        applySelectedPosition,
    ]);

    return (
        <div className="flex flex-1 flex-col h-full relative group">
            <div className="relative flex-1 rounded-2xl overflow-hidden bg-slate-100/50 flex items-center justify-center border border-slate-200/50 shadow-inner">
                <Stage
                    width={backgroundImageSize.width}
                    height={backgroundImageSize.height}
                    scale={{ x: previewScale, y: previewScale }}
                    x={previewPos.x}
                    y={previewPos.y}
                    draggable={previewScale > 1}
                    onDragEnd={(e) => {
                        if (e.target === e.target.getStage()) {
                            setPreviewPos(e.target.position());
                        }
                    }}
                    ref={stageRef}
                    className={`flex items-center justify-center shadow-2xl ${
                        previewScale > 1
                            ? "cursor-grab active:cursor-grabbing"
                            : ""
                    }`}
                >
                    <Layer>
                        {backgroundImage && (
                            <KonvaImage
                                image={backgroundImage}
                                width={backgroundImageSize.width} // 统一，不使用 backgroundSliderValue
                                height={backgroundImageSize.height} // 统一，不使用 backgroundSliderValue
                            />
                        )}
                        {watermarkImage && (
                            <>
                                <ImageWithFixedWidth
                                    src={coloredWatermarkUrl}
                                    fixedWidth={(() => {
                                        if (!backgroundImage || !watermarkImage)
                                            return 0;
                                        const minDimension = Math.min(
                                            backgroundImage.naturalWidth,
                                            backgroundImage.naturalHeight
                                        );
                                        const standardWatermarkSize =
                                            minDimension * 0.1;
                                        const standardScale =
                                            standardWatermarkSize /
                                            watermarkImage.naturalWidth;
                                        const finalScale =
                                            standardScale * currentScale;

                                        // 预览尺寸：原图→舞台的 backgroundScale，不再使用 backgroundSliderValue
                                        return (
                                            watermarkImage.naturalWidth *
                                            finalScale *
                                            backgroundScale
                                        );
                                    })()}
                                    x={position.x * backgroundImageSize.width}
                                    y={position.y * backgroundImageSize.height}
                                    scaleX={1}
                                    scaleY={1}
                                    draggable
                                    ref={watermarkRef}
                                    onClick={onWatermarkClick}
                                    onTap={onWatermarkClick}
                                    onDragEnd={handleDragEnd}
                                    onTransformEnd={handleTransform}
                                    opacity={watermarkOpacity}
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

                {/* Floating Toolbar - Compact & Elegant */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 transition-all duration-500 transform translate-y-0 opacity-100">
                    <div className="bg-white/80 backdrop-blur-xl shadow-2xl shadow-black/10 border border-white/60 rounded-full px-5 py-2.5 flex items-center gap-5 transition-all hover:bg-white hover:scale-[1.01] hover:shadow-black/15">
                        {/* Position Group */}
                        <div className="flex items-center gap-3">
                            {/* <div className="p-1.5 bg-slate-100 text-slate-500 rounded-full">
                                <Icon
                                    icon="mdi:move-resize"
                                    className="w-3.5 h-3.5"
                                />
                            </div> */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Select
                                            value={selectedPosition}
                                            onValueChange={handlePositionChange}
                                        >
                                            <SelectTrigger className="w-[80px] h-8 text-xs bg-transparent border-0 focus:ring-0 px-2 hover:bg-slate-50/50 rounded-md transition-colors font-medium text-slate-600 justify-between [&>span]:flex [&>span]:items-center">
                                                <SelectValue placeholder="选择位置" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel className="text-xs text-slate-500 font-normal px-2 py-1.5">
                                                        快速定位
                                                    </SelectLabel>
                                                    <div className="grid grid-cols-3 gap-1 p-1">
                                                        {[
                                                            {
                                                                v: "top-left",
                                                                i: "mdi:arrow-top-left",
                                                                t: "左上",
                                                            },
                                                            {
                                                                v: "top-mid",
                                                                i: "mdi:arrow-up",
                                                                t: "上",
                                                            },
                                                            {
                                                                v: "top-right",
                                                                i: "mdi:arrow-top-right",
                                                                t: "右上",
                                                            },
                                                            {
                                                                v: "mid-left",
                                                                i: "mdi:arrow-left",
                                                                t: "左",
                                                            },
                                                            {
                                                                v: "center",
                                                                i: "mdi:bullseye",
                                                                t: "居中",
                                                            },
                                                            {
                                                                v: "mid-right",
                                                                i: "mdi:arrow-right",
                                                                t: "右",
                                                            },
                                                            {
                                                                v: "bottom-left",
                                                                i: "mdi:arrow-bottom-left",
                                                                t: "左下",
                                                            },
                                                            {
                                                                v: "bottom-mid",
                                                                i: "mdi:arrow-down",
                                                                t: "下",
                                                            },
                                                            {
                                                                v: "bottom-right",
                                                                i: "mdi:arrow-bottom-right",
                                                                t: "右下",
                                                            },
                                                        ].map((item) => (
                                                            <SelectItem
                                                                key={item.v}
                                                                value={item.v}
                                                                className="justify-center text-center text-xs py-1.5 cursor-pointer focus:bg-blue-50 focus:text-blue-600 rounded-sm pr-2 [&>span.absolute]:hidden data-[state=checked]:bg-blue-100 data-[state=checked]:text-blue-600"
                                                                title={item.t}
                                                            >
                                                                <Icon
                                                                    icon={
                                                                        item.i
                                                                    }
                                                                    className="w-4 h-4"
                                                                />
                                                            </SelectItem>
                                                        ))}
                                                    </div>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </TooltipTrigger>
                                    <TooltipContent>快速定位</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <div className="h-4 w-px bg-slate-200"></div>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <div
                                            className="flex items-center gap-2 cursor-pointer group/batch select-none"
                                            onClick={() => setIsBatch(!isBatch)}
                                        >
                                            <Switch
                                                checked={isBatch}
                                                onCheckedChange={setIsBatch}
                                                className="scale-75 data-[state=checked]:bg-blue-600"
                                            />
                                            <span
                                                className={`text-xs font-medium transition-colors ${
                                                    isBatch
                                                        ? "text-blue-600"
                                                        : "text-slate-400 group-hover/batch:text-slate-600"
                                                } w-[24px]`}
                                            >
                                                {isBatch ? "批量" : "单独"}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {isBatch ? "批量操作" : "操作本图"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {/* Divider */}
                        {dominantColors.length > 0 && (
                            <div className="w-px h-6 bg-slate-200"></div>
                        )}

                        {/* Color Group */}
                        {dominantColors.length > 0 && (
                            <div className="flex items-center gap-2">
                                {/* <div className="p-1.5 bg-slate-100 text-slate-500 rounded-full mr-1">
                                    <Icon
                                        icon="mdi:palette-swatch-outline"
                                        className="w-3.5 h-3.5"
                                    />
                                </div> */}
                                <div className="flex items-center gap-2">
                                    {/* Original */}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    title="清除颜色"
                                                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                                                        !customColor &&
                                                        coloredWatermarkUrl ===
                                                            watermarkUrl
                                                            ? "border-blue-500 bg-blue-50 shadow-sm"
                                                            : "border-slate-200 bg-transparent hover:bg-slate-50"
                                                    }`}
                                                    onClick={() =>
                                                        !isProcessingColor &&
                                                        applyWatermarkColor(
                                                            "transparent"
                                                        )
                                                    }
                                                >
                                                    <Icon
                                                        icon="mdi:image-off-outline"
                                                        className={`w-3.5 h-3.5 ${
                                                            !customColor &&
                                                            coloredWatermarkUrl ===
                                                                watermarkUrl
                                                                ? "text-blue-500"
                                                                : "text-slate-400"
                                                        }`}
                                                    />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>原色</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    {/* Extracted Colors */}
                                    {dominantColors.map((color, index) => (
                                        <TooltipProvider key={index}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        title="应用水印颜色"
                                                        className="w-6 h-6 rounded-full border border-slate-100 shadow-sm hover:scale-110 active:scale-95 transition-all"
                                                        style={{
                                                            backgroundColor:
                                                                color.color,
                                                        }}
                                                        onClick={() =>
                                                            applyWatermarkColor(
                                                                color.color
                                                            )
                                                        }
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <p>{color.color}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}

                                    {/* Custom */}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={`relative w-6 h-6 rounded-full border transition-all hover:scale-110 active:scale-95 flex items-center justify-center overflow-hidden ${
                                                        customColor
                                                            ? "border-blue-500 shadow-sm"
                                                            : "border-slate-200 bg-white hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <div
                                                        className="absolute inset-0"
                                                        style={{
                                                            backgroundColor:
                                                                customColor ||
                                                                "transparent",
                                                        }}
                                                    ></div>
                                                    {!customColor && (
                                                        <Icon
                                                            icon="mdi:plus"
                                                            className="w-4 h-4 text-slate-300"
                                                        />
                                                    )}
                                                    <input
                                                        title="自定义颜色"
                                                        type="color"
                                                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                                        onChange={(e) => {
                                                            setCustomColor(
                                                                e.target.value
                                                            );
                                                            !isProcessingColor &&
                                                                applyWatermarkColor(
                                                                    e.target
                                                                        .value
                                                                );
                                                        }}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>自定义</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="w-px h-6 bg-slate-200"></div>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2">
                            {/* <div className="p-1.5 bg-slate-100 text-slate-500 rounded-full mr-1">
                                <Icon
                                    icon="mdi:magnify"
                                    className="w-3.5 h-3.5"
                                />
                            </div> */}

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                            <button
                                                title="缩小"
                                                className="p-1 hover:bg-white rounded-md text-slate-500 hover:text-blue-600 transition-all disabled:opacity-50"
                                                onClick={handleZoomOut}
                                                disabled={previewScale <= 1}
                                            >
                                                <Icon
                                                    icon="mdi:minus"
                                                    className="w-3.5 h-3.5"
                                                />
                                            </button>
                                            <span className="text-[10px] font-medium text-slate-500 w-9 text-center select-none tabular-nums">
                                                {Math.round(previewScale * 100)}
                                                %
                                            </span>
                                            <button
                                                title="放大"
                                                className="p-1 hover:bg-white rounded-md text-slate-500 hover:text-blue-600 transition-all disabled:opacity-50"
                                                onClick={handleZoomIn}
                                                disabled={previewScale >= 5}
                                            >
                                                <Icon
                                                    icon="mdi:plus"
                                                    className="w-3.5 h-3.5"
                                                />
                                            </button>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>缩放图片</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {previewScale > 1 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                title="重置缩放"
                                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                onClick={handleResetZoom}
                                            >
                                                <Icon
                                                    icon="mdi:refresh"
                                                    className="w-4 h-4"
                                                />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>重置缩放</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WatermarkEditor;
