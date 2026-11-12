import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
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
    onIndexChange?: (index: number) => void;
    footerActions?: React.ReactNode | ((index: number) => React.ReactNode);
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
    images,
    currentIndex,
    open,
    onOpenChange,
    onIndexChange,
    footerActions,
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
        src?: string;
        width?: number;
        height?: number;
        size?: number;
    }>({});
    const [failedSource, setFailedSource] = useState<string>();
    const source = images[Math.min(index, images.length - 1)];
    const dimsText = useMemo(() => {
        return meta.src === source && meta.width && meta.height ? `${meta.width}×${meta.height}` : "";
    }, [meta.src, source, meta.width, meta.height]);
    const sizeText = useMemo(() => {
        if (meta.src !== source || typeof meta.size !== "number") return "";
        return meta.size < 1024 * 1024
            ? `${Math.round(meta.size / 1024)}KB`
            : `${(meta.size / 1024 / 1024).toFixed(2)}MB`;
    }, [meta.src, source, meta.size]);

    useEffect(() => {
        if (!open || !source) return;
        const src = source;
        let cancelled = false;
        const controller = new AbortController();
        setMeta({ src });
        setFailedSource(undefined);
        const img = new Image();
        img.onload = () => {
            if (!cancelled) {
                setMeta((m) => ({
                    ...m,
                    src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                }));
            }
        };
        img.onerror = () => { if (!cancelled) setFailedSource(src); };
        img.src = src;
        (async () => {
            try {
                let size: number | undefined;
                const isBlob = src.startsWith("blob:");
                const isData = src.startsWith("data:");
                if (isData) {
                    const commaIndex = src.indexOf(",");
                    const base64 = commaIndex >= 0 ? src.slice(commaIndex + 1) : "";
                    if (base64) {
                        const padding = (base64.match(/=+$/) || [""])[0].length;
                        size = Math.floor((base64.length * 3) / 4) - padding;
                    }
                } else if (isBlob) {
                    const response = await fetch(src, { signal: controller.signal });
                    const length = response.headers.get('content-length');
                    if (length) size = Number(length);
                    await response.body?.cancel();
                } else {
                    try {
                        const headRes = await fetch(src, { method: "HEAD", signal: controller.signal });
                        const sizeStr = headRes.headers.get("content-length");
                        if (sizeStr) size = Number(sizeStr);
                    } catch { /* Size metadata is optional. */ }
                    if (!size) {
                        const sameOrigin = (() => {
                            try {
                                const u = new URL(src, window.location.href);
                                return u.origin === window.location.origin;
                            } catch {
                                return false;
                            }
                        })();
                        if (sameOrigin) {
                            try {
                                const getRes = await fetch(src, { signal: controller.signal });
                                const blob = await getRes.blob();
                                size = blob.size;
                            } catch { /* Cross-origin metadata may be unavailable. */ }
                        }
                    }
                }
                if (!cancelled) {
                    setMeta((m) => ({ ...m, size }));
                }
            } catch { /* Switching images aborts obsolete metadata requests. */ }
        })();
        return () => {
            cancelled = true;
            controller.abort();
            img.onload = null;
            img.onerror = null;
        };
    }, [open, source]);

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

    useEffect(() => {
        if (open) {
            onIndexChange?.(index);
        }
    }, [index, onIndexChange, open]);

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

    const resetView = () => {
        setScale(1);
        setRotation(0);
        setFlipX(false);
        setFlipY(false);
        setPosition({ x: 0, y: 0 });
    };

    const handleNext = useCallback(() => {
        if (images.length <= 1) return;
        setIndex((prev) => Math.min(prev + 1, images.length - 1));
        resetView();
    }, [images.length]);

    const handlePrev = useCallback(() => {
        if (images.length <= 1) return;
        setIndex((prev) => Math.max(prev - 1, 0));
        resetView();
    }, [images.length]);

    useEffect(() => {
        if (!open || images.length === 0) return;
        const preload = (src: string) => {
            const img = new Image();
            img.src = src;
        };
        const next = index + 1 < images.length ? images[index + 1] : null;
        const prev = index > 0 ? images[index - 1] : null;
        next && preload(next);
        prev && preload(prev);
    }, [open, index, images]);

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

    const renderedFooterActions =
        typeof footerActions === "function" ? footerActions(index) : footerActions;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-transparent border-none">
                <DialogTitle className="sr-only">图片预览</DialogTitle>
                <div className="relative w-full h-full flex flex-col">
                    <div
                        className="flex-1 flex items-center justify-center overflow-hidden"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        onDoubleClick={() =>
                            setScale((prev) => (prev > 1 ? 1 : Math.min(prev + 1, 5)))
                        }
                        style={{
                            cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default",
                        }}
                    >
                        {images.length > 0 && (
                            <div
                                style={{
                                    transform: `translate(${position.x}px, ${position.y}px) scale(${flipX ? -scale : scale}, ${flipY ? -scale : scale}) rotate(${rotation}deg)`,
                                    transition: isDragging ? "none" : "transform 0.2s ease",
                                }}
                                className="origin-center"
                            >
                                {failedSource === source ? (
                                    <p role="alert" className="rounded-md bg-black/70 p-4 text-white">图片暂时无法加载，请关闭后重新选择图片。</p>
                                ) : <img
                                    key={source}
                                    src={source}
                                    alt="预览图片"
                                    className="max-w-full max-h-[calc(90vh-80px)] object-contain"
                                    draggable={false}
                                />}
                            </div>
                        )}
                    </div>

                    {images.length > 1 && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50"
                                onClick={handlePrev}
                                disabled={index <= 0}
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50"
                                onClick={handleNext}
                                disabled={index >= images.length - 1}
                            >
                                <ChevronRight className="h-6 w-6" />
                            </Button>
                        </>
                    )}
                    <div className="max-w-full mx-auto backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] mt-2 rounded-md">
                        <div className="text-white text-xs sm:text-sm text-center py-1">
                            {images.length > 0 && `${index + 1} / ${images.length}`}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2">
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 sm:h-8 sm:w-8 text-white hover:bg-white/20"
                                    onClick={handleZoomOut}
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center w-36 flex-none">
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
                            {renderedFooterActions}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ImagePreview;
