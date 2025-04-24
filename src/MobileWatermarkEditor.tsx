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
import { Slider } from "@/components/ui/slider";
import {
    RotateCcw,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Grid,
    Move,
    CornerRightDown,
    CornerLeftDown,
    CornerLeftUp,
    CornerRightUp,
    AlignCenter,
    AlignHorizontalJustifyCenter,
    AlignVerticalJustifyCenter,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import Konva from "konva";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface MobileWatermarkEditorProps {
    watermarkUrl: string;
    backgroundImageFile: File | null;
    currentWatermarkPosition: WatermarkPosition | undefined;
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

// 绘制辅助线函数
const drawGuideLines = (
    layer: Konva.Layer,
    stageWidth: number,
    stageHeight: number,
    offsetX: number = 0,
    offsetY: number = 0
) => {
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
            points: [
                offsetX,
                offsetY + yPos,
                offsetX + stageWidth,
                offsetY + yPos,
            ],
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
            points: [
                offsetX + xPos,
                offsetY,
                offsetX + xPos,
                offsetY + stageHeight,
            ],
            stroke: lineStroke,
            strokeWidth: lineStrokeWidth,
            dash: dash,
            name: "guide-line", // 给参考线添加名称
        });
        layer.add(verticalLine);
    }

    layer.batchDraw(); // 重新绘制图层以显示所有辅助线
};

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
    // 是否选中水印
    const [isSelected, setIsSelected] = useState(false);
    // 批量or单独
    const [isBatch, setIsBatch] = useState<boolean>(false);

    const watermarkRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 当背景图片文件改变时，更新背景图片的 URL
    useEffect(() => {
        if (backgroundImageFile) {
            const objectURL = URL.createObjectURL(backgroundImageFile);
            setBackgroundImageUrl(objectURL);
            return () => URL.revokeObjectURL(objectURL);
        }
    }, [backgroundImageFile]);

    // 当背景图片加载完成时，更新背景图片的尺寸和舞台尺寸
    useEffect(() => {
        if (backgroundImage && backgroundImageStatus === "loaded") {
            // 计算适合屏幕的图片尺寸
            const containerWidth = window.innerWidth;
            const containerHeight = window.innerHeight * 0.6;

            const imageRatio =
                backgroundImage.naturalWidth / backgroundImage.naturalHeight;
            let width = containerWidth;
            let height = width / imageRatio;

            if (height > containerHeight) {
                height = containerHeight;
                width = height * imageRatio;
            }

            setBackgroundImageSize({ width, height });
            updateGuideLines();
            setStageSize({ width: containerWidth, height: containerHeight });
        }
    }, [backgroundImage, backgroundImageStatus]);

    // 当水印图片加载完成时，更新水印尺寸
    useEffect(() => {
        if (watermarkImage) {
            // 设置水印初始大小为背景图的20%宽度
            const scale =
                (backgroundImageSize.width * 0.2) / watermarkImage.naturalWidth;
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
            const offsetX = (stageSize.width - backgroundImageSize.width) / 2;
            const offsetY = (stageSize.height - backgroundImageSize.height) / 2;
            drawGuideLines(
                layerRef.current,
                backgroundImageSize.width,
                backgroundImageSize.height,
                offsetX,
                offsetY
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

    // 当位置变化时，通知父组件
    useEffect(() => {
        if (currentWatermarkPosition) {
            setPosition(currentWatermarkPosition);
        }
    }, [currentWatermarkPosition]);

    // 清理背景图片的 URL
    useEffect(() => {
        return () => {
            if (backgroundImageFile) {
                URL.revokeObjectURL(URL.createObjectURL(backgroundImageFile));
            }
        };
    }, [backgroundImageFile]);

    // 处理水印拖动结束事件
    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        const newPos = {
            ...position,
            x: e.target.x(),
            y: e.target.y(),
        };
        setPosition(newPos);
        onTransform(newPos);
    };

    // 处理水印变换结束事件
    const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
        if (!watermarkRef.current) return;

        const node = watermarkRef.current;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const rotation = node.rotation();

        const newPos = {
            ...position,
            x: node.x(),
            y: node.y(),
            scaleX,
            scaleY,
            rotation,
        };

        setPosition(newPos);
        onTransform(newPos);
    };

    // 更新参考线的函数
    const updateGuideLines = () => {
        const stage = stageRef.current;
        if (!stage) return;

        // 计算背景图片在舞台上的偏移量
        const offsetX = (stageSize.width - backgroundImageSize.width) / 2;
        const offsetY = (stageSize.height - backgroundImageSize.height) / 2;

        const layer = stage.getLayers()[0];
        const guideLines = layer.find(".guide-line");
        guideLines.forEach((line) => line.destroy());

        drawGuideLines(
            layer,
            backgroundImageSize.width,
            backgroundImageSize.height,
            offsetX,
            offsetY
        );
    };

    // 移动端简化的控制按钮
    const handleRotate = (direction: "left" | "right") => {
        const newRotation =
            position.rotation + (direction === "left" ? -15 : 15);
        const newPos = { ...position, rotation: newRotation };
        setPosition(newPos);
        onTransform(newPos);
    };

    const handleScale = (action: "increase" | "decrease") => {
        const scaleFactor = action === "increase" ? 1.1 : 0.9;
        const newPos = {
            ...position,
            scaleX: position.scaleX * scaleFactor,
            scaleY: position.scaleY * scaleFactor,
        };
        setPosition(newPos);
        onTransform(newPos);
    };

    // 应用到所有图片
    const applyToAll = () => {
        onAllTransform(position);
    };

    // 选择水印
    const selectWatermark = () => {
        setIsSelected(true);
        if (transformerRef.current && watermarkRef.current) {
            transformerRef.current.nodes([watermarkRef.current]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    };

    // 取消选择水印
    const deselectWatermark = () => {
        setIsSelected(false);
        if (transformerRef.current) {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    };

    // 处理舞台点击事件
    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target === e.target.getStage()) {
            deselectWatermark();
        }
    };

    // 处理水印点击事件
    const handleWatermarkClick = () => {
        selectWatermark();
    };

    // 切换辅助线显示状态
    const toggleGuideLines = () => {
        setShowGuideLines(!showGuideLines);
    };

    // 绘制辅助线
    useEffect(() => {
        if (layerRef.current && showGuideLines) {
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
    }, [showGuideLines, backgroundImageSize, layerRef.current]);

    // 九宫格位置设置
    const setWatermarkPosition = (positionName: string) => {
        if (
            !watermarkRef.current ||
            !backgroundImageSize.width ||
            !backgroundImageSize.height
        )
            return;

        const watermarkWidth = watermarkRef.current.width() * position.scaleX;
        const watermarkHeight = watermarkRef.current.height() * position.scaleY;

        let x = 0;
        let y = 0;

        // 根据位置设置水印坐标
        switch (positionName) {
            case "topLeft":
                x = 10;
                y = 10;
                break;
            case "topCenter":
                x = backgroundImageSize.width / 2 - watermarkWidth / 2;
                y = 10;
                break;
            case "topRight":
                x = backgroundImageSize.width - watermarkWidth - 10;
                y = 10;
                break;
            case "middleLeft":
                x = 10;
                y = backgroundImageSize.height / 2 - watermarkHeight / 2;
                break;
            case "middleCenter":
                x = backgroundImageSize.width / 2 - watermarkWidth / 2;
                y = backgroundImageSize.height / 2 - watermarkHeight / 2;
                break;
            case "middleRight":
                x = backgroundImageSize.width - watermarkWidth - 10;
                y = backgroundImageSize.height / 2 - watermarkHeight / 2;
                break;
            case "bottomLeft":
                x = 10;
                y = backgroundImageSize.height - watermarkHeight - 10;
                break;
            case "bottomCenter":
                x = backgroundImageSize.width / 2 - watermarkWidth / 2;
                y = backgroundImageSize.height - watermarkHeight - 10;
                break;
            case "bottomRight":
                x = backgroundImageSize.width - watermarkWidth - 10;
                y = backgroundImageSize.height - watermarkHeight - 10;
                break;
            default:
                break;
        }

        const newPos = { ...position, x, y };
        setPosition(newPos);
        onTransform(newPos);
    };

    // 处理位置选择变化
    const handlePositionChange = (value: string) => {
        setWatermarkPosition(value);
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
        <div ref={containerRef} className="flex flex-col h-full">
            <div className="flex-1 relative">
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
                    width={stageSize.width}
                    height={stageSize.height}
                    className="bg-gray-100"
                    onClick={handleStageClick}
                    onTap={handleStageClick}
                >
                    <Layer ref={layerRef}>
                        {backgroundImage && (
                            <KonvaImage
                                image={backgroundImage}
                                width={backgroundImageSize.width}
                                height={backgroundImageSize.height}
                                x={
                                    (stageSize.width -
                                        backgroundImageSize.width) /
                                    2
                                }
                                y={
                                    (stageSize.height -
                                        backgroundImageSize.height) /
                                    2
                                }
                            />
                        )}
                        {watermarkImage && (
                            <KonvaImage
                                ref={watermarkRef}
                                image={watermarkImage}
                                x={position.x}
                                y={position.y}
                                scaleX={position.scaleX}
                                scaleY={position.scaleY}
                                rotation={position.rotation}
                                draggable
                                onClick={handleWatermarkClick}
                                onTap={handleWatermarkClick}
                                onDragEnd={handleDragEnd}
                                onTransformEnd={handleTransformEnd}
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

            {/* 移动端水印控制面板 */}
            <div className="p-3 bg-white border-t">
                {/* 单独/批量选择和九宫格位置选择放在同一行 */}
                <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                        <Select
                            defaultValue="single"
                            onValueChange={handleModeChange}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="选择应用模式" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>应用模式</SelectLabel>
                                    <SelectItem value="single">
                                        单独调整
                                    </SelectItem>
                                    <SelectItem value="batch">
                                        批量调整
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1">
                        <Select onValueChange={handlePositionChange}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="选择水印位置" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>水印位置</SelectLabel>
                                    <SelectItem value="topLeft">
                                        左上角
                                    </SelectItem>
                                    <SelectItem value="topCenter">
                                        上居中
                                    </SelectItem>
                                    <SelectItem value="topRight">
                                        右上角
                                    </SelectItem>
                                    <SelectItem value="middleLeft">
                                        左居中
                                    </SelectItem>
                                    <SelectItem value="middleCenter">
                                        正中间
                                    </SelectItem>
                                    <SelectItem value="middleRight">
                                        右居中
                                    </SelectItem>
                                    <SelectItem value="bottomLeft">
                                        左下角
                                    </SelectItem>
                                    <SelectItem value="bottomCenter">
                                        下居中
                                    </SelectItem>
                                    <SelectItem value="bottomRight">
                                        右下角
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 旋转和缩放控制 */}
                <div className="flex justify-between mb-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRotate("left")}
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleScale("decrease")}
                    >
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleGuideLines()}
                    >
                        <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleScale("increase")}
                    >
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRotate("right")}
                    >
                        <RotateCw className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => selectWatermark()}
                    >
                        <Move className="h-4 w-4 mr-1" />
                        选择调整
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={applyToAll}
                        disabled={!isBatch}
                    >
                        应用到所有图片
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default MobileWatermarkEditor;
