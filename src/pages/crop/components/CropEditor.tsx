import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Maximize, Minimize, RotateCcw, ScanSearch, Scissors } from "lucide-react";
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
    onZoomChange: React.Dispatch<React.SetStateAction<number>>;
    onStartDrag: (mode: DragMode, event: React.PointerEvent) => void;
    onMinimapPointer: (event: React.PointerEvent<HTMLDivElement>) => void;
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
    onZoomChange,
    onStartDrag,
    onMinimapPointer,
}: CropEditorProps) {
    return (
        <Card className="flex min-h-0 flex-1 flex-col rounded-lg border-border/60 bg-background/95 shadow-sm">
            <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                        <CardTitle className="flex shrink-0 items-center gap-2 text-base">
                            <ScanSearch className="h-4 w-4" />
                            当前编辑
                        </CardTitle>
                        <div className="truncate text-sm text-muted-foreground">
                            {activeImage ? activeImage.name : "还没有选择原图"}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                        <Button
                            size="sm"
                            className="px-2.5 sm:px-3"
                            onClick={onSaveCurrentCrop}
                            disabled={!activeImage}
                        >
                            <Scissors className="h-4 w-4" />
                            <span className="hidden sm:inline">暂存当前裁切</span>
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="px-2.5 sm:px-3"
                            onClick={onExportCurrent}
                            disabled={!activeImage}
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">单独导出</span>
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
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">原图 {activeImage.width} × {activeImage.height}</Badge>
                            <Badge variant="outline">
                                选区 {Math.round(activeImage.crop.w)} × {Math.round(activeImage.crop.h)}
                            </Badge>
                            <Badge variant="outline">缩放 {Math.round(effectiveZoom * 100)}%</Badge>
                            <Badge variant="outline">{currentDisplayLabel}</Badge>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col gap-3">
                            <div className="rounded bg-muted/20">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onApplyRotation(90)}
                                        disabled={!activeImage}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        <span className="hidden sm:inline">顺时针 90°</span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onApplyRotation(-90)}
                                        disabled={!activeImage}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        <span className="hidden sm:inline">逆时针 90°</span>
                                    </Button>
                                    <Input
                                        type="number"
                                        value={customAngle}
                                        step="0.1"
                                        className="h-8 w-20 bg-background"
                                        onChange={(e) => onCustomAngleChange(Number(e.target.value || 0))}
                                        placeholder="角度"
                                    />
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onApplyRotation(customAngle)}
                                        disabled={!activeImage}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        <span className="hidden sm:inline">应用角度</span>
                                    </Button>
                                    <div className="mx-1 hidden h-5 w-px bg-border lg:block" />
                                    <Button variant="secondary" size="sm" onClick={() => onZoomChange(fitZoom)}>
                                        <Maximize className="h-4 w-4" />
                                        <span className="hidden sm:inline">适应窗口</span>
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
                                </div>
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
                                {shouldShowMinimap && (
                                    <div className="pointer-events-none absolute bottom-4 right-4 z-10">
                                        <div className="pointer-events-auto w-[168px] rounded-lg border border-border/70 bg-background/92 p-3 shadow-lg backdrop-blur-sm">
                                            <div className="mb-2 text-sm font-medium">Minimap</div>
                                            <div
                                                className="relative overflow-hidden rounded-lg border bg-background"
                                                style={{
                                                    aspectRatio: `${activeImage.width} / ${activeImage.height}`,
                                                }}
                                                onPointerDown={onMinimapPointer}
                                            >
                                                <img
                                                    src={activeImage.previewUrl}
                                                    alt={`${activeImage.name}-minimap`}
                                                    className="h-full w-full object-contain"
                                                    draggable={false}
                                                />
                                                {cropPercent && (
                                                    <div
                                                        className="absolute border border-white/90 bg-white/10"
                                                        style={{
                                                            left: `${cropPercent.left}%`,
                                                            top: `${cropPercent.top}%`,
                                                            width: `${cropPercent.width}%`,
                                                            height: `${cropPercent.height}%`,
                                                        }}
                                                    />
                                                )}
                                                <div
                                                    className="absolute border border-primary bg-primary/10"
                                                    style={{
                                                        left: `${viewportRect.left * 100}%`,
                                                        top: `${viewportRect.top * 100}%`,
                                                        width: `${viewportRect.width * 100}%`,
                                                        height: `${viewportRect.height * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <div className="mt-2 text-[11px] text-muted-foreground">
                                                已放大时显示，点击可快速定位视口
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
