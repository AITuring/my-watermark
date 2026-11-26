import PreviewMinimap from "@/components/image-workbench/PreviewMinimap";
import { usePreviewImage } from "@/components/image-workbench/usePreviewImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Maximize, Minimize, Redo2, RotateCcw, ScanSearch, Scissors, Undo2 } from "lucide-react";
import React from "react";
import { clamp } from "../helpers";
import type {
    CropImage,
    CropPercent,
    DragMode,
    ViewportRect,
    ViewportSize,
} from "../types";

type CropEditorProps = {
    activeImage: CropImage | null;
    cropPercent: CropPercent | null;
    currentDisplayUrl: string;
    currentDisplayLabel: string;
    displayWidth: number;
    displayHeight: number;
    effectiveZoom: number;
    fitZoom: number;
    customAngle: number;
    viewportRect: ViewportRect;
    viewportSize: ViewportSize;
    shouldShowMinimap: boolean;
    viewportRef: React.RefObject<HTMLDivElement | null>;
    stageRef: React.RefObject<HTMLDivElement | null>;
    onSaveCurrentCrop: () => void;
    onExportCurrent: () => void;
    onCustomAngleChange: (value: number) => void;
    onApplyRotation: (angle: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onZoomChange: React.Dispatch<React.SetStateAction<number>>;
    onStartDrag: (mode: DragMode, event: React.PointerEvent) => void;
    onMinimapCenter: (center: { x: number; y: number }) => void;
};

const handleClassMap: Record<Exclude<DragMode, "new" | "move">, string> = {
    nw: "left-0 top-0 cursor-nwse-resize",
    ne: "right-0 top-0 cursor-nesw-resize",
    sw: "left-0 bottom-0 cursor-nesw-resize",
    se: "right-0 bottom-0 cursor-nwse-resize",
};

export default function CropEditor({
    activeImage,
    cropPercent,
    currentDisplayUrl,
    currentDisplayLabel,
    displayWidth,
    displayHeight,
    effectiveZoom,
    fitZoom,
    customAngle,
    viewportRect,
    viewportSize,
    shouldShowMinimap,
    viewportRef,
    stageRef,
    onSaveCurrentCrop,
    onExportCurrent,
    onCustomAngleChange,
    onApplyRotation,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onZoomChange,
    onStartDrag,
    onMinimapCenter,
}: CropEditorProps) {
    const minimapImage = usePreviewImage(activeImage?.previewUrl ?? "");
    return (
        <Card className="flex min-h-0 flex-1 flex-col rounded-lg border-border/60 bg-background/95 shadow-sm">
            <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                        <CardTitle className="flex shrink-0 items-center gap-2 text-base">
                            <ScanSearch className="h-4 w-4" />
                            编辑
                        </CardTitle>
                        <div className="truncate text-sm text-muted-foreground">
                            {activeImage ? activeImage.name : "还没有选择原图"}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                        <Button
                            size="sm"
                            className="px-2.5 sm:px-3"
                            aria-label="暂存当前裁切" onClick={onSaveCurrentCrop}
                            disabled={!activeImage}
                        >
                            <Scissors className="h-4 w-4" />
                            <span className="hidden sm:inline">暂存</span>
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="px-2.5 sm:px-3"
                            aria-label="单独导出" onClick={onExportCurrent}
                            disabled={!activeImage}
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">导出</span>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                {!activeImage ? (
                    <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
                        从左侧选择一张原图开始裁切
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>原图 {activeImage.width} × {activeImage.height}</span>
                            <span>选区 {Math.round(activeImage.crop.w)} × {Math.round(activeImage.crop.h)}</span>
                            <span>{Math.round(effectiveZoom * 100)}% · {currentDisplayLabel}</span>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col gap-3">
                            <div className="relative flex flex-wrap items-center gap-1.5">
                                    <Button variant="secondary" size="sm" onClick={onUndo} disabled={!canUndo} aria-label="撤销">
                                        <Undo2 className="h-4 w-4" />
                                        <span className="hidden sm:inline">撤销</span>
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={onRedo} disabled={!canRedo} aria-label="重做">
                                        <Redo2 className="h-4 w-4" />
                                        <span className="hidden sm:inline">重做</span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onApplyRotation(90)}
                                        disabled={!activeImage}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        <span className="hidden sm:inline">右转 90°</span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onApplyRotation(-90)}
                                        disabled={!activeImage}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        <span className="hidden sm:inline">左转 90°</span>
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => onZoomChange(fitZoom)}>
                                        <Maximize className="h-4 w-4" />
                                        <span className="hidden sm:inline">适应</span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            onZoomChange((prev) => clamp(prev * 1.5, Math.max(fitZoom * 0.5, 0.01), 4))
                                        }
                                    >
                                        <Maximize className="h-4 w-4" />
                                        <span className="hidden sm:inline">放大</span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            onZoomChange((prev) => clamp(prev / 1.5, Math.max(fitZoom * 0.5, 0.01), 4))
                                        }
                                    >
                                        <Minimize className="h-4 w-4" />
                                        <span className="hidden sm:inline">缩小</span>
                                    </Button>
                                    <details className="ml-auto">
                                        <summary className="cursor-pointer list-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">更多</summary>
                                        <div className="absolute z-20 mt-1 flex items-center gap-2 rounded-md border border-border bg-background p-2 shadow-md">
                                            <Input
                                                aria-label="自定义旋转角度"
                                                type="number"
                                                value={customAngle}
                                                step="0.1"
                                                className="h-8 w-20"
                                                onChange={(e) => onCustomAngleChange(Number(e.target.value || 0))}
                                                placeholder="角度"
                                            />
                                            <Button variant="secondary" size="sm" onClick={() => onApplyRotation(customAngle)} disabled={!activeImage}>应用旋转</Button>
                                        </div>
                                    </details>
                            </div>
                            <div className="relative min-h-0 flex-1">
                                <div ref={viewportRef} className="h-full overflow-auto rounded border bg-black/5">
                                    <div
                                        className="flex min-h-full min-w-full"
                                        style={{
                                            justifyContent:
                                                displayWidth < viewportSize.width ? "center" : "flex-start",
                                            alignItems:
                                                displayHeight < viewportSize.height ? "center" : "flex-start",
                                        }}
                                    >
                                        <div
                                            className="relative inline-block select-none"
                                            ref={stageRef}
                                            onPointerDown={(e) => onStartDrag("new", e)}
                                            style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
                                        >
                                            <img
                                                src={currentDisplayUrl}
                                                alt={activeImage.name}
                                                className="block rounded-lg"
                                                style={{
                                                    width: `${displayWidth}px`,
                                                    height: `${displayHeight}px`,
                                                    maxWidth: "none",
                                                }}
                                                draggable={false}
                                            />
                                            {cropPercent && (
                                                <>
                                                    <div className="pointer-events-none absolute inset-0">
                                                        <div
                                                            className="absolute left-0 top-0 h-full bg-black/35"
                                                            style={{ width: `${cropPercent.left}%` }}
                                                        />
                                                        <div
                                                            className="absolute right-0 top-0 h-full bg-black/35"
                                                            style={{
                                                                width: `${Math.max(
                                                                    0,
                                                                    100 - cropPercent.left - cropPercent.width
                                                                )}%`,
                                                            }}
                                                        />
                                                        <div
                                                            className="absolute"
                                                            style={{
                                                                left: `${cropPercent.left}%`,
                                                                top: 0,
                                                                width: `${cropPercent.width}%`,
                                                                height: `${cropPercent.top}%`,
                                                                backgroundColor: "rgba(0,0,0,0.35)",
                                                            }}
                                                        />
                                                        <div
                                                            className="absolute"
                                                            style={{
                                                                left: `${cropPercent.left}%`,
                                                                top: `${cropPercent.top + cropPercent.height}%`,
                                                                width: `${cropPercent.width}%`,
                                                                height: `${Math.max(
                                                                    0,
                                                                    100 -
                                                                        cropPercent.top -
                                                                        cropPercent.height
                                                                )}%`,
                                                                backgroundColor: "rgba(0,0,0,0.35)",
                                                            }}
                                                        />
                                                    </div>
                                                    <div
                                                        className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
                                                        style={{
                                                            left: `${cropPercent.left}%`,
                                                            top: `${cropPercent.top}%`,
                                                            width: `${cropPercent.width}%`,
                                                            height: `${cropPercent.height}%`,
                                                        }}
                                                        onPointerDown={(e) => {
                                                            e.stopPropagation();
                                                            onStartDrag("move", e);
                                                        }}
                                                    >
                                                        <div className="absolute bottom-0 left-1/3 top-0 w-px bg-white/60" />
                                                        <div className="absolute bottom-0 left-2/3 top-0 w-px bg-white/60" />
                                                        <div className="absolute left-0 right-0 top-1/3 h-px bg-white/60" />
                                                        <div className="absolute left-0 right-0 top-2/3 h-px bg-white/60" />
                                                        {(
                                                            ["nw", "ne", "sw", "se"] as Exclude<
                                                                DragMode,
                                                                "new" | "move"
                                                            >[]
                                                        ).map((handle) => (
                                                            <div
                                                                key={handle}
                                                                className={`absolute h-3 w-3 rounded-full border border-white bg-black/80 ${handleClassMap[handle]}`}
                                                                onPointerDown={(e) => {
                                                                    e.stopPropagation();
                                                                    onStartDrag(handle, e);
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {shouldShowMinimap && minimapImage && <PreviewMinimap image={minimapImage}
                                    imageWidth={displayWidth} imageHeight={displayHeight} viewportWidth={viewportSize.width} viewportHeight={viewportSize.height}
                                    zoom={1} center={{ x: viewportRect.left + viewportRect.width / 2, y: viewportRect.top + viewportRect.height / 2 }} onCenterChange={onMinimapCenter} />}

                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
