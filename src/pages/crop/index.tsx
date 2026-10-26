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
    getDefaultCrop,
} from "./helpers";
import { createEditorPreviewAsset, transformImageAsset } from "./image-utils";
import { useCropExports } from "./hooks/useCropExports";
import { useCropInteractions } from "./hooks/useCropInteractions";
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
    const [storageEstimate, setStorageEstimate] = useState<FileStorageEstimate>(EMPTY_STORAGE_ESTIMATE);

    const stageRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const objectUrlsRef = useRef<string[]>([]);
    const restoreStartedRef = useRef(false);
    const persistedImagesKeyRef = useRef<string | null>(null);

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

    const loadFiles = async (files: File[]) => {
        if (!files.length) return;

        const loaded = await Promise.all(
            files.map(
                (file) =>
                    new Promise<CropImage | null>((resolve) => {
                        const url = URL.createObjectURL(file);
                        const img = new Image();
                        img.src = url;
                        img.onload = async () => {
                            objectUrlsRef.current.push(url);
                            const preview = await createEditorPreviewAsset(img, img.width, img.height, url);
                            if (preview.url !== url) {
                                objectUrlsRef.current.push(preview.url);
                            }
                            const crop =
                                mode === "free"
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
                    })
            )
        );

        const valid = loaded.filter((item): item is CropImage => Boolean(item));
        if (!valid.length) {
            toast.error("图片读取失败");
            return;
        }

        const uniqueNames = buildUniqueNames(
            images.map((item) => item.name),
            valid.map((item) => item.name)
        );
        const nextImages = valid.map((item, index) => ({
            ...item,
            name: uniqueNames[index],
        }));

        setImages((prev) => [...prev, ...nextImages]);
        setSelectedImageIds((prev) => [...prev, ...nextImages.map((item) => item.id)]);
        setActiveId((prev) => prev ?? nextImages[0].id);
        toast.success(`已加载 ${valid.length} 张图片`);
    };

    useEffect(() => {
        if (restoreStartedRef.current) return;
        restoreStartedRef.current = true;

        const restoreImages = async () => {
            const incomingFiles = await consumePendingCropTransfer("crop");
            const files = incomingFiles.length
                ? incomingFiles
                : await loadFileSession("crop-images");

            if (files.length) {
                await loadFiles(files);
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

            setImages((prev) =>
                prev.map((item) => {
                    if (item.id !== activeImage.id) return item;
                    return {
                        ...item,
                        url: nextImage.url,
                        previewUrl: nextImage.previewUrl,
                        previewWidth: nextImage.previewWidth,
                        previewHeight: nextImage.previewHeight,
                        width: nextImage.width,
                        height: nextImage.height,
                        crop: getDefaultCrop(nextImage.width, nextImage.height, mode, selectedRatio),
                    };
                })
            );

            releaseUrl(activeImage.url);
            if (activeImage.previewUrl !== activeImage.url) {
                releaseUrl(activeImage.previewUrl);
            }
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

    const toggleImageSelection = (id: string) => {
        setSelectedImageIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const toggleAllImages = () => {
        setSelectedImageIds((prev) =>
            prev.length === images.length ? [] : images.map((item) => item.id)
        );
    };

    const batchCropSelected = () => {
        void saveBatchCrops(images.filter((item) => selectedImageIds.includes(item.id)));
    };

    const resetAllCrop = () => {
        setImages((prev) =>
            prev.map((item) => ({
                ...item,
                crop: isFreeMode
                    ? createCenteredFreeCrop(item.width, item.height)
                    : createCenteredCrop(item.width, item.height, selectedRatio ?? 1),
            }))
        );
    };

    useEffect(() => {
        if (selectedRatio === null) return;
        if (!images.length) return;
        setImages((prev) =>
            prev.map((item) => ({
                ...item,
                crop: createCenteredCrop(item.width, item.height, selectedRatio),
            }))
        );
    }, [selectedRatio, images.length]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (!files.length) return;
        const projectedBytes = storageEstimate.fileBytes + files.reduce((total, file) => total + file.size, 0);
        const quotaWarning =
            storageEstimate.quotaBytes !== null && projectedBytes / storageEstimate.quotaBytes >= 0.8;
        if (projectedBytes >= CROP_SESSION_WARNING_BYTES || quotaWarning) {
            toast.warning("当前批次会占用较多本地空间，建议处理完成后及时导出并清理暂存。", {
                duration: 6000,
            });
        }
        await loadFiles(files);
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

    const clearAllImages = () => {
        flushScheduledCropUpdate();
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
        setImages([]);
        setSelectedImageIds([]);
        setActiveId(null);
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
        <div className="h-screen overflow-hidden bg-muted/20 p-4">
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
                            onSelectImage={setActiveId}
                            onRemoveImage={removeImage}
                            onSwapAspect={swapAspect}
                            selectedImageIds={selectedImageIds}
                            onToggleImage={toggleImageSelection}
                            onToggleAllImages={toggleAllImages}
                            onBatchCrop={batchCropSelected}
                            batchProgress={batchProgress}
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
                            isBatchDownloading={isBatchDownloading}
                            isBatchExporting={isBatchExporting}
                            isRoutingExporting={isRoutingExporting}
                            onExportBatch={exportBatch}
                            onDownloadBatch={downloadBatch}
                            onRouteWithCrops={routeWithCrops}
                            onClearSavedCrops={clearSavedCrops}
                            onRemoveSavedCrop={removeSavedCrop}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
