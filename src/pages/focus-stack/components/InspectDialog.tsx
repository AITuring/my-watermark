import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DOUBLE_CLICK_ZOOM, MAX_INSPECT_ZOOM, MIN_INSPECT_ZOOM } from "../helpers";
import { useFocusStackInspect } from "../hooks/useFocusStackInspect";
import type { PreviewPanel } from "../types";

interface InspectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    panels: PreviewPanel[];
    imageWidth: number;
    imageHeight: number;
}

export default function InspectDialog({
    open,
    onOpenChange,
    panels,
    imageWidth,
    imageHeight,
}: InspectDialogProps) {
    const inspect = useFocusStackInspect({
        imageWidth,
        imageHeight,
        isOpen: open,
    });

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    inspect.resetInspectView();
                }
                onOpenChange(nextOpen);
            }}
        >
            <DialogContent className="h-[94vh] w-[96vw] max-w-[96vw] p-0">
                <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <DialogHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                        <DialogTitle>放大预览</DialogTitle>
                        <DialogDescription>
                            两张图同步缩放和平移。支持拖拽查看、鼠标滚轮缩放、双击切换到固定倍率，并带
                            minimap 视口指示。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-4">
                            <Label className="shrink-0">缩放</Label>
                            <Slider
                                value={[inspect.inspectZoom]}
                                onValueChange={(value) => inspect.setInspectZoom(value[0])}
                                min={MIN_INSPECT_ZOOM}
                                max={MAX_INSPECT_ZOOM}
                                step={0.1}
                            />
                            <span className="w-14 text-right text-sm text-slate-500 dark:text-slate-400">
                                {inspect.inspectZoom.toFixed(1)}x
                            </span>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <Badge variant="outline">
                                    双击: {DOUBLE_CLICK_ZOOM.toFixed(1)}x
                                </Badge>
                                <Badge variant="outline">拖拽: 联动平移</Badge>
                                <Badge variant="outline">滚轮: 联动缩放</Badge>
                            </div>
                        </div>
                    </div>
                    <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-2">
                        {panels.map((panel) => {
                            const layout = inspect.getInspectLayout(panel.key);
                            return (
                                <div
                                    key={panel.key}
                                    className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                                >
                                    <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                        {panel.label}
                                    </div>
                                    <div
                                        ref={(node) =>
                                            inspect.registerInspectContainer(panel.key, node)
                                        }
                                        className={`relative min-h-0 flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950 ${
                                            inspect.draggingPanelKey === panel.key
                                                ? "cursor-grabbing"
                                                : "cursor-grab"
                                        }`}
                                        onScroll={() => inspect.handleInspectScroll(panel.key)}
                                        onWheel={(event) =>
                                            inspect.handleInspectWheel(panel.key, event)
                                        }
                                        onDoubleClick={(event) =>
                                            inspect.handleInspectDoubleClick(panel.key, event)
                                        }
                                        onPointerDown={(event) =>
                                            inspect.handleInspectPointerDown(panel.key, event)
                                        }
                                        onPointerMove={(event) =>
                                            inspect.handleInspectPointerMove(panel.key, event)
                                        }
                                        onPointerUp={(event) =>
                                            inspect.handleInspectPointerUp(panel.key, event)
                                        }
                                        onPointerCancel={(event) =>
                                            inspect.handleInspectPointerUp(panel.key, event)
                                        }
                                    >
                                        <div
                                            className="relative"
                                            style={{
                                                width: layout.wrapperWidth,
                                                height: layout.wrapperHeight,
                                            }}
                                        >
                                            <img
                                                src={panel.url}
                                                alt={panel.label}
                                                draggable={false}
                                                className="absolute left-0 top-0 rounded-xl object-contain select-none"
                                                style={{
                                                    width: layout.renderedWidth,
                                                    height: layout.renderedHeight,
                                                }}
                                            />

                                            <button
                                                type="button"
                                                className="absolute bottom-4 right-4 w-32 overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/90"
                                                style={{
                                                    aspectRatio: `${inspect.inspectImageSize.width} / ${inspect.inspectImageSize.height}`,
                                                }}
                                                onPointerDown={(event) =>
                                                    inspect.handleMinimapJump(panel.key, event)
                                                }
                                            >
                                                <img
                                                    src={panel.url}
                                                    alt={`${panel.label} minimap`}
                                                    draggable={false}
                                                    className="h-full w-full object-cover"
                                                />
                                                <div
                                                    className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/15"
                                                    style={{
                                                        left: `${
                                                            inspect.inspectViewport.x *
                                                            Math.max(
                                                                0,
                                                                100 -
                                                                    (inspect.inspectMetrics
                                                                        .viewportWidth /
                                                                        Math.max(
                                                                            layout.renderedWidth,
                                                                            1
                                                                        )) *
                                                                        100
                                                            )
                                                        }%`,
                                                        top: `${
                                                            inspect.inspectViewport.y *
                                                            Math.max(
                                                                0,
                                                                100 -
                                                                    (inspect.inspectMetrics
                                                                        .viewportHeight /
                                                                        Math.max(
                                                                            layout.renderedHeight,
                                                                            1
                                                                        )) *
                                                                        100
                                                            )
                                                        }%`,
                                                        width: `${Math.min(
                                                            100,
                                                            (inspect.inspectMetrics.viewportWidth /
                                                                Math.max(
                                                                    layout.renderedWidth,
                                                                    1
                                                                )) *
                                                                100
                                                        )}%`,
                                                        height: `${Math.min(
                                                            100,
                                                            (inspect.inspectMetrics.viewportHeight /
                                                                Math.max(
                                                                    layout.renderedHeight,
                                                                    1
                                                                )) *
                                                                100
                                                        )}%`,
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
