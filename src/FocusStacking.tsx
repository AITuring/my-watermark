import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
    closestCenter,
    DndContext,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import ImageUploader from "./ImageUploader";
import {
    createFocusStackResult,
    type FocusStackLivePreview,
    type FocusStackOptions,
    type FocusStackResult,
} from "./utils/focus-stack";
import { createPreviewUrl } from "./utils/image-loading";

interface UploadState {
    id: string;
    file: File | null;
    previewUrl: string;
    status: "loading" | "ready" | "error";
    errorMessage?: string;
}

function revokeUploadPreview(state: UploadState) {
    if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
    }
}

function revokeFocusStackResult(result: FocusStackResult | null) {
    if (!result) {
        return;
    }
    URL.revokeObjectURL(result.resultUrl);
    URL.revokeObjectURL(result.maskUrl);
    URL.revokeObjectURL(result.winnerOverlayUrl);
    URL.revokeObjectURL(result.basePreviewUrl);
    URL.revokeObjectURL(result.alignedPreviewUrl);
    URL.revokeObjectURL(result.sharpnessAUrl);
    URL.revokeObjectURL(result.sharpnessBUrl);
}

function revokeLivePreview(preview: FocusStackLivePreview | null) {
    if (!preview) {
        return;
    }
    URL.revokeObjectURL(preview.baseUrl);
    URL.revokeObjectURL(preview.candidateUrl);
    URL.revokeObjectURL(preview.maskUrl);
    URL.revokeObjectURL(preview.winnerOverlayUrl);
    URL.revokeObjectURL(preview.mergedUrl);
}

interface SortableImageItemProps {
    image: UploadState;
    index: number;
    onRemove: (index: number) => void;
}

function SortableImageItem({ image, index, onRemove }: SortableImageItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({
            id: image.id,
            disabled: image.status === "loading",
        });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${
                isDragging ? "opacity-70" : ""
            }`}
        >
            <div className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
                {image.previewUrl ? (
                    <img
                        src={image.previewUrl}
                        alt={`图片 ${index + 1} 预览`}
                        className="aspect-[4/3] h-full w-full object-cover"
                    />
                ) : image.status === "loading" ? (
                    <div className="flex aspect-[4/3] h-full w-full items-center justify-center text-slate-500 dark:text-slate-400">
                        <Icon icon="mdi:loading" className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="flex aspect-[4/3] h-full w-full items-center justify-center text-rose-500 dark:text-rose-300">
                        <Icon icon="mdi:alert-circle-outline" className="h-8 w-8" />
                    </div>
                )}
                <div className="absolute left-2 top-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    {index === 0 && <Badge variant="default">初始参考</Badge>}
                </div>
                <div className="absolute right-2 top-2 flex gap-2">
                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/35 text-white transition hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-40"
                        {...attributes}
                        {...listeners}
                        disabled={image.status === "loading"}
                        aria-label={`拖拽调整图片 ${index + 1} 顺序`}
                    >
                        <Icon icon="mdi:drag" className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/35 text-white transition hover:bg-rose-500"
                        onClick={() => onRemove(index)}
                        aria-label={`移除图片 ${index + 1}`}
                    >
                        <Icon icon="mdi:close" className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div className="space-y-2 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                        {image.status === "ready"
                            ? "已就绪"
                            : image.status === "loading"
                              ? "生成预览中"
                              : "加载失败"}
                    </Badge>
                </div>
                <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                    {image.file?.name}
                </p>
                {image.status === "loading" && (
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                        TIFF 预览较慢，正在后台逐张解码
                    </p>
                )}
                {image.status === "error" && (
                    <p className="text-xs text-rose-600 dark:text-rose-300">
                        {image.errorMessage || "图片不可用"}
                    </p>
                )}
            </div>
        </div>
    );
}

const FocusStacking = () => {
    const [images, setImages] = useState<UploadState[]>([]);
    const [result, setResult] = useState<FocusStackResult | null>(null);
    const [livePreview, setLivePreview] = useState<FocusStackLivePreview | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState("等待开始");
    const [isInspectOpen, setIsInspectOpen] = useState(false);
    const [inspectZoom, setInspectZoom] = useState(1);

    const [autoAlign, setAutoAlign] = useState(true);
    const [manualShiftX, setManualShiftX] = useState(0);
    const [manualShiftY, setManualShiftY] = useState(0);
    const [scale, setScale] = useState(1);
    const [searchRadius, setSearchRadius] = useState(12);
    const [smoothRadius, setSmoothRadius] = useState(8);
    const [confidenceThreshold, setConfidenceThreshold] = useState(0.04);
    const [featherRadius, setFeatherRadius] = useState(1);
    const [foregroundProtect, setForegroundProtect] = useState(8);
    const imagesRef = useRef<UploadState[]>([]);
    const resultRef = useRef<FocusStackResult | null>(null);
    const livePreviewRef = useRef<FocusStackLivePreview | null>(null);

    useEffect(() => {
        imagesRef.current = images;
    }, [images]);

    useEffect(() => {
        resultRef.current = result;
    }, [result]);

    useEffect(() => {
        livePreviewRef.current = livePreview;
    }, [livePreview]);

    useEffect(() => {
        return () => {
            imagesRef.current.forEach(revokeUploadPreview);
            revokeFocusStackResult(resultRef.current);
            revokeLivePreview(livePreviewRef.current);
        };
    }, []);

    const readyImages = images.filter((image) => image.status === "ready");
    const loadingCount = images.filter((image) => image.status === "loading").length;
    const errorCount = images.filter((image) => image.status === "error").length;
    const canProcess = readyImages.length >= 2 && loadingCount === 0 && !isProcessing;
    const stackPreviewImages = images.slice(0, 4);
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 120,
                tolerance: 8,
            },
        })
    );

    const effectiveOffset = useMemo(() => {
        if (!result) {
            return {
                x: manualShiftX,
                y: manualShiftY,
            };
        }
        return {
            x: result.estimatedOffset.x + manualShiftX,
            y: result.estimatedOffset.y + manualShiftY,
        };
    }, [manualShiftX, manualShiftY, result]);

    const clearGeneratedResult = () => {
        setResult((current) => {
            revokeFocusStackResult(current);
            return null;
        });
        setLivePreview((current) => {
            revokeLivePreview(current);
            return null;
        });
    };

    const appendUploads = async (files: File[]) => {
        if (files.length === 0) {
            return;
        }

        clearGeneratedResult();
        const pendingItems = files.map((file, index) => ({
            id: `${Date.now()}-${index}-${file.name}`,
            file,
            previewUrl: "",
            status: "loading" as const,
            errorMessage: "",
        }));

        setImages((current) => [...current, ...pendingItems]);

        try {
            for (const item of pendingItems) {
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                });

                try {
                    const previewUrl = await createPreviewUrl(item.file, {
                        maxDimension: 1280,
                    });
                    setImages((current) =>
                        current.map((image) =>
                            image.id === item.id
                                ? {
                                      ...image,
                                      previewUrl,
                                      status: "ready",
                                      errorMessage: "",
                                  }
                                : image
                        )
                    );
                } catch (error) {
                    console.error(error);
                    setImages((current) =>
                        current.map((image) =>
                            image.id === item.id
                                ? {
                                      ...image,
                                      status: "error",
                                      errorMessage: "预览生成失败",
                                  }
                                : image
                        )
                    );
                }
            }
        } catch (error) {
            console.error(error);
            alert("图片预览生成失败，请确认文件未损坏，且 TIFF/TIFF 文件使用标准编码。");
        }
    };

    const handleRemoveImage = (index: number) => {
        clearGeneratedResult();
        setImages((current) => {
            const target = current[index];
            if (target) {
                revokeUploadPreview(target);
            }
            return current.filter((_, currentIndex) => currentIndex !== index);
        });
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }
        clearGeneratedResult();
        setImages((current) => {
            const oldIndex = current.findIndex((image) => image.id === active.id);
            const newIndex = current.findIndex((image) => image.id === over.id);
            if (oldIndex === -1 || newIndex === -1) {
                return current;
            }
            return arrayMove(current, oldIndex, newIndex);
        });
    };

    const handleClearImages = () => {
        clearGeneratedResult();
        setImages((current) => {
            current.forEach(revokeUploadPreview);
            return [];
        });
    };

    const handleProcess = async () => {
        const files = images
            .map((image) => image.file)
            .filter(
                (file, index): file is File =>
                    Boolean(file) && images[index]?.status === "ready"
            );
        if (loadingCount > 0) {
            alert("还有图片预览正在生成，请等待加载完成后再开始合成。");
            return;
        }
        if (files.length < 2) {
            alert("请至少准备两张可用图片后再开始合成。");
            return;
        }

        clearGeneratedResult();
        setIsProcessing(true);
        setProgress(0);
        setProgressLabel("准备开始");

        const options: FocusStackOptions = {
            autoAlign,
            manualShiftX,
            manualShiftY,
            scale,
            searchRadius,
            smoothRadius,
            confidenceThreshold,
            featherRadius,
            foregroundProtect,
        };

        try {
            const nextResult = await createFocusStackResult(
                files,
                options,
                ({ percent, label }) => {
                    setProgress(percent);
                    setProgressLabel(label);
                },
                (preview) => {
                    setLivePreview((current) => {
                        revokeLivePreview(current);
                        return preview;
                    });
                }
            );
            setResult(nextResult);
        } catch (error) {
            console.error(error);
            alert("焦点合成失败，请尝试调整参数后重试。");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!result) {
            return;
        }
        const link = document.createElement("a");
        link.href = result.resultUrl;
        link.download = "focus-stacked.png";
        link.click();
    };

    const openInspectDialog = () => {
        setInspectZoom(1);
        setIsInspectOpen(true);
    };

    const previewPanels = result
        ? [
              {
                  key: "result",
                  label: "合成结果",
                  url: result.resultUrl,
              },
              {
                  key: "mask",
                  label: "清晰掩膜",
                  url: result.maskUrl,
              },
              {
                  key: "winner-overlay",
                  label: "选区叠色",
                  url: result.winnerOverlayUrl,
              },
              {
                  key: "base",
                  label: result.sourceCount > 2 ? "上一轮结果" : "参考图",
                  url: result.basePreviewUrl,
              },
              {
                  key: "candidate",
                  label: result.sourceCount > 2 ? "当前候选图" : "对齐后",
                  url: result.alignedPreviewUrl,
              },
              {
                  key: "sharp-a",
                  label: result.sourceCount > 2 ? "基准清晰度" : "清晰度 A",
                  url: result.sharpnessAUrl,
              },
              {
                  key: "sharp-b",
                  label: result.sourceCount > 2 ? "候选清晰度" : "清晰度 B",
                  url: result.sharpnessBUrl,
              },
          ]
        : [];

    const processingPreviewPanels = livePreview
        ? [
              {
                  key: "merged",
                  label: "当前累计结果",
                  url: livePreview.mergedUrl,
              },
              {
                  key: "overlay",
                  label: "深度叠加",
                  url: livePreview.winnerOverlayUrl,
              },
              {
                  key: "mask",
                  label: "当前深度图",
                  url: livePreview.maskUrl,
              },
              {
                  key: "base",
                  label: "当前基准图",
                  url: livePreview.baseUrl,
              },
              {
                  key: "candidate",
                  label: "当前候选图",
                  url: livePreview.candidateUrl,
              },
          ]
        : [];

    const resultPrimaryPanels = result
        ? [
              {
                  key: "result",
                  label: "合成结果",
                  url: result.resultUrl,
              },
              {
                  key: "depth-mask",
                  label: "深度图",
                  url: result.maskUrl,
              },
          ]
        : [];

    const resultSecondaryPanels = result
        ? previewPanels.filter((panel) => !["result", "mask"].includes(panel.key))
        : [];

    return (
        <div className="min-h-screen w-full bg-stone-100 dark:bg-slate-950">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                            <Icon icon="mdi:image-filter-hdr" className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                                焦点合成
                            </h1>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                上传至少两张同机位、不同对焦点的照片，逐张提取每个区域更清晰的部分。
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">逐区域取最清晰来源</Badge>
                        <Badge variant="secondary">硬选择不混合不发糊</Badge>
                        <Badge variant="secondary">全分辨率原像素合成</Badge>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="flex flex-col gap-6">
                        <Card className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>上传图片</CardTitle>
                                <CardDescription>
                                    第一张作为初始参考图，后续图片会按顺序自动对齐并并入清晰区域。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
                                    `选区叠色` 中红色代表当前基准图，蓝色代表正在并入的候选图。多张模式下，这些调试图显示的是最后一轮合成。
                                </div>

                                {images.length === 0 ? (
                                    <div className="space-y-2">
                                        <Label>焦点序列</Label>
                                        <ImageUploader
                                            onUpload={appendUploads}
                                            fileType="焦点序列"
                                        >
                                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900">
                                                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                    <Icon icon="mdi:image-multiple-outline" className="h-8 w-8" />
                                                    <span className="text-sm">拖拽或点击添加一张或多张图</span>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                                        支持 JPG/PNG/WEBP/GIF/TIF/TIFF，第一张作为初始参考
                                                    </span>
                                                </div>
                                            </div>
                                        </ImageUploader>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsManagerOpen(true)}
                                            className="group w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900"
                                        >
                                            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-900">
                                                {stackPreviewImages
                                                    .slice()
                                                    .reverse()
                                                    .map((image, stackIndex) => (
                                                        <div
                                                            key={image.id}
                                                            className="absolute overflow-hidden rounded-2xl border border-white/80 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"
                                                            style={{
                                                                top: 12 + stackIndex * 14,
                                                                left: 18 + stackIndex * 12,
                                                                right: 18 - stackIndex * 4,
                                                                bottom: 18 - stackIndex * 6,
                                                                transform: `rotate(${(stackIndex - 1.5) * 3}deg)`,
                                                            }}
                                                        >
                                                            {image.previewUrl ? (
                                                                <img
                                                                    src={image.previewUrl}
                                                                    alt={`图片 ${stackIndex + 1}`}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : image.status === "loading" ? (
                                                                <div className="flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-400">
                                                                    <Icon
                                                                        icon="mdi:loading"
                                                                        className="h-7 w-7 animate-spin"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-rose-500 dark:text-rose-300">
                                                                    <Icon
                                                                        icon="mdi:alert-circle-outline"
                                                                        className="h-7 w-7"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-black/50 px-4 py-3 text-white backdrop-blur-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                {images.length} 张图片已堆叠
                                                            </div>
                                                            <div className="mt-1 text-xs text-white/80">
                                                                点击展开，查看全部图片并调整顺序
                                                            </div>
                                                        </div>
                                                        <Icon
                                                            icon="mdi:arrow-expand-all"
                                                            className="h-6 w-6 text-white/90"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary">
                                                可用 {readyImages.length} 张
                                            </Badge>
                                            {loadingCount > 0 && (
                                                <Badge variant="secondary">
                                                    加载中 {loadingCount} 张
                                                </Badge>
                                            )}
                                            {errorCount > 0 && (
                                                <Badge variant="secondary">
                                                    失败 {errorCount} 张
                                                </Badge>
                                            )}
                                            <Badge variant="secondary">
                                                {loadingCount > 0
                                                    ? "等待预览生成"
                                                    : readyImages.length >= 2
                                                      ? "可开始合成"
                                                      : "至少 2 张"}
                                            </Badge>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={handleClearImages}
                                        disabled={images.length === 0}
                                    >
                                        清空全部
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleProcess}
                                        disabled={!canProcess}
                                    >
                                        {isProcessing ? "处理中..." : "开始合成"}
                                    </Button>
                                </div>

                                <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                    建议使用脚架和定时快门拍摄，曝光参数固定，仅改变对焦点；多张序列建议按从前到后或从后到前的焦点顺序整理。
                                </div>
                            </CardContent>
                        </Card>

                        <Dialog open={isManagerOpen} onOpenChange={setIsManagerOpen}>
                            <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-0">
                                <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                                    <DialogHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                        <DialogTitle>管理焦点序列</DialogTitle>
                                        <DialogDescription>
                                            第一张作为初始参考图。拖拽可调整顺序，删除或继续添加都在这里完成。
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-auto px-6 py-5">
                                        <div className="space-y-5">
                                            <ImageUploader
                                                onUpload={appendUploads}
                                                fileType="焦点序列"
                                            >
                                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:bg-slate-950">
                                                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                                                            <Icon
                                                                icon="mdi:image-plus"
                                                                className="h-6 w-6"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                继续添加图片
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                支持批量添加，新增图片会接到当前序列末尾
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </ImageUploader>

                                            {images.length > 0 ? (
                                                <DndContext
                                                    sensors={sensors}
                                                    collisionDetection={closestCenter}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <SortableContext
                                                        items={images.map((image) => image.id)}
                                                        strategy={rectSortingStrategy}
                                                    >
                                                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                                                            {images.map((image, index) => (
                                                                <SortableImageItem
                                                                    key={image.id}
                                                                    image={image}
                                                                    index={index}
                                                                    onRemove={handleRemoveImage}
                                                                />
                                                            ))}
                                                        </div>
                                                    </SortableContext>
                                                </DndContext>
                                            ) : (
                                                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900">
                                                    <Icon
                                                        icon="mdi:image-multiple-outline"
                                                        className="h-10 w-10 text-slate-400"
                                                    />
                                                    <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                                                        还没有图片
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        先添加至少两张不同对焦点的图片
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline">总数 {images.length} 张</Badge>
                                            <Badge variant="outline">可用 {readyImages.length} 张</Badge>
                                            {loadingCount > 0 && (
                                                <Badge variant="outline">
                                                    加载中 {loadingCount} 张
                                                </Badge>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            onClick={handleClearImages}
                                            disabled={images.length === 0}
                                        >
                                            清空全部
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Card className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>合成参数</CardTitle>
                                <CardDescription>
                                    自动对齐负责消除轻微位移，以下参数会应用到每一张候选图。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                                    <div>
                                        <div className="text-sm font-medium">自动对齐</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            适合脚架下的轻微平移误差
                                        </div>
                                    </div>
                                    <Switch
                                        checked={autoAlign}
                                        onCheckedChange={setAutoAlign}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>搜索范围</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {searchRadius}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[searchRadius]}
                                        onValueChange={(value) => setSearchRadius(value[0])}
                                        min={2}
                                        max={30}
                                        step={1}
                                        disabled={!autoAlign}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>手动水平微调</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {manualShiftX.toFixed(1)}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[manualShiftX]}
                                        onValueChange={(value) => setManualShiftX(value[0])}
                                        min={-40}
                                        max={40}
                                        step={0.5}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>手动垂直微调</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {manualShiftY.toFixed(1)}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[manualShiftY]}
                                        onValueChange={(value) => setManualShiftY(value[0])}
                                        min={-40}
                                        max={40}
                                        step={0.5}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>缩放补偿</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {scale.toFixed(3)}x
                                        </span>
                                    </div>
                                    <Slider
                                        value={[scale]}
                                        onValueChange={(value) => setScale(value[0])}
                                        min={0.96}
                                        max={1.04}
                                        step={0.001}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>区域平滑</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {smoothRadius}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[smoothRadius]}
                                        onValueChange={(value) => setSmoothRadius(value[0])}
                                        min={1}
                                        max={20}
                                        step={1}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>清晰度门限</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {confidenceThreshold.toFixed(3)}
                                        </span>
                                    </div>
                                    <Slider
                                        value={[confidenceThreshold]}
                                        onValueChange={(value) =>
                                            setConfidenceThreshold(value[0])
                                        }
                                        min={0}
                                        max={0.2}
                                        step={0.005}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>边缘羽化</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {featherRadius}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[featherRadius]}
                                        onValueChange={(value) => setFeatherRadius(value[0])}
                                        min={0}
                                        max={5}
                                        step={1}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <Label>边缘光晕抑制</Label>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {foregroundProtect}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[foregroundProtect]}
                                        onValueChange={(value) =>
                                            setForegroundProtect(value[0])
                                        }
                                        min={0}
                                        max={30}
                                        step={1}
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        让清晰的一方认领紧贴自己的边缘：既消除玉璧内缘的溢出光晕，也用干净背景盖掉陶俑等主体轮廓外的一圈亮边。调大更干净，过大会吃掉紧贴的细节。
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleDownload}
                                        disabled={!result}
                                    >
                                        下载结果
                                    </Button>
                                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                        当前按列表顺序依次合成
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    className="w-full"
                                    onClick={() => {
                                        setManualShiftX(0);
                                        setManualShiftY(0);
                                        setScale(1);
                                    }}
                                >
                                    重置微调参数
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-6">
                        <Card className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>处理状态</CardTitle>
                                <CardDescription>
                                    先在低分辨率下逐张对齐，再按局部清晰度累计更清晰的来源。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">当前步骤: {progressLabel}</Badge>
                                    <Badge variant="outline">已上传: {images.length} 张</Badge>
                                    <Badge variant="outline">可用: {readyImages.length} 张</Badge>
                                    {loadingCount > 0 && (
                                        <Badge variant="outline">待解码: {loadingCount} 张</Badge>
                                    )}
                                    {errorCount > 0 && (
                                        <Badge variant="outline">失败: {errorCount} 张</Badge>
                                    )}
                                    {livePreview && isProcessing && (
                                        <Badge variant="outline">
                                            进行中: 第 {livePreview.stepIndex + 1} /{" "}
                                            {livePreview.sourceCount} 张
                                        </Badge>
                                    )}
                                    {result && (
                                        <Badge variant="outline">
                                            输出尺寸: {result.width} × {result.height}
                                        </Badge>
                                    )}
                                    {result && (
                                        <Badge variant="outline">
                                            来源数量: {result.sourceCount} 张
                                        </Badge>
                                    )}
                                    <Badge variant="outline">
                                        最后一步偏移: {effectiveOffset.x.toFixed(1)}px /{" "}
                                        {effectiveOffset.y.toFixed(1)}px
                                    </Badge>
                                    {result && autoAlign && (
                                        <Badge variant="outline">
                                            最后一步自动估计: {result.estimatedOffset.x.toFixed(1)}px /{" "}
                                            {result.estimatedOffset.y.toFixed(1)}px
                                        </Badge>
                                    )}
                                    {livePreview && isProcessing && (
                                        <Badge variant="outline">
                                            当前自动估计:{" "}
                                            {livePreview.estimatedOffset.x.toFixed(1)}px /{" "}
                                            {livePreview.estimatedOffset.y.toFixed(1)}px
                                        </Badge>
                                    )}
                                </div>
                                <Progress value={progress} className="h-2.5" />
                                {livePreview && isProcessing && (
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
                                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-3 dark:border-slate-800">
                                            <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
                                                <span>{livePreview.stageLabel}</span>
                                                <span>
                                                    步骤 {livePreview.stepIndex} /{" "}
                                                    {livePreview.totalSteps}
                                                </span>
                                            </div>
                                            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
                                                <img
                                                    src={livePreview.baseUrl}
                                                    alt="当前基准图"
                                                    className="absolute inset-0 h-full w-full object-contain opacity-90"
                                                />
                                                <img
                                                    src={livePreview.candidateUrl}
                                                    alt="当前候选图"
                                                    className="absolute inset-0 h-full w-full object-contain opacity-45"
                                                />
                                                <img
                                                    src={livePreview.winnerOverlayUrl}
                                                    alt="深度叠加图"
                                                    className="absolute inset-0 h-full w-full object-contain mix-blend-screen animate-pulse"
                                                />
                                            </div>
                                            <p className="mt-3 text-xs leading-5 text-slate-400">
                                                红色保留当前基准，蓝色并入当前候选；叠加图会随每轮堆叠刷新，方便观察深度归属推进。
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                            {processingPreviewPanels.map((panel) => (
                                                <div
                                                    key={panel.key}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                                                >
                                                    <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        {panel.label}
                                                    </div>
                                                    <img
                                                        src={panel.url}
                                                        alt={panel.label}
                                                        className="aspect-[4/3] w-full rounded-xl object-contain"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    如果边缘仍有轻微重影，优先微调水平/垂直位移，其次再小范围调整缩放补偿；多张时调试图显示最后一轮合成。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="min-h-[720px] border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>预览结果</CardTitle>
                                <CardDescription>
                                    同步查看合成结果和深度图，点击主图可放大预览；其他调试图保留在下方辅助判断。
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {result ? (
                                    <div className="space-y-5">
                                        <div className="grid gap-4 xl:grid-cols-2">
                                            {resultPrimaryPanels.map((panel) => (
                                                <button
                                                    key={panel.key}
                                                    type="button"
                                                    onClick={openInspectDialog}
                                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-950"
                                                >
                                                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                                {panel.label}
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                点击放大查看原始分辨率细节
                                                            </div>
                                                        </div>
                                                        <Icon
                                                            icon="mdi:magnify-plus-outline"
                                                            className="h-5 w-5 text-slate-500 dark:text-slate-400"
                                                        />
                                                    </div>
                                                    <div className="bg-slate-100 p-3 dark:bg-slate-950">
                                                        <img
                                                            src={panel.url}
                                                            alt={panel.label}
                                                            className="h-[420px] w-full rounded-xl object-contain xl:h-[560px]"
                                                        />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {resultSecondaryPanels.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                    其他调试图
                                                </div>
                                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                                    {resultSecondaryPanels.map((panel) => (
                                                        <div
                                                            key={panel.key}
                                                            className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                                                        >
                                                            <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                                                {panel.label}
                                                            </div>
                                                            <div className="p-3">
                                                                <img
                                                                    src={panel.url}
                                                                    alt={panel.label}
                                                                    className="aspect-[4/3] w-full rounded-xl object-contain"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : livePreview && isProcessing ? (
                                    <div className="flex min-h-[520px] flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                                                    正在堆叠深度图
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    当前展示第 {livePreview.stepIndex + 1} 张并入时的动态叠加视图。
                                                </p>
                                            </div>
                                            <Badge variant="outline">{livePreview.stageLabel}</Badge>
                                        </div>
                                        <div className="grid flex-1 gap-4 xl:grid-cols-2">
                                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                                    当前累计结果
                                                </div>
                                                <div className="bg-slate-100 p-3 dark:bg-slate-950">
                                                    <img
                                                        src={livePreview.mergedUrl}
                                                        alt="当前累计结果"
                                                        className="h-[380px] w-full rounded-xl object-contain xl:h-[520px]"
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                                    当前深度图
                                                </div>
                                                <div className="bg-slate-100 p-3 dark:bg-slate-950">
                                                    <img
                                                        src={livePreview.maskUrl}
                                                        alt="当前深度图"
                                                        className="h-[380px] w-full rounded-xl object-contain xl:h-[520px]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            {processingPreviewPanels
                                                .filter((panel) => !["merged", "mask"].includes(panel.key))
                                                .map((panel) => (
                                                    <div
                                                        key={panel.key}
                                                        className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                                                    >
                                                        <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            {panel.label}
                                                        </div>
                                                        <img
                                                            src={panel.url}
                                                            alt={panel.label}
                                                            className="aspect-[4/3] w-full rounded-xl object-contain"
                                                        />
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950">
                                        <Icon
                                            icon="mdi:layers-triple-outline"
                                            className="h-12 w-12 text-slate-400"
                                        />
                                        <div>
                                            <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                                                结果会显示在这里
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                上传至少两张图后点击“开始合成”，即可查看最后一轮掩膜和最终输出。
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Dialog open={isInspectOpen} onOpenChange={setIsInspectOpen}>
                            <DialogContent className="h-[94vh] w-[96vw] max-w-[96vw] p-0">
                                <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                    <DialogHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                        <DialogTitle>放大预览</DialogTitle>
                                        <DialogDescription>
                                            合成结果和深度图同步查看。滚动容器可平移，缩放滑块会同时作用到两张图。
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <Label className="shrink-0">缩放</Label>
                                            <Slider
                                                value={[inspectZoom]}
                                                onValueChange={(value) => setInspectZoom(value[0])}
                                                min={1}
                                                max={4}
                                                step={0.1}
                                            />
                                            <span className="w-14 text-right text-sm text-slate-500 dark:text-slate-400">
                                                {inspectZoom.toFixed(1)}x
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-2">
                                        {resultPrimaryPanels.map((panel) => (
                                            <div
                                                key={panel.key}
                                                className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                                            >
                                                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                                    {panel.label}
                                                </div>
                                                <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
                                                    <div className="flex min-h-full min-w-full items-center justify-center">
                                                        <img
                                                            src={panel.url}
                                                            alt={panel.label}
                                                            className="max-w-none rounded-xl object-contain"
                                                            style={{
                                                                width: `${inspectZoom * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FocusStacking;
