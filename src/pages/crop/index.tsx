import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CropEditor from "./components/CropEditor";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import {
    buildUniqueNames,
    clamp,
    createCenteredCrop,
    createCenteredFreeCrop,
    fitBoxInImage,
    getDefaultCrop,
} from "./helpers";
import { createEditorPreviewAsset, transformImageAsset } from "./image-utils";
import { getLargeImageAsset } from '@/utils/large-image';
import { useCropExports } from "./hooks/useCropExports";
import { useCropInteractions } from "./hooks/useCropInteractions";
import { useCropHistory } from "./hooks/useCropHistory";
import type {
    CropImage,
    CropMode,
    CropPercent,
    ViewportRect,
    ViewportSize,
} from "./types";
import { ratioOptions } from "./types";
import { consumePendingCropTransfer } from "@/utils/crop-transfer";
import { estimateFileStorage, loadFileSession, saveFileSession, type FileStorageEstimate } from "@/utils/file-storage";

const DEFAULT_VIEWPORT_RECT: ViewportRect = { left: 0, top: 0, width: 1, height: 1 };
const DEFAULT_VIEWPORT_SIZE: ViewportSize = { width: 0, height: 0 };
const EMPTY_STORAGE_ESTIMATE: FileStorageEstimate = { fileBytes: 0, quotaBytes: null };
const CROP_SESSION_WARNING_BYTES = 80 * 1024 * 1024;
const CROP_SESSION_KEY = "my-watermark:crop-session";
const CROP_SESSION_VERSION = 1;

type CropSessionImage = {
    name: string;
    crop: CropImage["crop"];
};

type CropSessionState = {
    version: number;
    images: CropSessionImage[];
    activeIndex: number | null;
    selectedIndexes: number[];
    mode: CropMode;
    targetWidth: number;
    targetHeight: number;
    ratioPreset: string;
    customRatioW: number;
    customRatioH: number;
    customAngle: number;
};

const readCropSession = (): CropSessionState | null => {
    try {
        const raw = window.localStorage.getItem(CROP_SESSION_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        const state = parsed as Partial<CropSessionState>;
        if (
            state.version !== CROP_SESSION_VERSION ||
            !Array.isArray(state.images) ||
            !["fixed", "ratio", "free"].includes(state.mode ?? "")
        ) {
            return null;
        }
        return state as CropSessionState;
    } catch (error) {
        console.warn("读取裁切会话失败", error);
        return null;
    }
};

export default function ImageCropper() {
    const navigate = useNavigate();
    const [images, setImages] = useState<CropImage[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [mode, setMode] = useState<CropMode>("ratio");
    const [targetWidth, setTargetWidth] = useState(1080);
    const [targetHeight, setTargetHeight] = useState(1350);
    const [ratioPreset, setRatioPreset] = useState("1:1");
    const [customRatioW, setCustomRatioW] = useState(1);
    const [customRatioH, setCustomRatioH] = useState(1);
    const [customAngle, setCustomAngle] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [viewportRect, setViewportRect] = useState<ViewportRect>(DEFAULT_VIEWPORT_RECT);
    const [viewportSize, setViewportSize] = useState<ViewportSize>(DEFAULT_VIEWPORT_SIZE);
    const [imagesHydrated, setImagesHydrated] = useState(false);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [selectedSavedCropIds, setSelectedSavedCropIds] = useState<string[]>([]);
    const [storageEstimate, setStorageEstimate] = useState<FileStorageEstimate>(EMPTY_STORAGE_ESTIMATE);
    const [isDragActive, setIsDragActive] = useState(false);

    const stageRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const objectUrlsRef = useRef<string[]>([]);
    const restoreStartedRef = useRef(false);
    const persistedImagesKeyRef = useRef<string | null>(null);
    const dragDepthRef = useRef(0);

    const selectedRatio = useMemo<number | null>(() => {
        if (mode === "free") {
            return null;
        }
        if (mode === "fixed") {
            return Math.max(targetWidth, 1) / Math.max(targetHeight, 1);
        }
        if (ratioPreset === "自定义") {
            return Math.max(customRatioW, 1) / Math.max(customRatioH, 1);
        }
        const found = ratioOptions.find((item) => item.label === ratioPreset);
        return found?.value ?? 1;
    }, [mode, targetWidth, targetHeight, ratioPreset, customRatioW, customRatioH]);

    const isFreeMode = mode === "free";

    const activeImage = useMemo(
        () => images.find((item) => item.id === activeId) ?? null,
        [images, activeId]
    );

    const {
        canRedo,
        canUndo,
        clearHistory,
        recordCropChange,
        recordImageChange,
        redo,
        undo,
    } = useCropHistory({ activeId, setImages });

    const fitZoom = useMemo(() => {
        if (!activeImage) return 1;
        const horizontalScale = Math.max(0.05, (viewportSize.width - 24) / activeImage.width);
        const verticalScale = Math.max(0.05, (viewportSize.height - 24) / activeImage.height);
        return Math.min(horizontalScale, verticalScale, 1);
    }, [activeImage, viewportSize.height, viewportSize.width]);

    const effectiveZoom = activeImage ? zoom : 1;
    const displayWidth = activeImage ? Math.max(1, Math.round(activeImage.width * effectiveZoom)) : 1;
    const displayHeight = activeImage ? Math.max(1, Math.round(activeImage.height * effectiveZoom)) : 1;

    const shouldUseFullResolution = useMemo(() => {
        if (!activeImage) return false;
        return displayWidth > activeImage.previewWidth * 0.92 || effectiveZoom >= 1;
    }, [activeImage, displayWidth, effectiveZoom]);

    const currentDisplayUrl = activeImage
        ? shouldUseFullResolution
            ? activeImage.url
            : activeImage.previewUrl
        : "";

    const currentDisplayLabel = shouldUseFullResolution ? "高清" : "流畅预览";

    const cropPercent = useMemo<CropPercent | null>(() => {
        if (!activeImage) return null;
        const { crop, width, height } = activeImage;
        return {
            left: (crop.x / width) * 100,
            top: (crop.y / height) * 100,
            width: (crop.w / width) * 100,
            height: (crop.h / height) * 100,
        };
    }, [activeImage]);

    const shouldShowMinimap = useMemo(() => {
        if (!activeImage) return false;
        const isZoomedIn = effectiveZoom > fitZoom * 1.25;
        const viewportIsClipped = viewportRect.width < 0.92 || viewportRect.height < 0.92;
        return isZoomedIn && viewportIsClipped;
    }, [activeImage, effectiveZoom, fitZoom, viewportRect.height, viewportRect.width]);

    const updateViewportRect = () => {
        const viewport = viewportRef.current;
        const stage = stageRef.current;
        if (!viewport || !stage || !activeImage) {
            setViewportRect(DEFAULT_VIEWPORT_RECT);
            return;
        }

        const stageWidth = stage.offsetWidth || 1;
        const stageHeight = stage.offsetHeight || 1;
        const left = clamp((viewport.scrollLeft - stage.offsetLeft) / stageWidth, 0, 1);
        const top = clamp((viewport.scrollTop - stage.offsetTop) / stageHeight, 0, 1);
        const width = clamp(viewport.clientWidth / stageWidth, 0, 1);
        const height = clamp(viewport.clientHeight / stageHeight, 0, 1);
        setViewportRect({ left, top, width, height });
    };

    useEffect(() => {
        return () => {
            objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    useLayoutEffect(() => {
        if (!activeImage) return;
        if (viewportSize.width <= 0 || viewportSize.height <= 0) return;
        setZoom(Math.max(fitZoom, 0.01));
    }, [activeImage?.id, fitZoom, viewportSize.height, viewportSize.width]);

    useEffect(() => {
        updateViewportRect();
    }, [activeId, zoom, images.length]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const handleScroll = () => updateViewportRect();
        viewport.addEventListener("scroll", handleScroll);
        window.addEventListener("resize", handleScroll);
        return () => {
            viewport.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
        };
    }, [activeId, zoom]);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const updateViewportSize = () => {
            setViewportSize({
                width: viewport.clientWidth,
                height: viewport.clientHeight,
            });
        };

        updateViewportSize();
        const observer = new ResizeObserver(updateViewportSize);
        observer.observe(viewport);
        window.addEventListener("resize", updateViewportSize);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateViewportSize);
        };
    }, [activeId]);

    const loadFiles = async (files: File[], restoredImages: CropSessionImage[] = []): Promise<CropImage[]> => {
        if (!files.length) return [];

        const loaded = await Promise.all(
            files.map(async (file, index) => {
                    try {
                        const largeAsset = await getLargeImageAsset(file);
                        if (largeAsset) {
                            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                                const preview = new Image();
                                preview.onload = () => resolve(preview);
                                preview.onerror = () => reject(new Error('大图预览读取失败'));
                                preview.src = largeAsset.previewUrl;
                            });
                            const restoredCrop = restoredImages[index]?.crop;
                            const crop = restoredCrop
                                ? fitBoxInImage(restoredCrop, largeAsset.width, largeAsset.height)
                                : mode === 'free'
                                  ? createCenteredFreeCrop(largeAsset.width, largeAsset.height)
                                  : createCenteredCrop(largeAsset.width, largeAsset.height, selectedRatio ?? 1);
                            return {
                                id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                                name: file.name.replace(/\.[^/.]+$/, '') || 'image',
                                file, url: largeAsset.previewUrl, previewUrl: largeAsset.previewUrl,
                                previewWidth: img.width, previewHeight: img.height,
                                width: largeAsset.width, height: largeAsset.height, crop,
                            } satisfies CropImage;
                        }
                    } catch (error) {
                        console.error('大图导入失败:', error);
                        toast.error(error instanceof Error ? error.message : '大图导入失败');
                        return null;
                    }
                    return new Promise<CropImage | null>((resolve) => {
                        const url = URL.createObjectURL(file);
                        const img = new Image();
                        img.src = url;
                        img.onload = async () => {
                            objectUrlsRef.current.push(url);
                            const preview = await createEditorPreviewAsset(img, img.width, img.height, url);
                            if (preview.url !== url) {
                                objectUrlsRef.current.push(preview.url);
                            }
                            const restoredCrop = restoredImages[index]?.crop;
                            const crop = restoredCrop
                                ? fitBoxInImage(restoredCrop, img.width, img.height)
                                : mode === "free"
                                  ? createCenteredFreeCrop(img.width, img.height)
                                  : createCenteredCrop(img.width, img.height, selectedRatio ?? 1);
                            resolve({
                                id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                                name: file.name.replace(/\.[^/.]+$/, "") || "image",
                                file,
                                url,
                                previewUrl: preview.url,
                                previewWidth: preview.width,
                                previewHeight: preview.height,
                                width: img.width,
                                height: img.height,
                                crop,
                            });
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(url);
                            resolve(null);
                        };
                    });
            })
        );

        const valid = loaded.filter((item): item is CropImage => Boolean(item));
        if (!valid.length) {
            toast.error("图片读取失败");
            return [];
        }

        const uniqueNames = buildUniqueNames(
            images.map((item) => item.name),
            valid.map((item) => item.name)
        );
        const nextImages = valid.map((item, index) => ({
            ...item,
            name: restoredImages[index]?.name || uniqueNames[index],
        }));

        setImages((prev) => [...prev, ...nextImages]);
        setSelectedImageIds((prev) => [...prev, ...nextImages.map((item) => item.id)]);
        setActiveId((prev) => prev ?? nextImages[0].id);
        toast.success(`已加载 ${valid.length} 张图片`);
        return nextImages;
    };

    useEffect(() => {
        if (restoreStartedRef.current) return;
        restoreStartedRef.current = true;

        const restoreImages = async () => {
            const incomingFiles = await consumePendingCropTransfer("crop");
            const files = incomingFiles.length
                ? incomingFiles
                : await loadFileSession("crop-images");
            const session = incomingFiles.length ? null : readCropSession();

            if (session) {
                setMode(session.mode);
                setTargetWidth(session.targetWidth);
                setTargetHeight(session.targetHeight);
                setRatioPreset(session.ratioPreset);
                setCustomRatioW(session.customRatioW);
                setCustomRatioH(session.customRatioH);
                setCustomAngle(session.customAngle);
            }

            if (files.length) {
                const restored = await loadFiles(files, session?.images);
                if (session) {
                    const selected = session.selectedIndexes
                        .map((index) => restored[index]?.id)
                        .filter((id): id is string => Boolean(id));
                    setSelectedImageIds(selected.length ? selected : restored.map((item) => item.id));
                    setActiveId(restored[session.activeIndex ?? 0]?.id ?? restored[0]?.id ?? null);
                }
            }

            setImagesHydrated(true);
        };

        void restoreImages();
    }, []);

    useEffect(() => {
        if (!imagesHydrated) return;
        const files = images.map((image) => image.file);
        const filesKey = files
            .map((file) => `${file.name}:${file.size}:${file.lastModified}:${file.type}`)
            .join("|");
        if (persistedImagesKeyRef.current === filesKey) return;
        persistedImagesKeyRef.current = filesKey;
        void saveFileSession("crop-images", files);
    }, [images, imagesHydrated]);

    useEffect(() => {
        if (!imagesHydrated) return;
        const timer = window.setTimeout(() => {
            const activeIndex = activeId ? images.findIndex((item) => item.id === activeId) : -1;
            const session: CropSessionState = {
                version: CROP_SESSION_VERSION,
                images: images.map((item) => ({ name: item.name, crop: item.crop })),
                activeIndex: activeIndex >= 0 ? activeIndex : null,
                selectedIndexes: images.reduce<number[]>((indexes, item, index) => {
                    if (selectedImageIds.includes(item.id)) indexes.push(index);
                    return indexes;
                }, []),
                mode,
                targetWidth,
                targetHeight,
                ratioPreset,
                customRatioW,
                customRatioH,
                customAngle,
            };
            try {
                window.localStorage.setItem(CROP_SESSION_KEY, JSON.stringify(session));
            } catch (error) {
                console.warn("保存裁切会话失败", error);
            }
        }, 180);
        return () => window.clearTimeout(timer);
    }, [
        activeId,
        customAngle,
        customRatioH,
        customRatioW,
        images,
        imagesHydrated,
        mode,
        ratioPreset,
        selectedImageIds,
        targetHeight,
        targetWidth,
    ]);

    const releaseUrl = (url: string) => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url);
    };

    const applyRotationToActive = async (angleDeg: number) => {
        if (!activeImage) {
            toast.error("请先选择图片");
            return;
        }

        if (!Number.isFinite(angleDeg) || Math.abs(angleDeg) < 0.0001) {
            toast.error("请输入有效角度");
            return;
        }

        try {
            const nextImage = await transformImageAsset(activeImage, angleDeg);
            objectUrlsRef.current.push(nextImage.url);
            if (nextImage.previewUrl !== nextImage.url) {
                objectUrlsRef.current.push(nextImage.previewUrl);
            }

            const rotatedImage: CropImage = {
                ...activeImage,
                ...nextImage,
                crop: getDefaultCrop(nextImage.width, nextImage.height, mode, selectedRatio),
            };
            recordImageChange(activeImage, rotatedImage);
            setImages((prev) => prev.map((item) => (item.id === activeImage.id ? rotatedImage : item)));
        } catch (error) {
            console.error(error);
            toast.error("几何变换失败，请重试");
        }
    };

    const { flushScheduledCropUpdate, startDrag } = useCropInteractions({
        activeId,
        activeImage,
        isFreeMode,
        selectedRatio,
        setImages,
        stageRef,
        onCropCommit: recordCropChange,
    });

    const {
        clearSavedCrops,
        exportBatch,
        exportCurrent,
        groupedSavedCrops,
        isBatchDownloading,
        isBatchExporting,
        isRoutingExporting,
        removeSavedCrop,
        routeWithCrops,
        downloadBatch,
        saveCurrentCrop,
        savedCrops,
        batchProgress,
        batchFailures,
        cancelBatchCrops,
        retryFailedCrops,
        saveBatchCrops,
    } = useCropExports({
        activeImage,
        mode,
        targetWidth,
        targetHeight,
        navigate,
    });

    useEffect(() => {
        if (!imagesHydrated) return;
        const files = [...images.map((image) => image.file), ...savedCrops.map((item) => item.file)];
        void estimateFileStorage(files).then(setStorageEstimate);
    }, [images, imagesHydrated, savedCrops]);

    useEffect(() => {
        setSelectedSavedCropIds((previous) => {
            const currentIds = new Set(savedCrops.map((item) => item.id));
            const retained = previous.filter((id) => currentIds.has(id));
            if (!previous.length && savedCrops.length) {
                return savedCrops.map((item) => item.id);
            }
            const previousIds = new Set(previous);
            const added = savedCrops
                .filter((item) => !previousIds.has(item.id))
                .map((item) => item.id);
            return [...retained, ...added];
        });
    }, [savedCrops]);

    const toggleImageSelection = (id: string) => {
        setSelectedImageIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const toggleAllImages = (ids: string[]) => {
        if (!ids.length) return;
        const idSet = new Set(ids);
        setSelectedImageIds((prev) => {
            const allSelected = ids.every((id) => prev.includes(id));
            return allSelected
                ? prev.filter((id) => !idSet.has(id))
                : Array.from(new Set([...prev, ...ids]));
        });
    };

    const batchCropSelected = () => {
        void saveBatchCrops(images.filter((item) => selectedImageIds.includes(item.id)));
    };

    const applyRuleToSelected = () => {
        if (!selectedImageIds.length) {
            toast.error("请先选择要应用规则的图片");
            return;
        }
        const selectedIds = new Set(selectedImageIds);
        const nextCrops = new Map(
            images
                .filter((item) => selectedIds.has(item.id))
                .map((item) => [
                    item.id,
                    isFreeMode
                        ? createCenteredFreeCrop(item.width, item.height)
                        : createCenteredCrop(item.width, item.height, selectedRatio ?? 1),
                ])
        );
        images.forEach((item) => {
            if (nextCrops.has(item.id)) {
                recordCropChange(item, item.crop, nextCrops.get(item.id) ?? item.crop);
            }
        });
        setImages((previous) =>
            previous.map((item) => ({ ...item, crop: nextCrops.get(item.id) ?? item.crop }))
        );
        toast.success(`已将规则应用到 ${nextCrops.size} 张图片`);
    };

    const selectedSavedCrops = useMemo(
        () => savedCrops.filter((item) => selectedSavedCropIds.includes(item.id)),
        [savedCrops, selectedSavedCropIds]
    );

    const toggleSavedCropSelection = (id: string) => {
        setSelectedSavedCropIds((previous) =>
            previous.includes(id)
                ? previous.filter((item) => item !== id)
                : [...previous, id]
        );
    };

    const toggleAllSavedCrops = () => {
        setSelectedSavedCropIds((previous) =>
            previous.length === savedCrops.length ? [] : savedCrops.map((item) => item.id)
        );
    };

    const removeSelectedSavedCrops = () => {
        selectedSavedCrops.forEach((item) => removeSavedCrop(item.id));
    };

    const resetAllCrop = () => {
        const nextCrops = new Map(
            images.map((item) => [
                item.id,
                isFreeMode
                    ? createCenteredFreeCrop(item.width, item.height)
                    : createCenteredCrop(item.width, item.height, selectedRatio ?? 1),
            ])
        );
        images.forEach((item) => recordCropChange(item, item.crop, nextCrops.get(item.id) ?? item.crop));
        setImages((prev) =>
            prev.map((item) => ({ ...item, crop: nextCrops.get(item.id) ?? item.crop }))
        );
    };

    const handleUploadFiles = async (files: File[]) => {
        const imageFiles = files.filter((file) => file.type.startsWith("image/"));
        if (!imageFiles.length) {
            toast.error("没有找到可读取的图片文件");
            return;
        }
        if (imageFiles.length < files.length) {
            toast.warning(`已忽略 ${files.length - imageFiles.length} 个非图片文件`);
        }
        const projectedBytes = storageEstimate.fileBytes + imageFiles.reduce((total, file) => total + file.size, 0);
        const quotaWarning =
            storageEstimate.quotaBytes !== null && projectedBytes / storageEstimate.quotaBytes >= 0.8;
        if (projectedBytes >= CROP_SESSION_WARNING_BYTES || quotaWarning) {
            toast.warning("当前批次会占用较多本地空间，建议处理完成后及时导出并清理暂存。", {
                duration: 6000,
            });
        }
        await loadFiles(imageFiles);
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (!files.length) return;
        await handleUploadFiles(files);
        event.target.value = "";
    };

    const swapAspect = () => {
        if (mode === "fixed") {
            setTargetWidth(targetHeight);
            setTargetHeight(targetWidth);
            return;
        }

        if (mode !== "ratio") return;

        if (ratioPreset === "自定义") {
            setCustomRatioW(customRatioH);
            setCustomRatioH(customRatioW);
            return;
        }

        const ratioMatch = /^(\d+):(\d+)$/.exec(ratioPreset);
        if (!ratioMatch) return;

        const [, width, height] = ratioMatch;
        const swappedPreset = `${height}:${width}`;
        const hasSwappedPreset = ratioOptions.some((item) => item.label === swappedPreset);
        if (hasSwappedPreset) {
            setRatioPreset(swappedPreset);
            return;
        }

        setRatioPreset("自定义");
        setCustomRatioW(Number(height));
        setCustomRatioH(Number(width));
    };

    const removeImage = (id: string) => {
        setSelectedImageIds((prev) => prev.filter((item) => item !== id));
        setImages((prev) => {
            const removeIndex = prev.findIndex((item) => item.id === id);
            if (removeIndex < 0) return prev;

            const removing = prev[removeIndex];
            clearHistory(id);
            releaseUrl(removing.url);
            if (removing.previewUrl !== removing.url) {
                releaseUrl(removing.previewUrl);
            }

            const next = prev.filter((item) => item.id !== id);
            setActiveId((current) => {
                if (current !== id) return current;
                if (!next.length) return null;
                const nextIndex = Math.min(removeIndex, next.length - 1);
                return next[nextIndex].id;
            });

            return next;
        });
    };

    const removeSelectedImages = () => {
        if (!selectedImageIds.length) return;
        const selectedIds = new Set(selectedImageIds);
        const removedImages = images.filter((item) => selectedIds.has(item.id));
        const remainingImages = images.filter((item) => !selectedIds.has(item.id));
        flushScheduledCropUpdate();
        removedImages.forEach((item) => {
            clearHistory(item.id);
            releaseUrl(item.url);
            if (item.previewUrl !== item.url) releaseUrl(item.previewUrl);
        });
        setImages(remainingImages);
        setSelectedImageIds([]);
        setActiveId((current) => (current && !selectedIds.has(current) ? current : remainingImages[0]?.id ?? null));
        toast.success(`已删除 ${removedImages.length} 张原图`);
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target?.isContentEditable ||
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement
            ) {
                return;
            }

            if (!images.length || event.metaKey || event.ctrlKey || event.altKey) return;
            const activeIndex = activeId ? images.findIndex((item) => item.id === activeId) : -1;
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                const nextIndex = activeIndex > 0 ? activeIndex - 1 : images.length - 1;
                setActiveId(images[nextIndex].id);
                return;
            }
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex = activeIndex >= 0 && activeIndex < images.length - 1 ? activeIndex + 1 : 0;
                setActiveId(images[nextIndex].id);
                return;
            }
            if ((event.key === "Delete" || event.key === "Backspace") && activeId && !batchProgress) {
                event.preventDefault();
                removeImage(activeId);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeId, batchProgress, images, removeImage]);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target?.isContentEditable ||
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement
            ) {
                return;
            }
            const files = Array.from(event.clipboardData?.files ?? []);
            if (!files.length) return;
            event.preventDefault();
            void handleUploadFiles(files);
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [handleUploadFiles]);

    const clearAllImages = () => {
        flushScheduledCropUpdate();
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
        setImages([]);
        setSelectedImageIds([]);
        setActiveId(null);
        clearHistory();
    };

    const centerViewportOnImagePoint = (xRatio: number, yRatio: number) => {
        const viewport = viewportRef.current;
        const stage = stageRef.current;
        if (!viewport || !stage) return;

        const targetLeft = stage.offsetLeft + stage.offsetWidth * xRatio - viewport.clientWidth / 2;
        const targetTop = stage.offsetTop + stage.offsetHeight * yRatio - viewport.clientHeight / 2;
        viewport.scrollTo({
            left: Math.max(0, targetLeft),
            top: Math.max(0, targetTop),
            behavior: "smooth",
        });
    };

    const handleMinimapPointer = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!activeImage) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const yRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
        centerViewportOnImagePoint(xRatio, yRatio);
    };

    return (
        <div
            className="relative h-screen overflow-hidden bg-muted/20 p-4"
            onDragEnter={(event) => {
                event.preventDefault();
                dragDepthRef.current += 1;
                setIsDragActive(true);
            }}
            onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                if (!dragDepthRef.current) setIsDragActive(false);
            }}
            onDrop={(event) => {
                event.preventDefault();
                dragDepthRef.current = 0;
                setIsDragActive(false);
                const files = Array.from(event.dataTransfer.files);
                if (files.length) void handleUploadFiles(files);
            }}
        >
            {isDragActive && (
                <div className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/85 shadow-xl backdrop-blur-sm">
                    <div className="rounded-lg bg-primary/10 px-6 py-4 text-center">
                        <div className="text-sm font-medium text-primary">释放图片开始添加</div>
                        <div className="mt-1 text-xs text-muted-foreground">支持一次拖入多张图片</div>
                    </div>
                </div>
            )}
            <div className="mx-auto flex h-full max-w-[1520px] min-h-0 flex-col">
                <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_260px] grid-rows-[minmax(0,1fr)] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
                    <div className="flex min-h-0">
                        <LeftPanel
                            className="w-full"
                            images={images}
                            activeId={activeId}
                            mode={mode}
                            targetWidth={targetWidth}
                            targetHeight={targetHeight}
                            ratioPreset={ratioPreset}
                            customRatioW={customRatioW}
                            customRatioH={customRatioH}
                            onModeChange={setMode}
                            onTargetWidthChange={setTargetWidth}
                            onTargetHeightChange={setTargetHeight}
                            onRatioPresetChange={setRatioPreset}
                            onCustomRatioWChange={setCustomRatioW}
                            onCustomRatioHChange={setCustomRatioH}
                            onUpload={handleUpload}
                            onResetAllCrop={resetAllCrop}
                            onClearAllImages={clearAllImages}
                            onRemoveSelectedImages={removeSelectedImages}
                            onSelectImage={setActiveId}
                            onRemoveImage={removeImage}
                            onSwapAspect={swapAspect}
                            selectedImageIds={selectedImageIds}
                            onToggleImage={toggleImageSelection}
                            onToggleAllImages={toggleAllImages}
                            onBatchCrop={batchCropSelected}
                            onApplyRuleToSelected={applyRuleToSelected}
                            batchProgress={batchProgress}
                            batchFailures={batchFailures}
                            onCancelBatch={cancelBatchCrops}
                            onRetryFailed={retryFailedCrops}
                            storageEstimate={storageEstimate}
                        />
                    </div>

                    <div className="flex h-full min-h-0 flex-col gap-3">
                        <CropEditor
                            activeImage={activeImage}
                            cropPercent={cropPercent}
                            currentDisplayUrl={currentDisplayUrl}
                            currentDisplayLabel={currentDisplayLabel}
                            displayWidth={displayWidth}
                            displayHeight={displayHeight}
                            effectiveZoom={effectiveZoom}
                            fitZoom={fitZoom}
                            customAngle={customAngle}
                            viewportRect={viewportRect}
                            viewportSize={viewportSize}
                            shouldShowMinimap={shouldShowMinimap}
                            viewportRef={viewportRef}
                            stageRef={stageRef}
                            onSaveCurrentCrop={saveCurrentCrop}
                            onExportCurrent={exportCurrent}
                            onCustomAngleChange={setCustomAngle}
                            onApplyRotation={applyRotationToActive}
                            onUndo={undo}
                            onRedo={redo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onZoomChange={setZoom}
                            onStartDrag={startDrag}
                            onMinimapPointer={handleMinimapPointer}
                        />
                    </div>

                    <div className="flex min-h-0">
                        <RightPanel
                            className="w-full"
                            savedCropCount={savedCrops.length}
                            groupedSavedCrops={groupedSavedCrops}
                            selectedSavedCropIds={selectedSavedCropIds}
                            selectedSavedCropCount={selectedSavedCrops.length}
                            isBatchDownloading={isBatchDownloading}
                            isBatchExporting={isBatchExporting}
                            isRoutingExporting={isRoutingExporting}
                            onExportBatch={() => void exportBatch(selectedSavedCrops)}
                            onDownloadBatch={() => void downloadBatch(selectedSavedCrops)}
                            onRouteWithCrops={(target) => void routeWithCrops(target, selectedSavedCrops)}
                            onClearSavedCrops={clearSavedCrops}
                            onRemoveSavedCrop={removeSavedCrop}
                            onToggleSavedCrop={toggleSavedCropSelection}
                            onToggleAllSavedCrops={toggleAllSavedCrops}
                            onRemoveSelectedSavedCrops={removeSelectedSavedCrops}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
