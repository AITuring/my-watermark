import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import { buildSavedCropFileName, getOutputSize, sanitizeFileSegment } from "../helpers";
import { drawCropToBlob } from "../image-utils";
import type { CropImage, CropMode, SavedCrop, SavedCropGroup } from "../types";
import { setPendingCropTransfer, type TransferTarget } from "@/utils/crop-transfer";
import { loadJSZip, loadSaveAs } from "@/utils/lazy-deps";

type ZipFolder = {
    file: (name: string, data: Blob | File) => void;
};

type ZipInstance = ZipFolder & {
    folder: (name: string) => ZipFolder | undefined;
    generateAsync: (options: { type: "blob" }) => Promise<Blob>;
};

type ZipConstructor = new () => ZipInstance;

type UseCropExportsParams = {
    activeImage: CropImage | null;
    mode: CropMode;
    targetWidth: number;
    targetHeight: number;
    navigate: NavigateFunction;
};

export function useCropExports({
    activeImage,
    mode,
    targetWidth,
    targetHeight,
    navigate,
}: UseCropExportsParams) {
    const [isRoutingExporting, setIsRoutingExporting] = useState(false);
    const [savedCrops, setSavedCrops] = useState<SavedCrop[]>([]);
    const savedPreviewUrlsRef = useRef<string[]>([]);
    const savedCropSequenceRef = useRef<Record<string, number>>({});

    const groupedSavedCrops = useMemo<SavedCropGroup[]>(() => {
        const groups: SavedCropGroup[] = [];
        savedCrops.forEach((item) => {
            const existingGroup = groups.find((group) => group.sourceImageId === item.sourceImageId);
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

        const nextIndex = (savedCropSequenceRef.current[activeImage.id] ?? 0) + 1;
        savedCropSequenceRef.current[activeImage.id] = nextIndex;

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

    const exportBatch = useCallback(async () => {
        if (!savedCrops.length) {
            toast.error("请先暂存裁切结果");
            return;
        }

        const JSZip = (await loadJSZip()) as ZipConstructor;
        const saveAs = await loadSaveAs();
        const zip = new JSZip();
        groupedSavedCrops.forEach((group) => {
            const folder = zip.folder(sanitizeFileSegment(group.sourceName));
            group.items.forEach((item) => {
                folder?.file(item.file.name, item.file);
            });
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `crop-batch-${Date.now()}.zip`);
        toast.success(`已批量导出 ${savedCrops.length} 张`);
    }, [groupedSavedCrops, savedCrops.length]);

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

                setPendingCropTransfer(target, files);
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
        isRoutingExporting,
        removeSavedCrop,
        routeWithCrops,
        saveCurrentCrop,
        savedCrops,
    };
}
