import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import { buildSavedCropFileName, getOutputSize } from "../helpers";
import { drawCropToBlob } from "../image-utils";
import type { CropImage, CropMode, SavedCrop, SavedCropGroup } from "../types";
import { setPendingCropTransfer, type TransferTarget } from "@/utils/crop-transfer";
import { clearFileSession, loadFileSession, saveFileSession } from "@/utils/file-storage";
import { loadJSZip, loadSaveAs } from "@/utils/lazy-deps";
import { downloadFilesIndividually } from "@/utils/download-files";

type ZipInstance = {
    file: (name: string, data: Blob | File) => void;
    generateAsync: (options: { type: "blob"; streamFiles?: boolean }) => Promise<Blob>;
};

type ZipConstructor = new () => ZipInstance;

type SavedCropMetadata = Omit<SavedCrop, "file" | "previewUrl">;

const SAVED_CROPS_METADATA_KEY = "my-watermark:crop-saved-crops";

type UseCropExportsParams = {
    activeImage: CropImage | null;
    mode: CropMode;
    targetWidth: number;
    targetHeight: number;
    navigate: NavigateFunction;
};

export type CropBatchProgress = {
    completed: number;
    total: number;
};

export function useCropExports({
    activeImage,
    mode,
    targetWidth,
    targetHeight,
    navigate,
}: UseCropExportsParams) {
    const [isRoutingExporting, setIsRoutingExporting] = useState(false);
    const [isBatchExporting, setIsBatchExporting] = useState(false);
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [batchProgress, setBatchProgress] = useState<CropBatchProgress | null>(null);
    const [savedCrops, setSavedCrops] = useState<SavedCrop[]>([]);
    const [savedCropsHydrated, setSavedCropsHydrated] = useState(false);
    const savedPreviewUrlsRef = useRef<string[]>([]);
    const savedCropSequenceRef = useRef<Record<string, number>>({});
    const restoreSavedCropsStartedRef = useRef(false);

    useEffect(() => {
        if (restoreSavedCropsStartedRef.current) return;
        restoreSavedCropsStartedRef.current = true;

        const restoreSavedCrops = async () => {
            let metadata: SavedCropMetadata[] = [];
            try {
                const raw = window.localStorage.getItem(SAVED_CROPS_METADATA_KEY);
                if (raw) {
                    const parsed: unknown = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        metadata = parsed as SavedCropMetadata[];
                    }
                }
            } catch (error) {
                console.warn("读取裁切暂存列表失败", error);
            }

            const files = await loadFileSession("crop-saved-crops");
            const restored = files
                .map((file, index) => {
                    const item = metadata[index];
                    if (!item) return null;
                    const previewUrl = URL.createObjectURL(file);
                    savedPreviewUrlsRef.current.push(previewUrl);
                    savedCropSequenceRef.current[item.sourceName] = Math.max(
                        savedCropSequenceRef.current[item.sourceName] ?? 0,
                        item.index
                    );
                    return { ...item, file, previewUrl };
                })
                .filter((item): item is SavedCrop => Boolean(item));

            setSavedCrops(restored);
            setSavedCropsHydrated(true);
        };

        void restoreSavedCrops();
    }, []);

    useEffect(() => {
        if (!savedCropsHydrated) return;

        const metadata: SavedCropMetadata[] = savedCrops.map((item) => ({
            id: item.id,
            sourceImageId: item.sourceImageId,
            sourceName: item.sourceName,
            index: item.index,
            outputW: item.outputW,
            outputH: item.outputH,
        }));
        try {
            if (metadata.length) {
                window.localStorage.setItem(
                    SAVED_CROPS_METADATA_KEY,
                    JSON.stringify(metadata)
                );
            } else {
                window.localStorage.removeItem(SAVED_CROPS_METADATA_KEY);
            }
        } catch (error) {
            console.warn("保存裁切暂存列表失败", error);
        }

        const files = savedCrops.map((item) => item.file);
        void (files.length
            ? saveFileSession("crop-saved-crops", files)
            : clearFileSession("crop-saved-crops"));
    }, [savedCrops, savedCropsHydrated]);

    const groupedSavedCrops = useMemo<SavedCropGroup[]>(() => {
        const groups: SavedCropGroup[] = [];
        savedCrops.forEach((item) => {
            const existingGroup = groups.find((group) => group.sourceName === item.sourceName);
            if (existingGroup) {
                existingGroup.items.push(item);
                return;
            }
            groups.push({
                sourceImageId: item.sourceImageId,
                sourceName: item.sourceName,
                items: [item],
            });
        });
        return groups;
    }, [savedCrops]);

    const releaseSavedPreviewUrl = useCallback((url: string) => {
        URL.revokeObjectURL(url);
        savedPreviewUrlsRef.current = savedPreviewUrlsRef.current.filter((item) => item !== url);
    }, []);

    const exportCurrent = useCallback(async () => {
        if (!activeImage) {
            toast.error("请先上传图片");
            return;
        }

        const crop = activeImage.crop;
        const { outputW, outputH } = getOutputSize(crop, mode, targetWidth, targetHeight);
        const blob = await drawCropToBlob(activeImage, crop, outputW, outputH);
        if (!blob) {
            toast.error("导出失败");
            return;
        }

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${activeImage.name}-crop-${outputW}x${outputH}.jpg`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success(`已导出 ${outputW} × ${outputH}`);
    }, [activeImage, mode, targetHeight, targetWidth]);

    const saveCurrentCrop = useCallback(async () => {
        if (!activeImage) {
            toast.error("请先选择图片");
            return;
        }

        const crop = activeImage.crop;
        const { outputW, outputH } = getOutputSize(crop, mode, targetWidth, targetHeight);
        const blob = await drawCropToBlob(activeImage, crop, outputW, outputH);
        if (!blob) {
            toast.error("暂存失败");
            return;
        }

        const sequenceKey = activeImage.name;
        const nextIndex = (savedCropSequenceRef.current[sequenceKey] ?? 0) + 1;
        savedCropSequenceRef.current[sequenceKey] = nextIndex;

        const fileName = buildSavedCropFileName(activeImage.name, nextIndex, outputW, outputH);
        const file = new File([blob], fileName, { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(file);
        savedPreviewUrlsRef.current.push(previewUrl);

        setSavedCrops((prev) => [
            ...prev,
            {
                id: `${activeImage.id}-${nextIndex}-${Date.now()}`,
                sourceImageId: activeImage.id,
                sourceName: activeImage.name,
                index: nextIndex,
                previewUrl,
                outputW,
                outputH,
                file,
            },
        ]);
        toast.success(`已暂存 ${activeImage.name} 的第 ${nextIndex} 张裁切图`);
    }, [activeImage, mode, targetHeight, targetWidth]);

    const saveBatchCrops = useCallback(async (images: CropImage[]) => {
        if (!images.length) {
            toast.error("请先选择要批量裁切的图片");
            return;
        }
        if (batchProgress) return;

        setBatchProgress({ completed: 0, total: images.length });
        const generated: SavedCrop[] = [];
        try {
            for (const image of images) {
                const { outputW, outputH } = getOutputSize(image.crop, mode, targetWidth, targetHeight);
                const blob = await drawCropToBlob(image, image.crop, outputW, outputH);
                if (!blob) throw new Error(`${image.name} 裁切失败`);

                const sequenceKey = image.name;
                const nextIndex = (savedCropSequenceRef.current[sequenceKey] ?? 0) + 1;
                savedCropSequenceRef.current[sequenceKey] = nextIndex;
                const fileName = buildSavedCropFileName(image.name, nextIndex, outputW, outputH);
                const file = new File([blob], fileName, { type: "image/jpeg" });
                const previewUrl = URL.createObjectURL(file);
                savedPreviewUrlsRef.current.push(previewUrl);
                generated.push({
                    id: `${image.id}-${nextIndex}-${Date.now()}`,
                    sourceImageId: image.id,
                    sourceName: image.name,
                    index: nextIndex,
                    previewUrl,
                    outputW,
                    outputH,
                    file,
                });
                setBatchProgress({ completed: generated.length, total: images.length });
            }
            setSavedCrops((prev) => [...prev, ...generated]);
            toast.success(`已批量暂存 ${generated.length} 张裁切图`);
        } catch (error) {
            generated.forEach((item) => releaseSavedPreviewUrl(item.previewUrl));
            toast.error(error instanceof Error ? error.message : "批量裁切失败，请重试");
        } finally {
            setBatchProgress(null);
        }
    }, [batchProgress, mode, releaseSavedPreviewUrl, targetHeight, targetWidth]);

    const exportBatch = useCallback(async () => {
        if (!savedCrops.length) {
            toast.error("请先暂存裁切结果");
            return;
        }

        if (isBatchExporting) return;

        const items = [...savedCrops];
        setIsBatchExporting(true);

        try {
            const [JSZip, saveAs] = await Promise.all([
                loadJSZip() as Promise<ZipConstructor>,
                loadSaveAs(),
            ]);
            const zip = new JSZip();
            items.forEach((item) => {
                zip.file(item.file.name, item.file);
            });

            const zipBlob = await zip.generateAsync({
                type: "blob",
                streamFiles: true,
            });
            if (!zipBlob.size) {
                throw new Error("ZIP 文件为空");
            }

            saveAs(zipBlob, `crop-batch-${Date.now()}.zip`);
            toast.success(`已批量导出 ${items.length} 张`);
        } catch (error) {
            console.error("导出裁切 ZIP 失败", error);
            toast.error(
                error instanceof Error
                    ? `导出 ZIP 失败：${error.message}`
                    : "导出 ZIP 失败，请重试"
            );
        } finally {
            setIsBatchExporting(false);
        }
    }, [isBatchExporting, savedCrops]);

    const downloadBatch = useCallback(async () => {
        if (!savedCrops.length) {
            toast.error("请先暂存裁切结果");
            return;
        }

        if (isBatchDownloading) return;

        const items = [...savedCrops];
        setIsBatchDownloading(true);
        try {
            await downloadFilesIndividually(
                items.map((item) => ({ data: item.file, name: item.file.name }))
            );
            toast.success(`已开始下载 ${items.length} 张裁切图`,
                items.length > 1
                    ? {
                          description: "部分浏览器会拦截多文件下载，可改用 ZIP 一次保存全部结果。",
                          duration: 8000,
                          action: {
                              label: "导出 ZIP",
                              onClick: () => void exportBatch(),
                          },
                      }
                    : undefined
            );
        } catch (error) {
            console.error("批量下载裁切图失败", error);
            toast.error(error instanceof Error ? `批量下载失败：${error.message}` : "批量下载失败，请重试", {
                action:
                    items.length > 1
                        ? {
                              label: "改用 ZIP",
                              onClick: () => void exportBatch(),
                          }
                        : undefined,
            });
        } finally {
            setIsBatchDownloading(false);
        }
    }, [exportBatch, isBatchDownloading, savedCrops]);

    const routeWithCrops = useCallback(
        async (target: TransferTarget) => {
            if (!savedCrops.length) {
                toast.error("请先暂存裁切结果");
                return;
            }

            try {
                setIsRoutingExporting(true);
                const files = savedCrops.map((item) => item.file);
                if (!files.length) {
                    toast.error("裁切结果生成失败");
                    return;
                }

                await setPendingCropTransfer(target, files);
                navigate(target === "watermark" ? "/watermark" : "/puzzle");
                toast.success(
                    `已发送 ${files.length} 张裁切图到${target === "watermark" ? "水印" : "拼图"}`
                );
            } catch (error) {
                console.error(error);
                toast.error("发送失败，请重试");
            } finally {
                setIsRoutingExporting(false);
            }
        },
        [navigate, savedCrops]
    );

    const removeSavedCrop = useCallback(
        (id: string) => {
            setSavedCrops((prev) => {
                const target = prev.find((item) => item.id === id);
                if (!target) return prev;
                releaseSavedPreviewUrl(target.previewUrl);
                return prev.filter((item) => item.id !== id);
            });
        },
        [releaseSavedPreviewUrl]
    );

    const clearSavedCrops = useCallback(() => {
        savedPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        savedPreviewUrlsRef.current = [];
        savedCropSequenceRef.current = {};
        setSavedCrops([]);
    }, []);

    useEffect(() => {
        return () => {
            savedPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            savedPreviewUrlsRef.current = [];
        };
    }, []);

    return {
        clearSavedCrops,
        exportBatch,
        exportCurrent,
        groupedSavedCrops,
        isBatchDownloading,
        isBatchExporting,
        batchProgress,
        isRoutingExporting,
        removeSavedCrop,
        downloadBatch,
        routeWithCrops,
        saveCurrentCrop,
        saveBatchCrops,
        savedCrops,
    };
}
