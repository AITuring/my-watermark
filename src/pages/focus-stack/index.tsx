import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import {
    createFocusStackResult,
    type FocusStackLivePreview,
    type FocusStackOptions,
    type FocusStackResult,
} from "@/utils/focus-stack";
import { createPreviewUrl } from "@/utils/image-loading";
import ImageManagerDialog from "./components/ImageManagerDialog";
import InspectDialog from "./components/InspectDialog";
import ParametersPanel from "./components/ParametersPanel";
import ProcessingStatusPanel from "./components/ProcessingStatusPanel";
import ResultPreviewPanel from "./components/ResultPreviewPanel";
import UploadPanel from "./components/UploadPanel";
import {
    revokeFocusStackResult,
    revokeLivePreview,
    revokeUploadPreview,
    yieldToBrowser,
} from "./helpers";
import {
    getProcessingPreviewPanels,
    getResultPrimaryPanels,
    getResultSecondaryPanels,
} from "./panels";
import type { FocusStackStatusSummary, UploadState } from "./types";

const FocusStacking = () => {
    const [images, setImages] = useState<UploadState[]>([]);
    const [result, setResult] = useState<FocusStackResult | null>(null);
    const [livePreview, setLivePreview] = useState<FocusStackLivePreview | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState("等待开始");
    const [isInspectOpen, setIsInspectOpen] = useState(false);

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

    const processingPreviewPanels = useMemo(
        () => getProcessingPreviewPanels(livePreview),
        [livePreview]
    );
    const resultPrimaryPanels = useMemo(() => getResultPrimaryPanels(result), [result]);
    const resultSecondaryPanels = useMemo(() => getResultSecondaryPanels(result), [result]);

    const statusSummary = useMemo<FocusStackStatusSummary>(
        () => ({
            imagesCount: images.length,
            readyCount: readyImages.length,
            loadingCount,
            errorCount,
            progress,
            progressLabel,
            isProcessing,
            effectiveOffset,
            result,
            livePreview,
            autoAlign,
        }),
        [
            autoAlign,
            effectiveOffset,
            errorCount,
            images.length,
            isProcessing,
            livePreview,
            loadingCount,
            progress,
            progressLabel,
            readyImages.length,
            result,
        ]
    );

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
                await yieldToBrowser();

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
                        <UploadPanel
                            images={images}
                            readyCount={readyImages.length}
                            loadingCount={loadingCount}
                            errorCount={errorCount}
                            canProcess={canProcess}
                            isProcessing={isProcessing}
                            stackPreviewImages={stackPreviewImages}
                            onUpload={appendUploads}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onClearImages={handleClearImages}
                            onProcess={handleProcess}
                        />

                        <ImageManagerDialog
                            open={isManagerOpen}
                            onOpenChange={setIsManagerOpen}
                            images={images}
                            readyCount={readyImages.length}
                            loadingCount={loadingCount}
                            sensors={sensors}
                            onUpload={appendUploads}
                            onDragEnd={handleDragEnd}
                            onRemoveImage={handleRemoveImage}
                            onClearImages={handleClearImages}
                        />

                        <ParametersPanel
                            autoAlign={autoAlign}
                            manualShiftX={manualShiftX}
                            manualShiftY={manualShiftY}
                            scale={scale}
                            searchRadius={searchRadius}
                            smoothRadius={smoothRadius}
                            confidenceThreshold={confidenceThreshold}
                            featherRadius={featherRadius}
                            foregroundProtect={foregroundProtect}
                            hasResult={Boolean(result)}
                            onAutoAlignChange={setAutoAlign}
                            onManualShiftXChange={setManualShiftX}
                            onManualShiftYChange={setManualShiftY}
                            onScaleChange={setScale}
                            onSearchRadiusChange={setSearchRadius}
                            onSmoothRadiusChange={setSmoothRadius}
                            onConfidenceThresholdChange={setConfidenceThreshold}
                            onFeatherRadiusChange={setFeatherRadius}
                            onForegroundProtectChange={setForegroundProtect}
                            onDownload={handleDownload}
                            onResetAdjustment={() => {
                                setManualShiftX(0);
                                setManualShiftY(0);
                                setScale(1);
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-6">
                        <ProcessingStatusPanel
                            summary={statusSummary}
                            processingPreviewPanels={processingPreviewPanels}
                        />

                        <ResultPreviewPanel
                            result={result}
                            livePreview={livePreview}
                            isProcessing={isProcessing}
                            processingPreviewPanels={processingPreviewPanels}
                            resultPrimaryPanels={resultPrimaryPanels}
                            resultSecondaryPanels={resultSecondaryPanels}
                            onOpenInspect={() => setIsInspectOpen(true)}
                        />

                        <InspectDialog
                            open={isInspectOpen}
                            onOpenChange={setIsInspectOpen}
                            panels={resultPrimaryPanels}
                            imageWidth={result?.width ?? 1}
                            imageHeight={result?.height ?? 1}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FocusStacking;
