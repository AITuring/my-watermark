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
import { WatermarkPosition, MixedWatermarkConfig } from "./types";
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    RotateCw,
    ZoomIn,
    ZoomOut,
    LayoutGrid,
    Settings,
    Upload,
    Move,
    Palette,
    Sun,
    Moon,
    Images,
} from "lucide-react";
import Konva from "konva";
import ImageWithFixedWidth from "./ImageWithFixedWidth";
import ImageUploader from "./ImageUploader";

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
    stackPreviews?: { id: string; url: string }[];
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

    // Navigation and Action Props
    onBack: () => void;
    onGenerate: () => void;
    isGenerating: boolean;
    generateProgress: number;

    // New Props for enhanced functionality
    watermarkOpacity: number;
    setWatermarkOpacity: (val: number) => void;
    watermarkBlur: boolean;
    setWatermarkBlur: (val: boolean) => void;
    quality: number;
    setQuality: (val: number) => void;
    darkWatermarkEnabled: boolean;
    setDarkWatermarkEnabled: (val: boolean) => void;
    darkWatermarkStrength: number;
    setDarkWatermarkStrength: (val: number) => void;
    watermarkMode: "image" | "mixed";
    setWatermarkMode: (mode: "image" | "mixed") => void;
    mixedWatermarkConfig: MixedWatermarkConfig;
    setMixedWatermarkConfig: React.Dispatch<React.SetStateAction<MixedWatermarkConfig>>;
    onWatermarkUpload: (files: File[]) => void;
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

    onBack,
    onGenerate,
    isGenerating,
    generateProgress,

    watermarkOpacity,
    setWatermarkOpacity,
    watermarkBlur,
    setWatermarkBlur,
    quality,
    setQuality,
    darkWatermarkEnabled,
    setDarkWatermarkEnabled,
    darkWatermarkStrength,
    setDarkWatermarkStrength,
    watermarkMode,
    setWatermarkMode,
    mixedWatermarkConfig,
    setMixedWatermarkConfig,
    onWatermarkUpload,
    stackPreviews = [],
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
    const [position, setPosition] = useState<WatermarkPosition>(() => {
        if (currentWatermarkPosition) {
            return currentWatermarkPosition;
        }
        // 默认设置为中心位置而不是左上角
        return {
            id: "default",
            x: 0.5,
            y: 0.5,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
        };
    });

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

    const [selectedPosition, setSelectedPosition] = useState<string>("");

    // Settings Dialog State
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Position Dialog State
    const [positionDialogOpen, setPositionDialogOpen] = useState(false);

    // Active Tab State
    const [activeTab, setActiveTab] = useState<"transform" | "style" | "position">("transform");

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

    // 统一应用当前位置的辅助函数（与桌面端一致的策略）
    const applySelectedPosition = React.useCallback(
        (value?: string, forceApply = false) => {
            // 只有在强制应用或者没有外部位置时才应用
            if (!forceApply && currentWatermarkPosition) {
                return;
            }

            const pos = value ?? selectedPosition;
            switch (pos) {
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
                    break;
            }
        },
        [selectedPosition, currentWatermarkPosition]
    );

    // Touch Event Handlers
    const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
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
    };

    const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
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
            const scale = (distance / touchStartDistance) * initialScale;
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
            // Consider throttling this if performance is an issue
            onTransform(newPosition);
        }
    };

    const handleTouchEnd = () => {
        setTouchStartDistance(null);
        setTouchStartRotation(null);
    };

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
            setCurrentScale(1);

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
            // 修正：保持水印的 currentScale 为 1（由用户交互再改变）
            setCurrentScale(1);
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
                    id: position.id,
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

    // 修复：改进位置同步逻辑，避免冲突
    useEffect(() => {
        if (currentWatermarkPosition) {
            setPosition(currentWatermarkPosition);
            // 同步更新 selectedPosition 以保持一致性
            const pos = currentWatermarkPosition;
            if (pos.x === 0 && pos.y === 0) setSelectedPosition("topLeft");
            else if (pos.x === 0.5 && pos.y === 0) setSelectedPosition("topCenter");
            else if (pos.x === 1 && pos.y === 0) setSelectedPosition("topRight");
            else if (pos.x === 0 && pos.y === 0.5) setSelectedPosition("middleLeft");
            else if (pos.x === 0.5 && pos.y === 0.5) setSelectedPosition("middleCenter");
            else if (pos.x === 1 && pos.y === 0.5) setSelectedPosition("middleRight");
            else if (pos.x === 0 && pos.y === 1) setSelectedPosition("bottomLeft");
            else if (pos.x === 0.5 && pos.y === 1) setSelectedPosition("bottomCenter");
            else if (pos.x === 1 && pos.y === 1) setSelectedPosition("bottomRight");
        }
    }, [currentWatermarkPosition]);

    // 清理背景图片的 URL
    useEffect(() => {
        if (backgroundImageFile) {
            URL.revokeObjectURL(URL.createObjectURL(backgroundImageFile));
        }
    }, [backgroundImageFile]);

    const updateWatermarkPosition = (percentX: number, percentY: number) => {
        if (!backgroundImage || !watermarkImage) return;

        // 计算水印图片中心的坐标（百分比）
        const centerX = Math.max(0, Math.min(1, percentX));
        const centerY = Math.max(0, Math.min(1, percentY));

        // 计算实际渲染的水印尺寸 - 与 ImageWithFixedWidth 保持一致
        const minDimension = Math.min(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight
        );
        const standardWatermarkSize = minDimension * 0.1;
        const standardScale = standardWatermarkSize / watermarkImage.naturalWidth;
        const finalScale = standardScale * currentScale;

        // 计算实际渲染的水印宽度（与 ImageWithFixedWidth 中的 fixedWidth 一致）
        const renderWidth = watermarkImage.naturalWidth * finalScale * backgroundScale;
        const renderHeight = (watermarkImage.naturalHeight / watermarkImage.naturalWidth) * renderWidth;

        // 计算4像素偏移在预览中的对应值
        const pixelOffset = 4;
        const previewOffsetX = backgroundImage
            ? (pixelOffset / backgroundImage.naturalWidth) * backgroundImageSize.width
            : 0;
        const previewOffsetY = backgroundImage
            ? (pixelOffset / backgroundImage.naturalHeight) * backgroundImageSize.height
            : 0;

        // 计算水印图片左上角的坐标（百分比）
        const leftTopX = centerX - renderWidth / 2 / backgroundImageSize.width;
        const leftTopY = centerY - renderHeight / 2 / backgroundImageSize.height;

        // 调整坐标以确保水印不会超出背景图片的范围（添加4像素偏移）
        const adjustedLeftTopX = Math.max(
            previewOffsetX / backgroundImageSize.width,
            Math.min(
                (backgroundImageSize.width - renderWidth - previewOffsetX) /
                    backgroundImageSize.width,
                leftTopX
            )
        );
        const adjustedLeftTopY = Math.max(
            previewOffsetY / backgroundImageSize.height,
            Math.min(
                (backgroundImageSize.height - renderHeight - previewOffsetY) /
                    backgroundImageSize.height,
                leftTopY
            )
        );

        // 设置水印图片的新位置
        const newPosition = {
            id: position.id,
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

        if (!backgroundImage || !watermarkImage) return;

        // 计算实际渲染的水印尺寸 - 与 ImageWithFixedWidth 保持一致
        const minDimension = Math.min(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight
        );
        const standardWatermarkSize = minDimension * 0.1;
        const standardScale = standardWatermarkSize / watermarkImage.naturalWidth;
        const finalScale = standardScale * currentScale;

        // 计算实际渲染的水印宽度（与 ImageWithFixedWidth 中的 fixedWidth 一致）
        const renderWidth = watermarkImage.naturalWidth * finalScale * backgroundScale;
        const renderHeight = (watermarkImage.naturalHeight / watermarkImage.naturalWidth) * renderWidth;

        // 计算4像素偏移在预览中的对应值
        const pixelOffset = 4;
        const previewOffsetX = backgroundImage
            ? (pixelOffset / backgroundImage.naturalWidth) * backgroundImageSize.width
            : 0;
        const previewOffsetY = backgroundImage
            ? (pixelOffset / backgroundImage.naturalHeight) * backgroundImageSize.height
            : 0;

        // 边界检测
        if (newX < previewOffsetX) newX = previewOffsetX;
        if (newY < previewOffsetY) newY = previewOffsetY;
        if (newX + renderWidth > backgroundImageSize.width - previewOffsetX) {
            newX = backgroundImageSize.width - renderWidth - previewOffsetX;
        }
        if (newY + renderHeight > backgroundImageSize.height - previewOffsetY) {
            newY = backgroundImageSize.height - renderHeight - previewOffsetY;
        }

        node.position({ x: newX, y: newY });

        // 计算百分比位置
        const actualX = newX / backgroundImageSize.width;
        const actualY = newY / backgroundImageSize.height;
        const actualRotation = node.rotation();

        const newPosition = {
            id: position.id,
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

        node.getLayer()?.batchDraw();
    };

    // 更新水印尺寸
    const updateWatermarkSize = (scale) => {
        if (watermarkImage) {
            const standardWatermarkWidth =
                watermarkImage.naturalWidth * watermarkStandardScale;
            const standardWatermarkHeight =
                watermarkImage.naturalHeight * watermarkStandardScale;

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
        const node = e.target as Konva.Image;
        let newX = node.x();
        let newY = node.y();

        // 采用“累加”缩放逻辑
        const scaleFactor = node.scaleX();
        const nextScale = currentScale * scaleFactor;

        // 立即把节点缩放还原为 1，避免与 fixedWidth 叠加
        node.scaleX(1);
        node.scaleY(1);

        // 用 nextScale 计算预览尺寸做边界限制（与桌面端一致的公式）
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

        // 计算4像素偏移在预览中的对应值
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
        if (newX + previewWatermarkWidth > backgroundImageSize.width - previewOffsetX) {
            newX =
                backgroundImageSize.width - previewWatermarkWidth - previewOffsetX;
        }
        if (newY + previewWatermarkHeight > backgroundImageSize.height - previewOffsetY) {
            newY =
                backgroundImageSize.height - previewWatermarkHeight - previewOffsetY;
        }

        const actualX = newX / backgroundImageSize.width;
        const actualY = newY / backgroundImageSize.height;
        const actualRotation = node.rotation();

        setCurrentScale(nextScale);

    const newPosition = {
        id: position.id,
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
    setSelectedPosition("");
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
        if (isBatch) {
            onAllTransform(newPos);
        } else {
            onTransform(newPos);
        }
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
        const factor = action === "increase" ? 1.1 : 0.9;
        const minScale = 0.1;
        const maxScale = 10;
        let nextScale = currentScale * factor;
        nextScale = Math.max(minScale, Math.min(maxScale, nextScale));

        // 计算缩放后水印在预览中的尺寸
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

        // 4px 安全边距换算到预览坐标
        const pixelOffset = 4;
        const previewOffsetX = backgroundImage
            ? (pixelOffset / backgroundImage.naturalWidth) *
              backgroundImageSize.width
            : 0;
        const previewOffsetY = backgroundImage
            ? (pixelOffset / backgroundImage.naturalHeight) *
              backgroundImageSize.height
            : 0;

        // 当前位置（像素）
        let newX = position.x * backgroundImageSize.width;
        let newY = position.y * backgroundImageSize.height;

        // 边界夹紧
        if (newX < previewOffsetX) newX = previewOffsetX;
        if (newY < previewOffsetY) newY = previewOffsetY;
        if (newX + previewWatermarkWidth > backgroundImageSize.width - previewOffsetX) {
            newX = backgroundImageSize.width - previewWatermarkWidth - previewOffsetX;
        }
        if (newY + previewWatermarkHeight > backgroundImageSize.height - previewOffsetY) {
            newY = backgroundImageSize.height - previewWatermarkHeight - previewOffsetY;
        }

        const actualX = backgroundImageSize.width ? newX / backgroundImageSize.width : 0;
        const actualY = backgroundImageSize.height ? newY / backgroundImageSize.height : 0;

        setCurrentScale(nextScale);

        const newPos = {
            id: position.id,
            x: actualX,
            y: actualY,
            scaleX: nextScale,
            scaleY: nextScale,
            rotation: position.rotation,
        };
        setPosition(newPos);

        if (isBatch) {
            onAllTransform(newPos);
        } else {
            onTransform(newPos);
        }

        setSelectedPosition("");
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

    // 修复：处理位置选择变化
    const handlePositionChange = (value: string) => {
        setSelectedPosition(value);
        // 强制应用新选择的位置
        applySelectedPosition(value, true);
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
        <div ref={containerRef} className="relative flex flex-col h-full bg-gray-50 dark:bg-slate-950">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 shadow-sm z-20 dark:border-b dark:border-slate-800">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="-ml-2 group relative w-10 h-10 p-0 overflow-visible hover:bg-transparent"
                >
                    {stackPreviews.length > 0 ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                            {stackPreviews.map((preview, index) => (
                                <div
                                    key={preview.id}
                                    className={`absolute w-7 h-7 rounded-sm overflow-hidden border border-white dark:border-slate-700 shadow-sm transition-all duration-300 ease-out origin-center
                                        ${index === 0 ? 'z-30' : index === 1 ? 'z-20' : 'z-10'}
                                        ${index === 0 ? 'group-hover:-translate-y-1.5 group-hover:-translate-x-1.5 group-hover:-rotate-6' : ''}
                                        ${index === 1 ? 'translate-x-0.5 translate-y-0.5 rotate-3 group-hover:translate-x-1.5 group-hover:translate-y-0 group-hover:rotate-6' : ''}
                                        ${index === 2 ? 'translate-x-1 translate-y-1 rotate-6 group-hover:translate-x-4 group-hover:translate-y-1 group-hover:rotate-12' : ''}
                                    `}
                                >
                                    <img
                                        src={preview.url}
                                        alt="stack"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Images className="h-6 w-6 transition-all duration-300 group-hover:scale-110 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400" />
                    )}
                </Button>
                <div className="font-medium text-lg dark:text-slate-200">
                    {totalImages > 0 ? `${currentIndex + 1} / ${totalImages}` : "编辑水印"}
                </div>
                <Button
                    onClick={onGenerate}
                    disabled={isGenerating}
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700 rounded-full px-6"
                >
                    {isGenerating ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>{Math.round(generateProgress)}%</span>
                        </div>
                    ) : (
                        "保存"
                    )}
                </Button>
            </header>

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-slate-900/80 z-50">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            加载图片中...
                        </p>
                    </div>
                </div>
            )}
            <div className="flex-1 relative flex justify-center items-center overflow-hidden bg-gray-100 dark:bg-slate-950">
                {/* 左右切换按钮 - Increased Z-Index */}
                {totalImages > 1 && (
                    <>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white/80 dark:bg-slate-800/80 dark:text-slate-200 backdrop-blur-sm shadow-md rounded-full w-10 h-10"
                            onClick={handlePrevImage}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white/80 dark:bg-slate-800/80 dark:text-slate-200 backdrop-blur-sm shadow-md rounded-full w-10 h-10"
                            onClick={handleNextImage}
                            disabled={currentIndex === totalImages - 1}
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </>
                )}

                <Stage
                    ref={stageRef}
                    width={backgroundImageSize.width}
                    height={backgroundImageSize.height}
                    className="bg-gray-100 dark:bg-slate-950"
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
                                fixedWidth={(() => {
                                    if (!backgroundImage || !watermarkImage)
                                        return 0;
                                    const minDimension = Math.min(
                                        backgroundImage.naturalWidth,
                                        backgroundImage.naturalHeight
                                    );
                                    const standardWatermarkSize =
                                        minDimension * 0.1; // 以背景较短边的 10% 为标准水印大小
                                    const standardScale =
                                        standardWatermarkSize /
                                        watermarkImage.naturalWidth;
                                    const finalScale =
                                        standardScale * currentScale;

                                    // 预览尺寸
                                    return (
                                        watermarkImage.naturalWidth *
                                        finalScale *
                                        backgroundScale
                                    );
                                })()}
                                x={position.x * backgroundImageSize.width}
                                y={position.y * backgroundImageSize.height}
                                // 固定为 1，避免与 fixedWidth 叠加缩放
                                scaleX={1}
                                scaleY={1}
                                draggable
                                ref={watermarkRef}
                                onClick={onWatermarkClick}
                                onTap={onWatermarkClick}
                                onDragEnd={handleDragEnd}
                                onTransformEnd={handleTransform}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                opacity={watermarkOpacity} // 应用透明度
                                rotation={position.rotation} // 确保旋转属性被传递
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

            {/* 移动端控制面板 - Tabbed Layout */}
            <div className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-20 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {/* Contextual Controls Area */}
                <div className="px-4 py-4 min-h-[80px] flex items-center justify-center">
                    {activeTab === "transform" && (
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs text-gray-400 dark:text-gray-500">旋转</span>
                                <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-full p-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRotate("left")}
                                        className="h-10 w-10 text-gray-600 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                                    >
                                        <RotateCcw className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRotate("right")}
                                        className="h-10 w-10 text-gray-600 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                                    >
                                        <RotateCw className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs text-gray-400 dark:text-gray-500">缩放</span>
                                <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-full p-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleScale("decrease")}
                                        className="h-10 w-10 text-gray-600 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                                    >
                                        <ZoomOut className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleScale("increase")}
                                        className="h-10 w-10 text-gray-600 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                                    >
                                        <ZoomIn className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "style" && (
                        <div className="w-full flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-sm text-gray-500 dark:text-gray-400 w-16">不透明度</span>
                                <Slider
                                    value={[watermarkOpacity]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={(vals) => setWatermarkOpacity(vals[0])}
                                    className="flex-1"
                                />
                                <span className="text-sm text-gray-500 dark:text-gray-400 w-8 text-right">
                                    {Math.round(watermarkOpacity * 100)}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 dark:text-gray-400">水印颜色</span>
                                <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setDarkWatermarkEnabled(false)}
                                        className={`h-8 px-3 rounded-md ${!darkWatermarkEnabled ? 'bg-white dark:bg-slate-700 shadow-sm text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        <Sun className="h-4 w-4 mr-1" /> 浅色
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setDarkWatermarkEnabled(true)}
                                        className={`h-8 px-3 rounded-md ${darkWatermarkEnabled ? 'bg-slate-800 shadow-sm text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        <Moon className="h-4 w-4 mr-1" /> 深色
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "position" && (
                        <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
                            {[
                                { id: "topLeft", label: "↖" },
                                { id: "topCenter", label: "↑" },
                                { id: "topRight", label: "↗" },
                                { id: "middleLeft", label: "←" },
                                { id: "middleCenter", label: "+" },
                                { id: "middleRight", label: "→" },
                                { id: "bottomLeft", label: "↙" },
                                { id: "bottomCenter", label: "↓" },
                                { id: "bottomRight", label: "↘" },
                            ].map((item) => (
                                <Button
                                    key={item.id}
                                    variant={selectedPosition === item.id ? "default" : "outline"}
                                    size="sm"
                                    className={`h-8 w-full ${
                                        selectedPosition === item.id ? "bg-blue-600" : "bg-gray-50 dark:bg-slate-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                                    }`}
                                    onClick={() => handlePositionChange(item.id)}
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center justify-around border-t dark:border-slate-800 px-2 py-2">
                    <Button
                        variant="ghost"
                        className={`flex flex-col items-center gap-1 h-auto py-2 px-4 rounded-xl ${
                            activeTab === "transform" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                        }`}
                        onClick={() => setActiveTab("transform")}
                    >
                        <Move className="h-6 w-6" />
                        <span className="text-[10px] font-medium">调整</span>
                    </Button>
                    <Button
                        variant="ghost"
                        className={`flex flex-col items-center gap-1 h-auto py-2 px-4 rounded-xl ${
                            activeTab === "style" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                        }`}
                        onClick={() => setActiveTab("style")}
                    >
                        <Palette className="h-6 w-6" />
                        <span className="text-[10px] font-medium">样式</span>
                    </Button>
                    <Button
                        variant="ghost"
                        className={`flex flex-col items-center gap-1 h-auto py-2 px-4 rounded-xl ${
                            activeTab === "position" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                        }`}
                        onClick={() => setActiveTab("position")}
                    >
                        <LayoutGrid className="h-6 w-6" />
                        <span className="text-[10px] font-medium">位置</span>
                    </Button>
                    <div className="w-px h-8 bg-gray-200 dark:bg-slate-700 mx-2" />
                    <Button
                        variant="ghost"
                        className="flex flex-col items-center gap-1 h-auto py-2 px-4 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                        onClick={() => setSettingsOpen(true)}
                    >
                        <Settings className="h-6 w-6" />
                        <span className="text-[10px] font-medium">设置</span>
                    </Button>
                </div>
            </div>



            {/* Settings Dialog */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg p-4 max-w-[90vw] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="dark:text-slate-200">水印设置</DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="effect" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="effect">效果</TabsTrigger>
                            <TabsTrigger value="content">内容</TabsTrigger>
                        </TabsList>

                        <TabsContent value="effect" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>模式选择</Label>
                                </div>
                                <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                                    <Button
                                        variant={isBatch ? "secondary" : "ghost"}
                                        className={`flex-1 ${isBatch ? "bg-white shadow-sm" : ""}`}
                                        onClick={() => handleModeChange("batch")}
                                    >
                                        批量模式
                                    </Button>
                                    <Button
                                        variant={!isBatch ? "secondary" : "ghost"}
                                        className={`flex-1 ${!isBatch ? "bg-white shadow-sm" : ""}`}
                                        onClick={() => handleModeChange("single")}
                                    >
                                        单张模式
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="guide-lines">显示辅助线</Label>
                                <Switch
                                    id="guide-lines"
                                    checked={showGuideLines}
                                    onCheckedChange={setShowGuideLines}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>不透明度: {Math.round(watermarkOpacity * 100)}%</Label>
                                </div>
                                <Slider
                                    value={[watermarkOpacity]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={(vals) => setWatermarkOpacity(vals[0])}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="blur-mode">背景模糊</Label>
                                <Switch
                                    id="blur-mode"
                                    checked={watermarkBlur}
                                    onCheckedChange={setWatermarkBlur}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>输出质量: {Math.round(quality * 100)}%</Label>
                                </div>
                                <Slider
                                    value={[quality]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={(vals) => setQuality(vals[0])}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t">
                                <Label htmlFor="dark-watermark">暗水印</Label>
                                <Switch
                                    id="dark-watermark"
                                    checked={darkWatermarkEnabled}
                                    onCheckedChange={setDarkWatermarkEnabled}
                                />
                            </div>

                            {darkWatermarkEnabled && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label>暗水印强度: {Math.round(darkWatermarkStrength * 100)}%</Label>
                                    </div>
                                    <Slider
                                        value={[darkWatermarkStrength]}
                                        min={0.02}
                                        max={0.25}
                                        step={0.01}
                                        onValueChange={(vals) => setDarkWatermarkStrength(vals[0])}
                                    />
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="content" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>水印模式</Label>
                                <Select
                                    value={watermarkMode}
                                    onValueChange={(val: "image" | "mixed") => setWatermarkMode(val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="image">图片水印</SelectItem>
                                        <SelectItem value="mixed">混合水印</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {watermarkMode === "image" ? (
                                <div className="space-y-2">
                                    <Label>上传水印图片</Label>
                                    <ImageUploader
                                        onUpload={onWatermarkUpload}
                                        fileType="水印"
                                        className="w-full"
                                    >
                                        <Button variant="outline" className="w-full">
                                            <Upload className="w-4 h-4 mr-2" />
                                            更换图片
                                        </Button>
                                    </ImageUploader>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>上传图标</Label>
                                        <ImageUploader
                                            onUpload={(files) => {
                                                const reader = new FileReader();
                                                reader.onload = (e) => {
                                                    setMixedWatermarkConfig(prev => ({
                                                        ...prev,
                                                        icon: e.target?.result as string
                                                    }));
                                                };
                                                reader.readAsDataURL(files[0]);
                                            }}
                                            fileType="图标"
                                            className="w-full"
                                        >
                                            <Button variant="outline" className="w-full">
                                                <Upload className="w-4 h-4 mr-2" />
                                                更换图标
                                            </Button>
                                        </ImageUploader>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>第一行文字</Label>
                                        <input
                                            type="text"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={mixedWatermarkConfig.textLine1}
                                            onChange={(e) => setMixedWatermarkConfig(prev => ({ ...prev, textLine1: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>第二行文字</Label>
                                        <input
                                            type="text"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={mixedWatermarkConfig.textLine2}
                                            onChange={(e) => setMixedWatermarkConfig(prev => ({ ...prev, textLine2: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>文字颜色</Label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="h-10 w-20 p-1 rounded border"
                                                value={mixedWatermarkConfig.color}
                                                onChange={(e) => setMixedWatermarkConfig(prev => ({ ...prev, color: e.target.value }))}
                                            />
                                            <input
                                                type="text"
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={mixedWatermarkConfig.color}
                                                onChange={(e) => setMixedWatermarkConfig(prev => ({ ...prev, color: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label>字体大小: {mixedWatermarkConfig.fontSize}px</Label>
                                        </div>
                                        <Slider
                                            value={[mixedWatermarkConfig.fontSize]}
                                            min={12}
                                            max={100}
                                            step={1}
                                            onValueChange={(vals) => setMixedWatermarkConfig(prev => ({ ...prev, fontSize: vals[0] }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>布局方向</Label>
                                        <Select
                                            value={mixedWatermarkConfig.layout}
                                            onValueChange={(val: "horizontal" | "vertical") => setMixedWatermarkConfig(prev => ({ ...prev, layout: val }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="horizontal">水平</SelectItem>
                                                <SelectItem value="vertical">垂直</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MobileWatermarkEditor;
