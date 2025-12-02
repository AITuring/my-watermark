import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    X,
    Ruler,
    Weight,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RotateCcw,
    Maximize,
    Minimize,
    FlipHorizontal,
    FlipVertical,
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
    const [flipX, setFlipX] = useState(false);
    const [flipY, setFlipY] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const [meta, setMeta] = useState<{
        width?: number;
        height?: number;
        size?: number;
    }>({});
    const dimsText = useMemo(() => {
        return meta.width && meta.height ? `${meta.width}×${meta.height}` : "";
    }, [meta.width, meta.height]);
    const sizeText = useMemo(() => {
        if (typeof meta.size !== "number") return "";
        return meta.size < 1024 * 1024
            ? `${Math.round(meta.size / 1024)}KB`
            : `${(meta.size / 1024 / 1024).toFixed(2)}MB`;
    }, [meta.size]);

    useEffect(() => {
        if (!open || images.length === 0) return;
        const src = images[index];
        if (!src) return;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) {
                setMeta((m) => ({
                    ...m,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                }));
            }
        };
        img.src = src;
        (async () => {
            try {
                let size: number | undefined;
                const isBlob = src.startsWith("blob:");
                const isData = src.startsWith("data:");
                if (isData) {
                    // Compute size from base64 data URL
                    const commaIndex = src.indexOf(",");
                    const base64 = commaIndex >= 0 ? src.slice(commaIndex + 1) : "";
                    if (base64) {
                        const padding = (base64.match(/=+$/) || [""])[0].length;
                        size = Math.floor((base64.length * 3) / 4) - padding;
                    }
                } else {
                    // Try HEAD to read Content-Length
                    try {
                        const headRes = await fetch(src, { method: "HEAD" });
                        const sizeStr = headRes.headers.get("content-length");
                        if (sizeStr) size = Number(sizeStr);
                    } catch {}
                    // Fallback: fetch actual resource to measure blob size
                    if (!size) {
                        const sameOrigin = (() => {
                            try {
                                const u = new URL(src, window.location.href);
                                return u.origin === window.location.origin;
                            } catch {
                                return false;
                            }
                        })();
                        if (sameOrigin || isBlob) {
                            try {
                                const getRes = await fetch(src);
                                const blob = await getRes.blob();
                                size = blob.size;
                            } catch {}
                        }
                    }
                }
                if (!cancelled) {
                    setMeta((m) => ({ ...m, size }));
                }
            } catch {}
        })();
        return () => {
            cancelled = true;
        };
    }, [open, index, images]);

    // 重置状态
    useEffect(() => {
        if (open) {
            setIndex(currentIndex);
            setScale(1);
            setRotation(0);
            setFlipX(false);
            setFlipY(false);
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

    useEffect(() => {
        if (!open || images.length === 0) return;
        const preload = (src: string) => {
            const img = new Image();
            img.src = src;
        };
        const next = images[(index + 1) % images.length];
        const prev = images[(index - 1 + images.length) % images.length];
        next && preload(next);
        prev && preload(prev);
    }, [open, index, images]);

    const resetView = () => {
        setScale(1);
        setRotation(0);
        setFlipX(false);
        setFlipY(false);
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
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
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
                    {/* 图片容器 */}
                    <div
                        className="flex-1 flex items-center justify-center overflow-hidden"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        onDoubleClick={() =>
                            setScale((prev) =>
                                prev > 1 ? 1 : Math.min(prev + 1, 5)
                            )
                        }
                        style={{
                            cursor: isDragging
                                ? "grabbing"
                                : scale > 1
                                ? "grab"
                                : "default",
                        }}
                    >
                        {images.length > 0 && (
                            <div
                                style={{
                                    transform: `translate(${position.x}px, ${
                                        position.y
                                    }px) scale(${flipX ? -scale : scale}, ${
                                        flipY ? -scale : scale
                                    }) rotate(${rotation}deg)`,
                                    transition: isDragging
                                        ? "none"
                                        : "transform 0.2s ease",
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
                    <div className="w-full bg-black/50 pb-[env(safe-area-inset-bottom)]">
                        <div className="text-white text-xs sm:text-sm text-center py-1">
                            {images.length > 0 &&
                                `${index + 1} / ${images.length}`}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 p-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                    onClick={handleZoomOut}
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center w-24 sm:w-48 md:w-64 flex-none">
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
                                    className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                    onClick={handleZoomIn}
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                onClick={handleRotateCounterClockwise}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                onClick={handleRotateClockwise}
                            >
                                <RotateCw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                onClick={() => setFlipX((v) => !v)}
                                title="水平翻转"
                            >
                                <FlipHorizontal className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                onClick={() => setFlipY((v) => !v)}
                                title="垂直翻转"
                            >
                                <FlipVertical className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                onClick={resetView}
                            >
                                {scale > 1 ? (
                                    <Minimize className="h-4 w-4" />
                                ) : (
                                    <Maximize className="h-4 w-4" />
                                )}
                            </Button>
                            {dimsText && (
                                    <div className="flex items-center text-white/90 text-[11px] sm:text-xs ml-2">
                                        <Ruler className="h-4 w-4 mr-2" />
                                        <span>{dimsText}</span>
                                    </div>
                                )}

                            {sizeText && (
                                <div className="flex items-center text-white/90 text-[11px] sm:text-xs min-h-10 sm:min-h-8">
                                    <Weight className="h-4 w-4 mr-2" />
                                    <span>{sizeText}</span>
                                </div>
                            )}
                            {/* <DialogClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </DialogClose> */}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ImagePreview;
