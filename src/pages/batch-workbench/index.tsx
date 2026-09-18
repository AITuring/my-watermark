import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
    Ban,
    Download,
    Clock3,
    Crop,
    Expand,
    History,
    Loader2,
    Redo2,
    RotateCcw,
    RotateCw,
    ScanLine,
    Trash2,
    Undo2,
    Upload,
    Wand2,
    Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { createCenteredCrop, getOutputSize } from "@/pages/crop/helpers";
import type { CropBox, CropMode } from "@/pages/crop/types";
import { ratioOptions } from "@/pages/crop/types";
import {
    compressImage,
    createThumbnailPreview,
    forceCompressImage,
    getImageDimensions,
} from "@/pages/compress/services";
import { formatFileSize } from "@/pages/compress/utils";
import { loadJSZip, loadSaveAs } from "@/utils/lazy-deps";

type BatchItemStatus = "idle" | "processing" | "done" | "error";
type RotationValue = "0" | "90" | "-90" | "180";
type BatchCropMode = "none" | CropMode;

type BatchItem = {
    id: string;
    name: string;
    originalFile: File;
    originalPreviewUrl: string;
    originalWidth: number;
    originalHeight: number;
    resultFile: File | null;
    resultPreviewUrl: string | null;
    resultWidth: number | null;
    resultHeight: number | null;
    status: BatchItemStatus;
    error: string | null;
};

type WorkbenchSettings = {
    rotation: RotationValue;
    cropMode: BatchCropMode;
    ratioPreset: string;
    targetWidth: number;
    targetHeight: number;
    shouldCompress: boolean;
    targetSizeMB: number;
    resizePercent: number;
    forceToTarget: boolean;
};

type HistoryEntry = {
    id: string;
    label: string;
    createdAt: number;
    settings: WorkbenchSettings;
};

const SUPPORTED_EXPORT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_TARGET_SIZE_MB = 8;
const MAX_HISTORY_ENTRIES = 24;
const AUTO_PROCESS_DEBOUNCE_MS = 240;

const ratioPresetOptions = ratioOptions.filter((option) => option.label !== "自定义");
const rotationOptions: Array<{
    value: RotationValue;
    label: string;
    historyLabel: string;
    icon: typeof Ban;
    badge?: string;
}> = [
    { value: "0", label: "不旋转", historyLabel: "旋转重置", icon: Ban },
    { value: "90", label: "顺时针 90 度", historyLabel: "旋转 90 度", icon: RotateCw, badge: "90" },
    { value: "-90", label: "逆时针 90 度", historyLabel: "旋转 -90 度", icon: RotateCcw, badge: "90" },
    { value: "180", label: "旋转 180 度", historyLabel: "旋转 180 度", icon: RotateCw, badge: "180" },
];
const cropModeOptions: Array<{
    value: BatchCropMode;
    label: string;
    historyLabel: string;
    icon: typeof Ban;
}> = [
    { value: "none", label: "不裁切", historyLabel: "切到不裁切", icon: Ban },
    { value: "ratio", label: "按比例裁切", historyLabel: "切到比例裁切", icon: Crop },
    { value: "fixed", label: "固定尺寸裁切", historyLabel: "切到固定尺寸裁切", icon: ScanLine },
    { value: "free", label: "保留整张", historyLabel: "切到保留整张", icon: Expand },
];

const DEFAULT_SETTINGS: WorkbenchSettings = {
    rotation: "0",
    cropMode: "ratio",
    ratioPreset: "4:3",
    targetWidth: 1600,
    targetHeight: 1200,
    shouldCompress: true,
    targetSizeMB: DEFAULT_TARGET_SIZE_MB,
    resizePercent: 100,
    forceToTarget: false,
};

const getFileBaseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

const getExtensionByMimeType = (mimeType: string) => {
    switch (mimeType) {
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        default:
            return "jpg";
    }
};

const buildOutputName = (file: File, mimeType: string) =>
    `${getFileBaseName(file.name)}-batch.${getExtensionByMimeType(mimeType)}`;

const chooseOutputMimeType = (file: File) =>
    SUPPORTED_EXPORT_TYPES.has(file.type) ? file.type : "image/jpeg";

const revokeUrl = (url?: string | null) => {
    if (url) {
        URL.revokeObjectURL(url);
    }
};

const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("图片预览加载失败"));
        image.src = src;
    });

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number) =>
    new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, quality);
    });

const formatHistoryTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

const normalizeSettings = (settings: WorkbenchSettings): WorkbenchSettings => ({
    ...settings,
    targetWidth: Math.max(1, Math.round(settings.targetWidth || 1)),
    targetHeight: Math.max(1, Math.round(settings.targetHeight || 1)),
    targetSizeMB: Math.max(0.1, Number(settings.targetSizeMB) || 0.1),
    resizePercent: Math.min(100, Math.max(10, Math.round(settings.resizePercent || 100))),
});

const areSettingsEqual = (a: WorkbenchSettings, b: WorkbenchSettings) =>
    a.rotation === b.rotation &&
    a.cropMode === b.cropMode &&
    a.ratioPreset === b.ratioPreset &&
    a.targetWidth === b.targetWidth &&
    a.targetHeight === b.targetHeight &&
    a.shouldCompress === b.shouldCompress &&
    a.targetSizeMB === b.targetSizeMB &&
    a.resizePercent === b.resizePercent &&
    a.forceToTarget === b.forceToTarget;

const createHistoryEntry = (settings: WorkbenchSettings, label: string): HistoryEntry => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: Date.now(),
    settings: { ...settings },
});

const computeCrop = (
    cropMode: BatchCropMode,
    rotatedWidth: number,
    rotatedHeight: number,
    ratioValue: number,
    targetWidth: number,
    targetHeight: number
): { crop: CropBox; outputWidth: number; outputHeight: number } => {
    if (cropMode === "none" || cropMode === "free") {
        return {
            crop: { x: 0, y: 0, w: rotatedWidth, h: rotatedHeight },
            outputWidth: rotatedWidth,
            outputHeight: rotatedHeight,
        };
    }

    const crop =
        cropMode === "fixed"
            ? createCenteredCrop(
                  rotatedWidth,
                  rotatedHeight,
                  Math.max(targetWidth, 1) / Math.max(targetHeight, 1)
              )
            : createCenteredCrop(rotatedWidth, rotatedHeight, ratioValue);

    const size = getOutputSize(crop, cropMode, targetWidth, targetHeight);
    return {
        crop,
        outputWidth: size.outputW,
        outputHeight: size.outputH,
    };
};

const processFullResolutionImage = async (
    file: File,
    settings: WorkbenchSettings,
    ratioValue: number
) => {
    const bitmap = await createImageBitmap(file);
    try {
        const angle = Number(settings.rotation);
        const angleRad = (angle * Math.PI) / 180;
        const sourceWidth = bitmap.width;
        const sourceHeight = bitmap.height;
        const rotatedWidth = Math.round(
            Math.abs(sourceWidth * Math.cos(angleRad)) + Math.abs(sourceHeight * Math.sin(angleRad))
        );
        const rotatedHeight = Math.round(
            Math.abs(sourceWidth * Math.sin(angleRad)) + Math.abs(sourceHeight * Math.cos(angleRad))
        );

        const rotateCanvas = document.createElement("canvas");
        rotateCanvas.width = Math.max(rotatedWidth, 1);
        rotateCanvas.height = Math.max(rotatedHeight, 1);

        const rotateContext = rotateCanvas.getContext("2d");
        if (!rotateContext) {
            throw new Error("无法创建旋转画布");
        }

        rotateContext.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
        rotateContext.rotate(angleRad);
        rotateContext.drawImage(bitmap, -sourceWidth / 2, -sourceHeight / 2);

        const { crop, outputWidth, outputHeight } = computeCrop(
            settings.cropMode,
            rotateCanvas.width,
            rotateCanvas.height,
            ratioValue,
            settings.targetWidth,
            settings.targetHeight
        );

        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = Math.max(outputWidth, 1);
        outputCanvas.height = Math.max(outputHeight, 1);

        const outputContext = outputCanvas.getContext("2d");
        if (!outputContext) {
            throw new Error("无法创建输出画布");
        }

        outputContext.imageSmoothingEnabled = true;
        outputContext.imageSmoothingQuality = "high";
        outputContext.drawImage(
            rotateCanvas,
            crop.x,
            crop.y,
            crop.w,
            crop.h,
            0,
            0,
            outputCanvas.width,
            outputCanvas.height
        );

        const outputMimeType = chooseOutputMimeType(file);
        const renderedBlob = await canvasToBlob(outputCanvas, outputMimeType, 0.92);
        if (!renderedBlob) {
            throw new Error("导出处理中间图失败");
        }

        let nextFile = new File([renderedBlob], buildOutputName(file, outputMimeType), {
            type: outputMimeType,
        });

        if (settings.shouldCompress) {
            const compressionResult = settings.forceToTarget
                ? await forceCompressImage(nextFile, settings.targetSizeMB)
                : await compressImage(nextFile, {
                      targetSizeMB: settings.targetSizeMB,
                      resizePercent: settings.resizePercent,
                  });

            nextFile = new File(
                [compressionResult.file],
                buildOutputName(
                    compressionResult.file,
                    compressionResult.file.type || outputMimeType
                ),
                {
                    type: compressionResult.file.type || outputMimeType,
                }
            );
        }

        const previewUrl = await createThumbnailPreview(nextFile);
        const dimensions = await getImageDimensions(nextFile);

        return {
            file: nextFile,
            previewUrl,
            width: dimensions.width,
            height: dimensions.height,
        };
    } finally {
        bitmap.close();
    }
};

const processPreviewImage = async (
    previewUrl: string,
    settings: WorkbenchSettings,
    ratioValue: number
) => {
    const image = await loadImageElement(previewUrl);
    const angle = Number(settings.rotation);
    const angleRad = (angle * Math.PI) / 180;
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const rotatedWidth = Math.round(
        Math.abs(sourceWidth * Math.cos(angleRad)) + Math.abs(sourceHeight * Math.sin(angleRad))
    );
    const rotatedHeight = Math.round(
        Math.abs(sourceWidth * Math.sin(angleRad)) + Math.abs(sourceHeight * Math.cos(angleRad))
    );

    const rotateCanvas = document.createElement("canvas");
    rotateCanvas.width = Math.max(rotatedWidth, 1);
    rotateCanvas.height = Math.max(rotatedHeight, 1);

    const rotateContext = rotateCanvas.getContext("2d");
    if (!rotateContext) {
        throw new Error("无法创建预览画布");
    }

    rotateContext.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
    rotateContext.rotate(angleRad);
    rotateContext.drawImage(image, -sourceWidth / 2, -sourceHeight / 2);

    const { crop, outputWidth, outputHeight } = computeCrop(
        settings.cropMode,
        rotateCanvas.width,
        rotateCanvas.height,
        ratioValue,
        settings.targetWidth,
        settings.targetHeight
    );

    const previewScale =
        settings.shouldCompress && !settings.forceToTarget
            ? settings.resizePercent / 100
            : 1;
    const targetPreviewWidth = Math.max(Math.round(outputWidth * previewScale), 1);
    const targetPreviewHeight = Math.max(Math.round(outputHeight * previewScale), 1);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = targetPreviewWidth;
    outputCanvas.height = targetPreviewHeight;

    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
        throw new Error("无法创建结果预览");
    }

    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";
    outputContext.drawImage(
        rotateCanvas,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height
    );

    const previewBlob = await canvasToBlob(outputCanvas, "image/jpeg", 0.84);
    if (!previewBlob) {
        throw new Error("生成结果预览失败");
    }

    return {
        previewUrl: URL.createObjectURL(previewBlob),
        width: targetPreviewWidth,
        height: targetPreviewHeight,
    };
};

export default function BatchWorkbenchPage() {
    const [items, setItems] = useState<BatchItem[]>([]);
    const [settings, setSettings] = useState<WorkbenchSettings>(DEFAULT_SETTINGS);
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([
        createHistoryEntry(DEFAULT_SETTINGS, "初始配置"),
    ]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const itemsRef = useRef<BatchItem[]>([]);
    const settingsRef = useRef<WorkbenchSettings>(DEFAULT_SETTINGS);
    const processRunIdRef = useRef(0);

    const ratioValue = useMemo(() => {
        const matched = ratioPresetOptions.find((option) => option.label === settings.ratioPreset);
        return matched?.value ?? 4 / 3;
    }, [settings.ratioPreset]);

    const processedCount = items.filter((item) => item.status === "done" && item.resultPreviewUrl).length;
    const failedCount = items.filter((item) => item.status === "error").length;
    const totalOriginalSize = items.reduce((sum, item) => sum + item.originalFile.size, 0);
    const totalResultSize = items.reduce((sum, item) => sum + (item.resultFile?.size ?? 0), 0);
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < historyEntries.length - 1;
    const itemsSourceSignature = useMemo(() => items.map((item) => item.id).join("|"), [items]);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        return () => {
            itemsRef.current.forEach((item) => {
                revokeUrl(item.originalPreviewUrl);
                revokeUrl(item.resultPreviewUrl);
            });
        };
    }, []);

    const pushHistorySnapshot = useCallback((snapshot: WorkbenchSettings, label: string) => {
        const normalized = normalizeSettings(snapshot);
        setHistoryEntries((prevEntries) => {
            const baseEntries = prevEntries.slice(0, historyIndex + 1);
            const currentEntry = baseEntries[baseEntries.length - 1];
            if (currentEntry && areSettingsEqual(currentEntry.settings, normalized)) {
                return prevEntries;
            }

            const nextEntries = [...baseEntries, createHistoryEntry(normalized, label)];
            const trimmedEntries =
                nextEntries.length > MAX_HISTORY_ENTRIES
                    ? nextEntries.slice(nextEntries.length - MAX_HISTORY_ENTRIES)
                    : nextEntries;
            setHistoryIndex(trimmedEntries.length - 1);
            return trimmedEntries;
        });
    }, [historyIndex]);

    const applySettings = useCallback((nextSettings: WorkbenchSettings) => {
        setSettings(normalizeSettings(nextSettings));
    }, []);

    const patchSettings = useCallback((patch: Partial<WorkbenchSettings>) => {
        setSettings((prev) => normalizeSettings({ ...prev, ...patch }));
    }, []);

    const commitCurrentSettings = useCallback((label: string) => {
        pushHistorySnapshot(settingsRef.current, label);
    }, [pushHistorySnapshot]);

    const restoreHistoryEntry = useCallback((index: number) => {
        const entry = historyEntries[index];
        if (!entry) {
            return;
        }
        setHistoryIndex(index);
        applySettings(entry.settings);
        setHistoryDialogOpen(false);
        toast.success(`已恢复到「${entry.label}」`);
    }, [applySettings, historyEntries]);

    const handleUndo = useCallback(() => {
        if (!canUndo) {
            return;
        }
        const nextIndex = historyIndex - 1;
        const entry = historyEntries[nextIndex];
        if (!entry) {
            return;
        }
        setHistoryIndex(nextIndex);
        applySettings(entry.settings);
    }, [applySettings, canUndo, historyEntries, historyIndex]);

    const handleRedo = useCallback(() => {
        if (!canRedo) {
            return;
        }
        const nextIndex = historyIndex + 1;
        const entry = historyEntries[nextIndex];
        if (!entry) {
            return;
        }
        setHistoryIndex(nextIndex);
        applySettings(entry.settings);
    }, [applySettings, canRedo, historyEntries, historyIndex]);

    const appendFiles = useCallback(async (files: File[]) => {
        if (!files.length) {
            return;
        }

        const nextItems = await Promise.all(
            files.map(async (file, index) => {
                const previewUrl = await createThumbnailPreview(file);
                const dimensions = await getImageDimensions(file);
                return {
                    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
                    name: file.name,
                    originalFile: file,
                    originalPreviewUrl: previewUrl,
                    originalWidth: dimensions.width,
                    originalHeight: dimensions.height,
                    resultFile: null,
                    resultPreviewUrl: null,
                    resultWidth: null,
                    resultHeight: null,
                    status: "idle" as BatchItemStatus,
                    error: null,
                };
            })
        );

        setItems((prev) => [...prev, ...nextItems]);
        toast.success(`已加入 ${nextItems.length} 张图片，正在实时处理`);
    }, []);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        void appendFiles(acceptedFiles);
    }, [appendFiles]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpg", ".jpeg", ".png", ".webp", ".bmp"],
        },
        multiple: true,
        noClick: true,
    });

    const clearAll = useCallback(() => {
        itemsRef.current.forEach((item) => {
            revokeUrl(item.originalPreviewUrl);
            revokeUrl(item.resultPreviewUrl);
        });
        setItems([]);
        processRunIdRef.current += 1;
        setIsProcessing(false);
    }, []);

    const removeItem = useCallback((id: string) => {
        setItems((prev) => {
            const target = prev.find((item) => item.id === id);
            if (target) {
                revokeUrl(target.originalPreviewUrl);
                revokeUrl(target.resultPreviewUrl);
            }
            return prev.filter((item) => item.id !== id);
        });
    }, []);

    useEffect(() => {
        if (!itemsSourceSignature) {
            setIsProcessing(false);
            return;
        }

        const currentSettings = normalizeSettings(settings);
        const currentItems = itemsRef.current.map((item) => ({
            id: item.id,
            originalPreviewUrl: item.originalPreviewUrl,
        }));
        const runId = processRunIdRef.current + 1;
        processRunIdRef.current = runId;

        const timer = window.setTimeout(() => {
            void (async () => {
                setIsProcessing(true);
                setItems((prev) =>
                    prev.map((item) => ({
                        ...item,
                        status: "processing",
                        error: null,
                    }))
                );

                const previewResults = await Promise.all(
                    currentItems.map(async (item) => {
                        try {
                            const processed = await processPreviewImage(
                                item.originalPreviewUrl,
                                currentSettings,
                                ratioValue
                            );
                            return {
                                id: item.id,
                                ok: true as const,
                                processed,
                            };
                        } catch (error) {
                            return {
                                id: item.id,
                                ok: false as const,
                                message: error instanceof Error ? error.message : "处理失败",
                            };
                        }
                    })
                );

                if (runId !== processRunIdRef.current) {
                    previewResults.forEach((result) => {
                        if (result.ok) {
                            revokeUrl(result.processed.previewUrl);
                        }
                    });
                    return;
                }

                setItems((prev) =>
                    prev.map((current) => {
                        const result = previewResults.find((entry) => entry.id === current.id);
                        if (!result) {
                            return current;
                        }

                        if (!result.ok) {
                            return {
                                ...current,
                                status: "error",
                                error: result.message,
                            };
                        }

                        revokeUrl(current.resultPreviewUrl);
                        return {
                            ...current,
                            resultPreviewUrl: result.processed.previewUrl,
                            resultWidth: result.processed.width,
                            resultHeight: result.processed.height,
                            status: "done",
                            error: null,
                        };
                    })
                );

                if (runId === processRunIdRef.current) {
                    setIsProcessing(false);
                }
            })();
        }, AUTO_PROCESS_DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
        };
    }, [itemsSourceSignature, ratioValue, settings]);

    const handleExport = useCallback(async () => {
        const exportItems = items.filter((item) => item.status === "done");
        if (!exportItems.length) {
            toast.error("没有可导出的结果");
            return;
        }

        setIsExporting(true);
        try {
            const saveAs = await loadSaveAs();

            const renderedFiles = await Promise.all(
                exportItems.map((item) =>
                    processFullResolutionImage(item.originalFile, normalizeSettings(settings), ratioValue)
                )
            );

            if (renderedFiles.length === 1) {
                const single = renderedFiles[0].file;
                saveAs(single, single.name);
                toast.success("已导出 1 张图片");
                return;
            }

            const JSZip = await loadJSZip();
            const zip = new (JSZip as new () => {
                file: (name: string, data: Blob | File) => void;
                generateAsync: (options: { type: "blob" }) => Promise<Blob>;
            })();

            renderedFiles.forEach((item) => {
                zip.file(item.file.name, item.file);
            });

            const zipBlob = await zip.generateAsync({ type: "blob" });
            saveAs(zipBlob, `batch-workbench-${Date.now()}.zip`);
            toast.success(`已导出 ${exportItems.length} 张图片`);
        } finally {
            setIsExporting(false);
        }
    }, [items, ratioValue, settings]);

    return (
        <div className="min-h-screen bg-[#f6f4ee] px-4 py-5 text-slate-900 md:px-6">
            <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
                <Card className="border-white/70 bg-white/88 shadow-lg shadow-black/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Wand2 className="h-5 w-5 text-slate-700" />
                            批量图片工作台
                        </CardTitle>
                        <CardDescription>
                            参数一改就自动重算结果，左侧保留参数历史，方便撤销、重做和恢复版本。
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/88 p-3 shadow-sm shadow-black/5">
                            <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}>
                                <Undo2 className="h-3.5 w-3.5" />
                                撤销
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo}>
                                <Redo2 className="h-3.5 w-3.5" />
                                重做
                            </Button>
                            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        历史
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[720px]">
                                    <div className="rounded-[28px] border border-slate-200/80 bg-white/96 p-6 shadow-2xl shadow-black/10">
                                        <DialogHeader className="pr-10">
                                            <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
                                                <History className="h-5 w-5 text-slate-700" />
                                                历史记录
                                            </DialogTitle>
                                            <DialogDescription>
                                                点击任一版本，直接恢复到当时的处理参数。
                                            </DialogDescription>
                                        </DialogHeader>

                                        <ScrollArea className="mt-5 h-[420px] rounded-2xl border border-slate-200 bg-slate-50/70">
                                            <div className="space-y-3 p-4">
                                                {historyEntries
                                                    .map((entry, index) => ({ entry, index }))
                                                    .reverse()
                                                    .map(({ entry, index }) => {
                                                        const isCurrent = index === historyIndex;
                                                        return (
                                                            <button
                                                                key={entry.id}
                                                                type="button"
                                                                onClick={() => restoreHistoryEntry(index)}
                                                                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                                                    isCurrent
                                                                        ? "border-slate-900 bg-white shadow-sm"
                                                                        : "border-slate-200 bg-white/90 hover:border-slate-300 hover:bg-white"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-base font-semibold text-slate-900">
                                                                            {entry.label}
                                                                        </div>
                                                                        <div className="mt-1 text-sm text-slate-500">
                                                                            {formatHistoryTime(entry.createdAt)}
                                                                        </div>
                                                                    </div>
                                                                    {isCurrent && (
                                                                        <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                                                                            当前
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Badge
                                variant="outline"
                                className={
                                    isProcessing
                                        ? "border-sky-200 bg-sky-50 text-sky-700"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }
                            >
                                {isProcessing ? "实时处理中" : "结果已同步"}
                            </Badge>
                            <Button variant="outline" onClick={open}>
                                选择图片
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => void handleExport()}
                                disabled={isExporting || !processedCount}
                            >
                                {isExporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                导出结果
                            </Button>
                            <Button variant="ghost" onClick={clearAll} disabled={!items.length}>
                                <Trash2 className="h-4 w-4" />
                                清空
                            </Button>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                        <div className="space-y-4">
                            <Card className="border-slate-200/80 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                        <RotateCw className="h-4 w-4" />
                                        处理流程
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <Label>旋转矫正</Label>
                                                <span className="text-xs text-slate-500">
                                                    {rotationOptions.find((option) => option.value === settings.rotation)
                                                        ?.label ?? "不旋转"}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {rotationOptions.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        title={option.label}
                                                        aria-label={option.label}
                                                        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                                                            settings.rotation === option.value
                                                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                                        }`}
                                                        onClick={() => {
                                                            if (settingsRef.current.rotation === option.value) {
                                                                return;
                                                            }
                                                            const nextSettings = {
                                                                ...settingsRef.current,
                                                                rotation: option.value,
                                                            };
                                                            applySettings(nextSettings);
                                                            pushHistorySnapshot(nextSettings, option.historyLabel);
                                                        }}
                                                    >
                                                        <option.icon className="h-4 w-4" />
                                                        {option.badge && (
                                                            <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold leading-none text-slate-900 shadow-sm">
                                                                {option.badge}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <Label>裁切模式</Label>
                                                <span className="text-xs text-slate-500">
                                                    {cropModeOptions.find((option) => option.value === settings.cropMode)
                                                        ?.label ?? "按比例裁切"}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {cropModeOptions.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        title={option.label}
                                                        aria-label={option.label}
                                                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                                                            settings.cropMode === option.value
                                                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                                        }`}
                                                        onClick={() => {
                                                            if (settingsRef.current.cropMode === option.value) {
                                                                return;
                                                            }
                                                            const nextSettings = {
                                                                ...settingsRef.current,
                                                                cropMode: option.value,
                                                            };
                                                            applySettings(nextSettings);
                                                            pushHistorySnapshot(nextSettings, option.historyLabel);
                                                        }}
                                                    >
                                                        <option.icon className="h-4 w-4" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {settings.cropMode === "ratio" && (
                                            <div className="space-y-2">
                                                <Label>比例</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {ratioPresetOptions.map((option) => (
                                                        <Button
                                                            key={option.label}
                                                            type="button"
                                                            variant={
                                                                settings.ratioPreset === option.label
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                            className="h-8 rounded-full px-3 text-xs"
                                                            onClick={() => {
                                                                if (
                                                                    settingsRef.current.ratioPreset === option.label
                                                                ) {
                                                                    return;
                                                                }
                                                                const nextSettings = {
                                                                    ...settingsRef.current,
                                                                    ratioPreset: option.label,
                                                                };
                                                                applySettings(nextSettings);
                                                                pushHistorySnapshot(
                                                                    nextSettings,
                                                                    `比例 ${option.label}`
                                                                );
                                                            }}
                                                        >
                                                            {option.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {settings.cropMode === "fixed" && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label htmlFor="target-width">目标宽度</Label>
                                                    <Input
                                                        id="target-width"
                                                        type="number"
                                                        min={1}
                                                        value={settings.targetWidth}
                                                        onChange={(event) =>
                                                            patchSettings({
                                                                targetWidth: Math.max(
                                                                    1,
                                                                    Number(event.target.value) || 1
                                                                ),
                                                            })
                                                        }
                                                        onBlur={() => commitCurrentSettings("更新固定宽度")}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="target-height">目标高度</Label>
                                                    <Input
                                                        id="target-height"
                                                        type="number"
                                                        min={1}
                                                        value={settings.targetHeight}
                                                        onChange={(event) =>
                                                            patchSettings({
                                                                targetHeight: Math.max(
                                                                    1,
                                                                    Number(event.target.value) || 1
                                                                ),
                                                            })
                                                        }
                                                        onBlur={() => commitCurrentSettings("更新固定高度")}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-5 text-slate-600">
                                        这版是统一规则的批量裁切。你一改参数，右侧结果会自动刷新；不用再点开始处理。
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200/80 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                        <Zap className="h-4 w-4" />
                                        压缩配置
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                                        <span>启用压缩</span>
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={settings.shouldCompress}
                                            onChange={(event) => {
                                                const nextSettings = {
                                                    ...settingsRef.current,
                                                    shouldCompress: event.target.checked,
                                                };
                                                applySettings(nextSettings);
                                                pushHistorySnapshot(nextSettings, event.target.checked ? "启用压缩" : "关闭压缩");
                                            }}
                                        />
                                    </label>

                                    <div className="space-y-2">
                                        <Label htmlFor="target-size">目标体积 MB</Label>
                                        <Input
                                            id="target-size"
                                            type="number"
                                            min={0.1}
                                            step={0.1}
                                            disabled={!settings.shouldCompress}
                                            value={settings.targetSizeMB}
                                            onChange={(event) =>
                                                patchSettings({
                                                    targetSizeMB: Math.max(
                                                        0.1,
                                                        Number(event.target.value) || 0.1
                                                    ),
                                                })
                                            }
                                            onBlur={() => commitCurrentSettings("更新目标体积")}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <Label>保留尺寸</Label>
                                            <span className="text-slate-500">{settings.resizePercent}%</span>
                                        </div>
                                        <Slider
                                            min={10}
                                            max={100}
                                            step={1}
                                            disabled={!settings.shouldCompress || settings.forceToTarget}
                                            value={[settings.resizePercent]}
                                            onValueChange={(value) =>
                                                patchSettings({ resizePercent: value[0] ?? 100 })
                                            }
                                            onValueCommit={(value) => {
                                                const nextSettings = {
                                                    ...settingsRef.current,
                                                    resizePercent: value[0] ?? 100,
                                                };
                                                pushHistorySnapshot(nextSettings, `保留尺寸 ${nextSettings.resizePercent}%`);
                                            }}
                                        />
                                    </div>

                                    <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                                        <span>强制压到目标体积</span>
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            disabled={!settings.shouldCompress}
                                            checked={settings.forceToTarget}
                                            onChange={(event) => {
                                                const nextSettings = {
                                                    ...settingsRef.current,
                                                    forceToTarget: event.target.checked,
                                                };
                                                applySettings(nextSettings);
                                                pushHistorySnapshot(
                                                    nextSettings,
                                                    event.target.checked ? "启用强制压缩" : "关闭强制压缩"
                                                );
                                            }}
                                        />
                                    </label>
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200/80 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold">批次概览</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="text-slate-500">图片数</div>
                                        <div className="mt-1 text-lg font-semibold">{items.length}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="text-slate-500">已完成</div>
                                        <div className="mt-1 text-lg font-semibold">{processedCount}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="text-slate-500">原始体积</div>
                                        <div className="mt-1 text-sm font-semibold">{formatFileSize(totalOriginalSize)}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="text-slate-500">结果体积</div>
                                        <div className="mt-1 text-sm font-semibold">
                                            {totalResultSize ? formatFileSize(totalResultSize) : "--"}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="text-slate-500">失败</div>
                                        <div className="mt-1 text-lg font-semibold">{failedCount}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="text-slate-500">状态</div>
                                        <div className="mt-1 text-sm font-semibold">
                                            {isProcessing ? "实时处理中" : items.length ? "已同步" : "--"}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                        <div className="space-y-4">
                            <Card className="border-slate-200/80 shadow-none">
                                <CardContent className="pt-6">
                                    <div
                                        {...getRootProps()}
                                        className={`rounded-2xl border border-dashed p-5 transition ${
                                            isDragActive
                                                ? "border-slate-900 bg-slate-100"
                                                : "border-slate-300 bg-slate-50/70"
                                        }`}
                                    >
                                        <input {...getInputProps()} />
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <Upload className="h-4 w-4" />
                                                    拖入图片后自动处理
                                                </div>
                                                <p className="text-sm text-slate-500">
                                                    支持 JPG、PNG、WEBP、BMP。参数变化后会自动重算预览。
                                                </p>
                                            </div>

                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                {items.map((item) => (
                                    <Card key={item.id} className="overflow-hidden border-slate-200/80 shadow-none">
                                        <CardContent className="space-y-3 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">{item.name}</div>
                                                    <div className="mt-1 text-xs text-slate-500">
                                                        {item.originalWidth} x {item.originalHeight} ·{" "}
                                                        {formatFileSize(item.originalFile.size)}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => removeItem(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-[28px] bg-transparent">
                                                {item.resultPreviewUrl ? (
                                                    <img
                                                        src={item.resultPreviewUrl}
                                                        alt={`${item.name} result`}
                                                        className="max-h-[320px] w-full object-contain"
                                                    />
                                                ) : (
                                                    <span className="text-xs text-slate-400">等待处理中</span>
                                                )}
                                            </div>

                                            {item.error && (
                                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                                    {item.error}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
