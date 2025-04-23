import React, { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RotateCcw,
    Maximize,
    Minimize,
} from "lucide-react";

interface ImagePreviewProps {
    images: string[];
    currentIndex: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
    images,
    currentIndex,
    open,
    onOpenChange,
}) => {
    const [index, setIndex] = useState(currentIndex);
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // 重置状态
    useEffect(() => {
        if (open) {
            setIndex(currentIndex);
            setScale(1);
            setRotation(0);
            setPosition({ x: 0, y: 0 });
        }
    }, [open, currentIndex]);

    // 键盘事件处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            switch (e.key) {
                case "ArrowLeft":
                    handlePrev();
                    break;
                case "ArrowRight":
                    handleNext();
                    break;
                case "Escape":
                    onOpenChange(false);
                    break;
                case "+":
                    handleZoomIn();
                    break;
                case "-":
                    handleZoomOut();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, index, images.length]);

    const handleNext = useCallback(() => {
        if (images.length <= 1) return;
        setIndex((prev) => (prev + 1) % images.length);
        resetView();
    }, [images.length]);

    const handlePrev = useCallback(() => {
        if (images.length <= 1) return;
        setIndex((prev) => (prev - 1 + images.length) % images.length);
        resetView();
    }, [images.length]);

    const resetView = () => {
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
    };

    const handleZoomIn = () => {
        setScale((prev) => Math.min(prev + 0.25, 5));
    };

    const handleZoomOut = () => {
        setScale((prev) => Math.max(prev - 0.25, 0.25));
    };

    const handleRotateClockwise = () => {
        setRotation((prev) => prev + 90);
    };

    const handleRotateCounterClockwise = () => {
        setRotation((prev) => prev - 90);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/90 border-none">
                <div className="relative w-full h-full flex flex-col">
                    {/* 顶部工具栏 */}
                    <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-2 bg-black/50">
                        <div className="text-white text-sm">
                            {images.length > 0 && `${index + 1} / ${images.length}`}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white hover:bg-white/20"
                                onClick={handleZoomOut}
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <div className="w-24 flex items-center">
                                <Slider
                                    value={[scale]}
                                    min={0.25}
                                    max={5}
                                    step={0.25}
                                    onValueChange={(value) => setScale(value[0])}
                                    className="w-full"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white hover:bg-white/20"
                                onClick={handleZoomIn}
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white hover:bg-white/20"
                                onClick={handleRotateCounterClockwise}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white hover:bg-white/20"
                                onClick={handleRotateClockwise}
                            >
                                <RotateCw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white hover:bg-white/20"
                                onClick={resetView}
                            >
                                {scale > 1 ? (
                                    <Minimize className="h-4 w-4" />
                                ) : (
                                    <Maximize className="h-4 w-4" />
                                )}
                            </Button>
                            <DialogClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white hover:bg-white/20"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </DialogClose>
                        </div>
                    </div>

                    {/* 图片容器 */}
                    <div
                        className="flex-1 flex items-center justify-center overflow-hidden"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        style={{ cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default" }}
                    >
                        {images.length > 0 && (
                            <div
                                style={{
                                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                                    transition: isDragging ? "none" : "transform 0.2s ease",
                                }}
                                className="origin-center"
                            >
                                <img
                                    src={images[index]}
                                    alt="预览图片"
                                    className="max-w-full max-h-[calc(90vh-80px)] object-contain"
                                    draggable={false}
                                />
                            </div>
                        )}
                    </div>

                    {/* 左右切换按钮 */}
                    {images.length > 1 && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50"
                                onClick={handlePrev}
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50"
                                onClick={handleNext}
                            >
                                <ChevronRight className="h-6 w-6" />
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ImagePreview;