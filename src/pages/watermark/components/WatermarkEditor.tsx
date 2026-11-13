import WatermarkBlurPreview from "./WatermarkBlurPreview";
import PreviewMinimap from './PreviewMinimap';
import {PreviewZoomControl, WatermarkColorControl} from "./PreviewAppearanceControls";
import {fitPreviewImage, previewPositionForCenter, previewCenterForPosition} from "../preview-zoom";
import InlineWatermarkTextEditor, { type InlineWatermarkEditorHandle } from './InlineWatermarkTextEditor';
import { useStableWatermarkImage } from "../hooks/useStableWatermarkImage";
/* eslint-disable react/display-name */
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
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
import { WatermarkPosition, MixedWatermarkConfig } from "@/types";
import {
    extractDominantColors,
    applyColorToWatermark,
    getAdaptiveWatermarkRenderMetrics,
} from "@/utils/watermark-editor";
import ImageWithFixedWidth from "@/pages/watermark/components/ImageWithFixedWidth";
import "../watermark.css";

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
    settingsOpen?: boolean;
    onColorPanelOpenChange?: (open: boolean) => void;
    textConfig?: MixedWatermarkConfig;
    onTextChange?: (patch: Partial<MixedWatermarkConfig>) => void;
    previewZoom?: number;
    onPreviewZoomChange?: (value: number) => void;
    batchEditing?: boolean;
    onBatchEditingChange?: (value:boolean) => void;
    backgroundPreviewUrl: string;
    backgroundOriginalWidth?: number;
    currentWatermarkPosition?: WatermarkPosition;
    onTransform: (position: WatermarkPosition) => void;
    onAllTransform: (position: WatermarkPosition) => void;
    onSmartPosition: (batch: boolean, scale: number) => Promise<void>;
    watermarkColor?: string;
    selectedColor?: string;
    automaticColor?: boolean;
    onTintChange?: (color: string, batch: boolean) => void | Promise<void>;
    onColorChange?: (watermarkUrl: string, batch: boolean) => void;
    onTextColorChange?: (color: string, batch: boolean) => void;
    watermarkBlur?: boolean;
    watermarkOpacity?: number; // 新增透明度属性
    onWatermarkOpacityChange?: (value: number) => void;
}

const WatermarkEditor: React.FC<WatermarkEditorProps> = ({
    watermarkUrl, settingsOpen = false, onColorPanelOpenChange,
    textConfig, onTextChange,
    batchEditing, onBatchEditingChange, previewZoom, onPreviewZoomChange,
    backgroundPreviewUrl,
    backgroundOriginalWidth,
    currentWatermarkPosition,
    onTransform,
    onAllTransform,
    onSmartPosition,
    watermarkColor, selectedColor, automaticColor, onTintChange,
    onColorChange,
    onTextColorChange,
    watermarkBlur = false,
    watermarkOpacity = 1, // 默认不透明
    onWatermarkOpacityChange,
}) => {
    // 背景图片相关设置
    const [previewBounds,setPreviewBounds] = useState({width:600,height:400});
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

    // 当前设置的比例，为了方便按钮操作（这是水印的比例，不是背景的比例）
    const [currentScale, setCurrentScale] = useState(1);

    // 批量or单独
    const [localBatch, setLocalBatch] = useState<boolean>(false);
    const isBatch = batchEditing ?? localBatch;
    const setIsBatch = (value:boolean) => {setLocalBatch(value);onBatchEditingChange?.(value);};

    // 添加选择位置的状态
    const [selectedPosition, setSelectedPosition] = useState("center");
    const [isFindingPosition, setIsFindingPosition] = useState(false);

    // 水印相关设置
    // logo颜色状态
    const [dominantColors, setDominantColors] = useState<DominantColor[]>([]);
    const [coloredWatermarkUrl, setColoredWatermarkUrl] =
        useState(watermarkUrl);
    const colorRequest = useRef(0);
    const watermarkImage = useStableWatermarkImage(coloredWatermarkUrl);
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
    const inlineEditorRef = useRef<InlineWatermarkEditorHandle>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const stageRef = useRef<Konva.Stage>(null);

    const [localColor, setLocalColor] = useState("");

    // 预览缩放状态
    const [localPreviewScale, setLocalPreviewScale] = useState(1);
    const previewScale = previewZoom ?? localPreviewScale;
    const setPreviewScale = (next: number | ((previous: number) => number)) => {
        const value = typeof next === 'function' ? next(previewScale) : next;
        setLocalPreviewScale(value);
        onPreviewZoomChange?.(value);
    };
    const [previewCenter, setPreviewCenter] = useState({ x: .5, y: .5 });
    const previewPos = previewPositionForCenter(previewCenter, previewScale,
        previewBounds.width, previewBounds.height, backgroundImageSize.width, backgroundImageSize.height);
    useEffect(() => {
        if (previewScale === 1) setPreviewCenter({x: .5, y: .5});
    }, [previewScale]);

    // Toolbar state
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
    const [toolbarPos, setToolbarPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [toolbarOrientation, setToolbarOrientation] = useState<
        "horizontal" | "vertical"
    >("horizontal");
    const toolbarRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [colorPanelOpen, setColorPanelOpen] = useState(false);
    const colorPanelVisible = colorPanelOpen && !settingsOpen;
    useEffect(() => {if (settingsOpen) setColorPanelOpen(false);}, [settingsOpen]);
    const changeColorPanelOpen = (open: boolean) => {setColorPanelOpen(open); onColorPanelOpenChange?.(open);};
    const isDraggingRef = useRef(false);

    const isVerticalLayout = toolbarOrientation === "vertical";

    // 当操作栏展开状态变化时，检查并修正位置确保在容器内
    useEffect(() => {
        if (
            isToolbarExpanded &&
            toolbarRef.current &&
            containerRef.current &&
            toolbarPos
        ) {
            const toolbarEl = toolbarRef.current;
            const containerEl = containerRef.current;
            const toolbarRect = toolbarEl.getBoundingClientRect();
            const containerWidth = containerEl.clientWidth;
            const containerHeight = containerEl.clientHeight;
            const padding = 16;

            let newX = toolbarPos.x;
            let newY = toolbarPos.y;
            let needsUpdate = false;

            const minX = padding;
            const maxX = containerWidth - toolbarRect.width - padding;
            const minY = padding;
            const maxY = containerHeight - toolbarRect.height - padding;

            if (newX < minX) {
                newX = minX;
                needsUpdate = true;
            } else if (newX > maxX) {
                newX = maxX;
                needsUpdate = true;
            }

            if (newY < minY) {
                newY = minY;
                needsUpdate = true;
            } else if (newY > maxY) {
                newY = maxY;
                needsUpdate = true;
            }

            if (needsUpdate) {
                setToolbarPos({ x: newX, y: newY });
            }
        }
    }, [isToolbarExpanded]);

    const handleToolbarMouseDown = (e: React.MouseEvent) => {
        if (
            (e.target as HTMLElement).closest(
                'button, input, [role="combobox"], .no-drag'
            )
        ) {
            return;
        }

        e.preventDefault();

        const toolbarEl = toolbarRef.current;
        const containerEl = containerRef.current;
        if (!toolbarEl || !containerEl) return;

        const containerRect = containerEl.getBoundingClientRect();
        const toolbarRect = toolbarEl.getBoundingClientRect();

        // Calculate start position relative to container
        const startLeft =
            toolbarRect.left - containerRect.left - (containerEl.clientLeft || 0);
        const startTop =
            toolbarRect.top - containerRect.top - (containerEl.clientTop || 0);

        const initialMouseX = e.clientX;
        const initialMouseY = e.clientY;
        isDraggingRef.current = false;

        // Temporarily disable transition for smooth dragging
        toolbarEl.style.transition = "none";

        // Switch to absolute positioning with calculated coordinates
        toolbarEl.style.left = `${startLeft}px`;
        toolbarEl.style.top = `${startTop}px`;
        toolbarEl.style.bottom = "auto";
        toolbarEl.style.right = "auto";
        toolbarEl.style.transform = "none";

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - initialMouseX;
            const dy = moveEvent.clientY - initialMouseY;

            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                isDraggingRef.current = true;
            }

            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            // Constrain within container
            const padding = 16;
            const containerWidth = containerEl.clientWidth;
            const containerHeight = containerEl.clientHeight;
            const maxLeft = containerWidth - toolbarRect.width - padding;
            const maxTop = containerHeight - toolbarRect.height - padding;

            newLeft = Math.max(padding, Math.min(newLeft, maxLeft));
            newTop = Math.max(padding, Math.min(newTop, maxTop));

            toolbarEl.style.left = `${newLeft}px`;
            toolbarEl.style.top = `${newTop}px`;
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);

            const dx = upEvent.clientX - initialMouseX;
            const dy = upEvent.clientY - initialMouseY;

            // Clear manual transition override
            toolbarEl.style.transition = "";

            let finalX = startLeft + dx;
            let finalY = startTop + dy;

            // Constrain within container
            const padding = 16;
            const containerWidth = containerEl.clientWidth;
            const containerHeight = containerEl.clientHeight;
            const maxLeft = containerWidth - toolbarRect.width - padding;
            const maxTop = containerHeight - toolbarRect.height - padding;

            finalX = Math.max(padding, Math.min(finalX, maxLeft));
            finalY = Math.max(padding, Math.min(finalY, maxTop));

            setToolbarPos({
                x: finalX,
                y: finalY,
            });

            // Calculate new orientation based on position relative to container edges
            if (isDraggingRef.current) {
                // Use the center of the toolbar for distance calculation
                const centerX = finalX + toolbarRect.width / 2;
                const centerY = finalY + toolbarRect.height / 2;

                const distToLeft = centerX;
                const distToRight = containerWidth - centerX;
                const distToTop = centerY;
                const distToBottom = containerHeight - centerY;

                const minSideDist = Math.min(distToLeft, distToRight);
                const minVerticalDist = Math.min(distToTop, distToBottom);

                // If closer to sides than to top/bottom, switch to vertical
                if (minSideDist < minVerticalDist) {
                    setToolbarOrientation("vertical");
                } else {
                    setToolbarOrientation("horizontal");
                }
            }

            // If not dragging, treat as click
            if (!isDraggingRef.current && !isToolbarExpanded) {
                setIsToolbarExpanded(true);
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const applyWatermarkColor = async (color: string) => {
        if (onTextColorChange) {onTextColorChange(color, isBatch); return;}
        if (onTintChange) {await onTintChange(color, isBatch); return;}
        const request = ++colorRequest.current;
        try {
            const url = color === "transparent" ? watermarkUrl : await applyColorToWatermark(watermarkUrl, color);
            if (request !== colorRequest.current) return;
            setLocalColor(color === "transparent" ? "" : color);
            setColoredWatermarkUrl(url);
            onColorChange?.(url, isBatch);
        } catch (error) {console.error("应用水印颜色失败:", error);}
    };

    // 当水印URL改变时，重置彩色水印URL
    useEffect(() => {
        setColoredWatermarkUrl(watermarkUrl);
    }, [watermarkUrl]);

    // 父组件保存的是已着色的水印图片 URL，直接用于预览。
    useEffect(() => {
        setColoredWatermarkUrl(watermarkColor || watermarkUrl);
    }, [watermarkColor, watermarkUrl]);

    // 更新参考线的函数
    const updateGuideLines = () => {
        const stage = stageRef.current;
        if (!stage) return;

        const layer = stage.getLayers()[0];
        if (!layer) return;
        const guideLines = layer.find(".guide-line");
        guideLines.forEach((line) => line.destroy());

        drawGuideLines(
            layer,
            backgroundImageSize.width,
            backgroundImageSize.height
        );
    };

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const measure = () => setPreviewBounds({width:Math.max(1,container.clientWidth),height:Math.max(1,container.clientHeight)});
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // 更新水印尺寸
    const updateWatermarkSize = (scale) => {
        if (watermarkImage && backgroundImage) {
            const renderMetrics = getAdaptiveWatermarkRenderMetrics(
                backgroundImage.naturalWidth,
                backgroundImage.naturalHeight,
                watermarkImage,
                scale
            );
            const width = renderMetrics.width * backgroundScale;
            const height = renderMetrics.height * backgroundScale;

            if (width > 0 && height > 0) {
                setWatermarkSize({ width, height });
            }
        }
    };

    // 当背景图片预览地址改变时，更新背景图片的 URL
    useEffect(() => {
        setBackgroundImageUrl(backgroundPreviewUrl);
        setPreviewCenter({x: .5, y: .5});
        if (previewScale !== 1) setPreviewScale(1);
    }, [backgroundPreviewUrl]);

    // 当缩放或图片变化时，刷新用于边界判断的尺寸
    useEffect(() => {
        updateWatermarkSize(currentScale);
    }, [currentScale, watermarkImage, backgroundImage]);

    // 当背景图片加载完成时，更新背景图片的尺寸
    useEffect(() => {
        if (backgroundImage && backgroundImageStatus === "loaded") {
            const {width, height, scale} = fitPreviewImage(backgroundImage.naturalWidth,
                backgroundImage.naturalHeight, previewBounds.width, previewBounds.height);
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
        previewBounds,
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
        if (!layer) return;
        drawGuideLines(
            layer,
            backgroundImageSize.width,
            backgroundImageSize.height
        );
    }, [backgroundImageSize.width, backgroundImageSize.height]);

    useEffect(() => {
        if (currentWatermarkPosition) {
            setPosition(currentWatermarkPosition);
            setCurrentScale(currentWatermarkPosition.scaleX);
            setSelectedPosition("");
        }
    }, [currentWatermarkPosition]);

    const onWatermarkClick = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (watermarkRef.current && transformerRef.current) {
            transformerRef.current.nodes([watermarkRef.current]);
            transformerRef.current.getLayer().batchDraw();
        }
        inlineEditorRef.current?.edit(event);
    };

    useEffect(() => {
        // 同步用于边界判断的水印尺寸（预览前的“原图尺寸”）
        if (!backgroundImage || !watermarkImage) return;

        // 与渲染时 fixedWidth 完全一致的计算逻辑：基于背景图较短边的 10%
        const renderMetrics = getAdaptiveWatermarkRenderMetrics(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight,
            watermarkImage,
            currentScale
        );
        // watermarkSize 存储的是未乘以 backgroundScale 的“原图尺寸”，
        // 后续在边界判断里会乘以 backgroundScale 转为预览尺寸
        setWatermarkSize({
            width: renderMetrics.width,
            height: renderMetrics.height,
        });
    }, [backgroundImage, watermarkImage, currentScale]);

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        let newX = node.x();
        let newY = node.y();

        // 统一渲染尺寸：标准10% * currentScale * backgroundScale
        if (!watermarkImage || !backgroundImage) return;

        const renderMetrics = getAdaptiveWatermarkRenderMetrics(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight,
            watermarkImage,
            currentScale
        );
        const renderWidth = renderMetrics.width * backgroundScale;
        const renderHeight = renderMetrics.height * backgroundScale;

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
        const previewMetrics =
            watermarkImage && backgroundImage
                ? getAdaptiveWatermarkRenderMetrics(
                      backgroundImage.naturalWidth,
                      backgroundImage.naturalHeight,
                      watermarkImage,
                      nextScale
                  )
                : { width: 0, height: 0 };
        const previewWatermarkWidth = previewMetrics.width * backgroundScale;
        const previewWatermarkHeight = previewMetrics.height * backgroundScale;

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

        const renderMetrics = getAdaptiveWatermarkRenderMetrics(
            backgroundImage.naturalWidth,
            backgroundImage.naturalHeight,
            watermarkImage,
            currentScale
        );
        const renderWidth = renderMetrics.width * backgroundScale;
        const renderHeight = renderMetrics.height * backgroundScale;

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
        if (value === "smart") {
            setIsFindingPosition(true);
            void onSmartPosition(isBatch, currentScale)
                .catch((error) => {
                    console.error("智能定位失败:", error);
                    alert(error instanceof Error ? error.message : "智能定位失败，请重试");
                })
                .finally(() => {
                    setIsFindingPosition(false);
                    setSelectedPosition("");
                });
            return;
        }
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
        if (!selectedPosition || selectedPosition === "smart") return;
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
        <div className="wm-preview-workspace flex min-h-0 min-w-0 flex-1 flex-col relative group">
            <div
                ref={containerRef}
                className="wm-preview-viewport relative min-h-0 flex-1 rounded-2xl overflow-hidden bg-stone-200/50 dark:bg-slate-900/70 border border-slate-200/50 shadow-inner"
            >
                <Stage
                    style={{position: 'absolute', inset: 0}}
                    width={previewBounds.width}
                    height={previewBounds.height}
                    scale={{ x: previewScale, y: previewScale }}
                    x={previewPos.x}
                    y={previewPos.y}
                    draggable={previewScale > 1}
                    dragBoundFunc={nextPosition => previewPositionForCenter(
                        previewCenterForPosition(nextPosition, previewScale, previewBounds.width,
                            previewBounds.height, backgroundImageSize.width, backgroundImageSize.height),
                        previewScale, previewBounds.width, previewBounds.height,
                        backgroundImageSize.width, backgroundImageSize.height)}
                    onDragMove={event => {
                        if (event.target === event.target.getStage()) setPreviewCenter(previewCenterForPosition(
                            event.target.position(), previewScale, previewBounds.width, previewBounds.height,
                            backgroundImageSize.width, backgroundImageSize.height));
                    }}
                    onDragEnd={(e) => {
                        if (e.target === e.target.getStage()) {
                            const center = previewCenterForPosition(e.target.position(), previewScale,
                                previewBounds.width, previewBounds.height, backgroundImageSize.width, backgroundImageSize.height);
                            e.target.position(previewPositionForCenter(center, previewScale, previewBounds.width,
                                previewBounds.height, backgroundImageSize.width, backgroundImageSize.height));
                            setPreviewCenter(center);
                        }
                    }}
                    ref={stageRef}
                    className={`${
                        previewScale > 1
                            ? "cursor-grab active:cursor-grabbing"
                            : ""
                    }`}
                >
                    <Layer x={(previewBounds.width - backgroundImageSize.width) / 2}
                        y={(previewBounds.height - backgroundImageSize.height) / 2}>
                        {backgroundImage && (
                            <KonvaImage
                                image={backgroundImage}
                                width={backgroundImageSize.width} // 统一，不使用 backgroundSliderValue
                                height={backgroundImageSize.height} // 统一，不使用 backgroundSliderValue
                            />
                        )}
                        {watermarkBlur && backgroundImage && watermarkImage && (
                            <WatermarkBlurPreview photo={backgroundImage} watermark={watermarkImage}
                                width={backgroundImageSize.width} height={backgroundImageSize.height}
                                position={{...position, scaleX: currentScale}}
                                originalWidth={backgroundOriginalWidth || backgroundImage.naturalWidth} />
                        )}
                        {watermarkImage && (
                            <>
                                <ImageWithFixedWidth
                                    src={coloredWatermarkUrl}
                                    fixedWidth={(() => {
                                        if (!backgroundImage || !watermarkImage)
                                            return 0;
                                        const renderMetrics =
                                            getAdaptiveWatermarkRenderMetrics(
                                                backgroundImage.naturalWidth,
                                                backgroundImage.naturalHeight,
                                                watermarkImage,
                                                currentScale
                                            );

                                        // 预览尺寸：原图→舞台的 backgroundScale，不再使用 backgroundSliderValue
                                        return (
                                            renderMetrics.width *
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
                                    onDragMove={event => setPosition(prev => ({...prev,
                                    x: event.target.x() / backgroundImageSize.width,
                                    y: event.target.y() / backgroundImageSize.height}))}
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
                <InlineWatermarkTextEditor ref={inlineEditorRef}
                    sessionKey={`${currentWatermarkPosition?.id}:${Boolean(textConfig?.textOnly)}`}
                    config={textConfig} onChange={patch => onTextChange?.(patch)} />

                {previewScale > 1 && backgroundImage && backgroundImageStatus === 'loaded' && (
                    <PreviewMinimap image={backgroundImage} imageWidth={backgroundImageSize.width} imageHeight={backgroundImageSize.height}
                        viewportWidth={previewBounds.width} viewportHeight={previewBounds.height} zoom={previewScale}
                        center={previewCenter} onCenterChange={setPreviewCenter}/>
                )}

                {/* Floating Toolbar */}
                <div
                    ref={toolbarRef}
                    className={`wm-floating-toolbar absolute z-20 transition-all duration-300 ${
                        !toolbarPos
                            ? "bottom-6 left-1/2 -translate-x-1/2"
                            : ""
                    }`}
                    style={
                        toolbarPos
                            ? {
                                  left: toolbarPos.x,
                                  top: toolbarPos.y,
                                  transform: "none",
                              }
                            : {}
                    }
                    onMouseDown={handleToolbarMouseDown}
                >
                    {isToolbarExpanded ? (
                        <div className="relative group">
                            <div
                                className={`wm-floating-controls bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-black/10 border border-slate-200 dark:border-slate-700 rounded-xl p-2 flex ${
                                    isVerticalLayout ? "flex-col" : "flex-row"
                                } items-center gap-2 transition-colors cursor-move select-none`}
                            >
                                {/* Collapse Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsToolbarExpanded(false);
                                    }}
                                    className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-slate-600 border border-slate-100 transition-opacity no-drag"
                                    title="收起"
                                >
                                    <Icon
                                        icon={
                                            isVerticalLayout
                                                ? "mdi:chevron-up"
                                                : "mdi:chevron-left"
                                        }
                                        className="w-4 h-4"
                                    />
                                </button>

                                {/* Position Group */}
                                <div
                                    className={`flex ${
                                        isVerticalLayout
                                            ? "flex-col"
                                            : "flex-row"
                                    } items-center gap-2`}
                                >
                            {/* <div className="p-1.5 bg-slate-100 text-slate-500 rounded-full">
                                <Icon
                                    icon="mdi:move-resize"
                                    className="w-3.5 h-3.5"
                                />
                            </div> */}
                                        <Select
                                            value={selectedPosition}
                                            onValueChange={handlePositionChange}
                                        >
                                            <SelectTrigger aria-label="水印位置"
                                                className={`h-8 text-xs bg-slate-100 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-blue-500/40 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium text-slate-700 dark:text-slate-200 [&>span]:flex [&>span]:items-center no-drag ${
                                                    isVerticalLayout
                                                        ? "w-8 justify-center px-0 [&>svg]:hidden"
                                                        : "w-[88px] px-2 justify-between"
                                                }`}
                                            >
                                                <SelectValue
                                                    placeholder={
                                                        isVerticalLayout
                                                            ? ""
                                                            : "位置"
                                                    }
                                                />
                                                {isVerticalLayout &&
                                                    !selectedPosition && (
                                                        <Icon
                                                            icon="mdi:move-resize"
                                                            className="w-4 h-4 text-slate-500"
                                                        />
                                                    )}
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-200 bg-white p-1 text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                <SelectGroup>
                                                    <SelectItem value="smart" disabled={isFindingPosition} className="text-xs cursor-pointer">
                                                        {isFindingPosition ? "正在分析图片…" : "智能位置 · 避开复杂区域"}
                                                    </SelectItem>
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
                                                                className="justify-center text-center text-sm py-2.5 cursor-pointer focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-slate-700 dark:focus:text-blue-300 rounded-md pr-2 [&>span.absolute]:hidden data-[state=checked]:bg-blue-100 data-[state=checked]:text-blue-600 dark:data-[state=checked]:bg-slate-700 dark:data-[state=checked]:text-blue-300"
                                                                title={item.t}
                                                            >
                                                                <Icon
                                                                    icon={
                                                                        item.i
                                                                    }
                                                                    className="inline-block w-4 h-4 mr-1.5"
                                                                />
                                                                {item.t}
                                                            </SelectItem>
                                                        ))}
                                                    </div>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>

                            <div
                                className={
                                    isVerticalLayout
                                        ? "w-full h-px bg-slate-200"
                                        : "h-4 w-px bg-slate-200"
                                }
                            ></div>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={`flex ${
                                                isVerticalLayout
                                                    ? "flex-col gap-1"
                                                    : "flex-row gap-2"
                                            } items-center cursor-pointer group/batch select-none no-drag`}
                                        >
                                            <Switch
                                                checked={isBatch}
                                                onCheckedChange={setIsBatch}
                                                aria-label="批量编辑"
                                            />
                                            <button type="button" onClick={() => setIsBatch(!isBatch)}
                                                className={`text-xs font-medium transition-colors ${
                                                    isBatch
                                                        ? "text-blue-600"
                                                        : "text-slate-400 group-hover/batch:text-slate-600"
                                                } w-[24px]`}
                                            >
                                                {isBatch ? "批量" : "单独"}
                                            </button>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {isBatch ? "批量操作" : "操作本图"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        <span className="wm-canvas-divider" aria-hidden="true"/>
                        <div className="wm-canvas-appearance no-drag">
                            <WatermarkColorControl open={colorPanelVisible} onOpenChange={changeColorPanelOpen} color={selectedColor ?? textConfig?.color ?? localColor}
                                opacity={watermarkOpacity} onOpacityChange={onWatermarkOpacityChange}
                                automatic={automaticColor ?? !(selectedColor || localColor)} textMode={Boolean(textConfig)}
                                suggestions={dominantColors.map(item => '#' + [item.r, item.g, item.b].map(channel => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join(''))} onChange={color => void applyWatermarkColor(color)}/>
                            <span className="wm-canvas-divider" aria-hidden="true"/>
                            <PreviewZoomControl value={previewScale} onChange={setPreviewScale}/>
                        </div>


                    </div>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-xl shadow-xl border border-white/60 flex items-center justify-center text-slate-600 hover:scale-110 hover:text-blue-600 transition-all cursor-pointer">
                            <Icon icon="ri:lightbulb-flash-line" className="w-5 h-5" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WatermarkEditor;
