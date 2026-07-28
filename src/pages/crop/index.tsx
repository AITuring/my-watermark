import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router-dom";
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Crop,
    Download,
    ImagePlus,
    Images,
    Maximize,
    Minimize,
    PackageOpen,
    RotateCcw,
    ScanSearch,
    Scissors,
    Send,
    Trash2,
} from "lucide-react";
import {
    consumePendingCropTransfer,
    setPendingCropTransfer,
    type TransferTarget,
} from "@/utils/crop-transfer";

type CropMode = "fixed" | "ratio" | "free";
type DragMode = "new" | "move" | "nw" | "ne" | "sw" | "se";

type CropBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};

type CropImage = {
    id: string;
    name: string;
    url: string;
    previewUrl: string;
    previewWidth: number;
    previewHeight: number;
    width: number;
    height: number;
    crop: CropBox;
};

type SavedCrop = {
    id: string;
    sourceImageId: string;
    sourceName: string;
    index: number;
    previewUrl: string;
    outputW: number;
    outputH: number;
    file: File;
};

type DragState = {
    active: boolean;
    mode: DragMode;
    startPoint: { x: number; y: number };
    startCrop: CropBox | null;
};

type EditorPreview = {
    url: string;
    width: number;
    height: number;
};

const ratioOptions = [
    { label: "1:1", value: 1 },
    { label: "15:8", value: 15 / 8 },
    { label: "4:3", value: 4 / 3 },
    { label: "3:4", value: 3 / 4 },
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "16:10", value: 16 / 10 },
    { label: "10:16", value: 10 / 16 },
    { label: "2:1", value: 2 },
    { label: "1:2", value: 0.5 },
    { label: "自定义", value: 1 },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const normalizeBox = (box: CropBox): CropBox => {
    const x = Math.min(box.x, box.x + box.w);
    const y = Math.min(box.y, box.y + box.h);
    return { x, y, w: Math.abs(box.w), h: Math.abs(box.h) };
};

const fitBoxInImage = (box: CropBox, imgW: number, imgH: number): CropBox => {
    const n = normalizeBox(box);
    const w = clamp(n.w, 1, imgW);
    const h = clamp(n.h, 1, imgH);
    const x = clamp(n.x, 0, imgW - w);
    const y = clamp(n.y, 0, imgH - h);
    return { x, y, w, h };
};

const buildUniqueNames = (existingNames: string[], incomingNames: string[]) => {
    const counts = new Map<string, number>();
    existingNames.forEach((name) => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
    });

    return incomingNames.map((name) => {
        const nextCount = (counts.get(name) ?? 0) + 1;
        counts.set(name, nextCount);
        return nextCount === 1 ? name : `${name}-${nextCount}`;
    });
};

const sanitizeFileSegment = (value: string) => value.replace(/[\\/:*?"<>|]/g, "-").trim() || "image";
const MAX_EDITOR_PREVIEW_SIZE = 2200;

const createCenteredCrop = (imgW: number, imgH: number, ratio: number): CropBox => {
    const imageRatio = imgW / Math.max(imgH, 1);
    let w = imgW;
    let h = imgH;

    if (imageRatio > ratio) {
        h = imgH;
        w = h * ratio;
    } else {
        w = imgW;
        h = w / ratio;
    }

    const x = (imgW - w) / 2;
    const y = (imgH - h) / 2;
    return { x, y, w, h };
};

const createCenteredFreeCrop = (imgW: number, imgH: number): CropBox => {
    return { x: 0, y: 0, w: imgW, h: imgH };
};

const getDefaultCrop = (imgW: number, imgH: number, mode: CropMode, ratio: number | null) =>
    mode === "free" ? createCenteredFreeCrop(imgW, imgH) : createCenteredCrop(imgW, imgH, ratio ?? 1);

const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("load-image-failed"));
        img.src = src;
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
        }
    });

const createEditorPreviewAsset = async (
    source: CanvasImageSource,
    width: number,
    height: number,
    fallbackUrl: string
) : Promise<EditorPreview> => {
    const longestSide = Math.max(width, height);
    if (longestSide <= MAX_EDITOR_PREVIEW_SIZE) {
        return {
            url: fallbackUrl,
            width,
            height,
        };
    }

    const scale = MAX_EDITOR_PREVIEW_SIZE / longestSide;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return {
            url: fallbackUrl,
            width,
            height,
        };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.88)
    );

    return blob
        ? {
              url: URL.createObjectURL(blob),
              width: canvas.width,
              height: canvas.height,
          }
        : {
              url: fallbackUrl,
              width,
              height,
          };
};

const buildAspectBox = (
    anchor: { x: number; y: number },
    point: { x: number; y: number },
    ratio: number,
    imgW: number,
    imgH: number
): CropBox => {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    let aw = Math.max(Math.abs(dx), 1);
    let ah = Math.max(Math.abs(dy), 1);
    if (aw / Math.max(ah, 1e-6) > ratio) {
        ah = aw / ratio;
    } else {
        aw = ah * ratio;
    }
    const maxW = sx > 0 ? imgW - anchor.x : anchor.x;
    const maxH = sy > 0 ? imgH - anchor.y : anchor.y;
    const scale = Math.min(1, maxW / aw, maxH / ah);
    aw *= scale;
    ah *= scale;
    const x = sx > 0 ? anchor.x : anchor.x - aw;
    const y = sy > 0 ? anchor.y : anchor.y - ah;
    return normalizeBox({ x, y, w: aw, h: ah });
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
    const [isRoutingExporting, setIsRoutingExporting] = useState(false);
    const [savedCrops, setSavedCrops] = useState<SavedCrop[]>([]);
    const [zoom, setZoom] = useState(1);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState>({
        active: false,
        mode: "new",
        startPoint: { x: 0, y: 0 },
        startCrop: null,
    });
    const objectUrlsRef = useRef<string[]>([]);
    const savedPreviewUrlsRef = useRef<string[]>([]);
    const savedCropSequenceRef = useRef<Record<string, number>>({});
    const animationFrameRef = useRef<number | null>(null);
    const pendingCropRef = useRef<CropBox | null>(null);
    const [viewportRect, setViewportRect] = useState({ left: 0, top: 0, width: 1, height: 1 });
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

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
        const found = ratioOptions.find((r) => r.label === ratioPreset);
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
    const shouldShowMinimap = useMemo(() => {
        if (!activeImage) return false;
        const isZoomedIn = effectiveZoom > fitZoom * 1.25;
        const viewportIsClipped = viewportRect.width < 0.92 || viewportRect.height < 0.92;
        return isZoomedIn && viewportIsClipped;
    }, [activeImage, effectiveZoom, fitZoom, viewportRect.height, viewportRect.width]);

    const groupedSavedCrops = useMemo(() => {
        const groups: Array<{ sourceImageId: string; sourceName: string; items: SavedCrop[] }> = [];
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

    const cropPercent = useMemo(() => {
        if (!activeImage) return null;
        const { crop, width, height } = activeImage;
        return {
            left: (crop.x / width) * 100,
            top: (crop.y / height) * 100,
            width: (crop.w / width) * 100,
            height: (crop.h / height) * 100,
        };
    }, [activeImage]);

    const updateViewportRect = () => {
        const viewport = viewportRef.current;
        const stage = stageRef.current;
        if (!viewport || !stage || !activeImage) {
            setViewportRect({ left: 0, top: 0, width: 1, height: 1 });
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
            savedPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!activeImage) return;
        const nextZoom = Math.max(fitZoom, 0.1);
        setZoom(nextZoom);
    }, [activeImage?.id, fitZoom]);

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

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const updateViewportSize = () => {
            setViewportSize({
                width: viewport.clientWidth,
                height: viewport.clientHeight,
            });
        };

        updateViewportSize();
        const observer = new ResizeObserver(() => updateViewportSize());
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
                            const preview = await createEditorPreviewAsset(
                                img,
                                img.width,
                                img.height,
                                url
                            );
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
        setActiveId((prev) => prev ?? nextImages[0].id);
        toast.success(`已加载 ${valid.length} 张图片`);
    };

    useEffect(() => {
        const incomingFiles = consumePendingCropTransfer("crop");
        if (!incomingFiles.length) return;
        void loadFiles(incomingFiles);
    }, []);

    const releaseUrl = (url: string) => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url);
    };

    const releaseSavedPreviewUrl = (url: string) => {
        URL.revokeObjectURL(url);
        savedPreviewUrlsRef.current = savedPreviewUrlsRef.current.filter((item) => item !== url);
    };

    const transformImage = async (image: CropImage, angleDeg: number) => {
        const img = await loadImageElement(image.url);

        const angleRad = (angleDeg * Math.PI) / 180;
        const sin = Math.abs(Math.sin(angleRad));
        const cos = Math.abs(Math.cos(angleRad));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(image.width * cos + image.height * sin));
        canvas.height = Math.max(1, Math.ceil(image.width * sin + image.height * cos));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("canvas-context-unavailable");
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(angleRad);
        ctx.drawImage(img, -image.width / 2, -image.height / 2);

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.95)
        );
        if (!blob) {
            throw new Error("transform-export-failed");
        }

        const nextUrl = URL.createObjectURL(blob);
        const preview = await createEditorPreviewAsset(canvas, canvas.width, canvas.height, nextUrl);

        return {
            url: nextUrl,
            previewUrl: preview.url,
            previewWidth: preview.width,
            previewHeight: preview.height,
            width: canvas.width,
            height: canvas.height,
        };
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
            const nextImage = await transformImage(activeImage, angleDeg);
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

    const updateActiveCrop = (updater: (prev: CropBox, image: CropImage) => CropBox) => {
        if (!activeId) return;
        setImages((prev) =>
            prev.map((item) => {
                if (item.id !== activeId) return item;
                const next = updater(item.crop, item);
                return { ...item, crop: fitBoxInImage(next, item.width, item.height) };
            })
        );
    };

    const resetCurrentCrop = () => {
        if (!activeImage) return;
        updateActiveCrop((_, image) =>
            isFreeMode
                ? createCenteredFreeCrop(image.width, image.height)
                : createCenteredCrop(image.width, image.height, selectedRatio ?? 1)
        );
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

    const getImagePoint = (clientX: number, clientY: number) => {
        const stageEl = stageRef.current;
        if (!stageEl || !activeImage) return null;
        const rect = stageEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const x = ((clientX - rect.left) / rect.width) * activeImage.width;
        const y = ((clientY - rect.top) / rect.height) * activeImage.height;
        return {
            x: clamp(x, 0, activeImage.width),
            y: clamp(y, 0, activeImage.height),
        };
    };

    const flushScheduledCropUpdate = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (!pendingCropRef.current) return;
        const nextCrop = pendingCropRef.current;
        pendingCropRef.current = null;
        updateActiveCrop(() => nextCrop);
    };

    const scheduleCropUpdate = (nextCrop: CropBox) => {
        pendingCropRef.current = nextCrop;
        if (animationFrameRef.current !== null) return;
        animationFrameRef.current = requestAnimationFrame(() => {
            animationFrameRef.current = null;
            if (!pendingCropRef.current) return;
            const next = pendingCropRef.current;
            pendingCropRef.current = null;
            updateActiveCrop(() => next);
        });
    };

    const startDrag = (dragMode: DragMode, e: React.PointerEvent) => {
        if (!activeImage) return;
        const pt = getImagePoint(e.clientX, e.clientY);
        if (!pt) return;
        dragRef.current = {
            active: true,
            mode: dragMode,
            startPoint: pt,
            startCrop: activeImage.crop,
        };
    };

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const d = dragRef.current;
            if (!d.active || !activeImage) return;
            const pt = getImagePoint(e.clientX, e.clientY);
            if (!pt) return;
            if (d.mode === "move" && d.startCrop) {
                const dx = pt.x - d.startPoint.x;
                const dy = pt.y - d.startPoint.y;
                const nextX = clamp(d.startCrop.x + dx, 0, activeImage.width - d.startCrop.w);
                const nextY = clamp(d.startCrop.y + dy, 0, activeImage.height - d.startCrop.h);
                scheduleCropUpdate({ ...d.startCrop, x: nextX, y: nextY });
                return;
            }
            let anchor = d.startPoint;
            if (d.mode !== "new" && d.startCrop) {
                const { x, y, w, h } = d.startCrop;
                if (d.mode === "nw") anchor = { x: x + w, y: y + h };
                if (d.mode === "ne") anchor = { x, y: y + h };
                if (d.mode === "sw") anchor = { x: x + w, y };
                if (d.mode === "se") anchor = { x, y };
            }
            const next = isFreeMode
                ? fitBoxInImage(
                      normalizeBox({
                          x: anchor.x,
                          y: anchor.y,
                          w: pt.x - anchor.x,
                          h: pt.y - anchor.y,
                      }),
                      activeImage.width,
                      activeImage.height
                  )
                : buildAspectBox(anchor, pt, selectedRatio ?? 1, activeImage.width, activeImage.height);
            if (next.w < 2 || next.h < 2) return;
            scheduleCropUpdate(next);
        };

        const onUp = () => {
            flushScheduledCropUpdate();
            dragRef.current.active = false;
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [activeImage, isFreeMode, selectedRatio]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        await loadFiles(files);
        e.target.value = "";
    };

    const removeImage = (id: string) => {
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
        setActiveId(null);
    };

    const drawCropToBlob = async (
        image: CropImage,
        crop: CropBox,
        outputW: number,
        outputH: number
    ) => {
        const img = await loadImageElement(image.url);
        const canvas = document.createElement("canvas");
        canvas.width = outputW;
        canvas.height = outputH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
            img,
            crop.x,
            crop.y,
            crop.w,
            crop.h,
            0,
            0,
            outputW,
            outputH
        );
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.95)
        );
        return blob;
    };

    const getOutputSize = (crop: CropBox) => ({
        outputW: mode === "fixed" ? Math.max(1, Math.round(targetWidth)) : Math.max(1, Math.round(crop.w)),
        outputH: mode === "fixed" ? Math.max(1, Math.round(targetHeight)) : Math.max(1, Math.round(crop.h)),
    });

    const buildSavedCropFileName = (sourceName: string, index: number, outputW: number, outputH: number) =>
        `${sanitizeFileSegment(sourceName)}-crop-${String(index).padStart(2, "0")}-${outputW}x${outputH}.jpg`;

    const exportCurrent = async () => {
        if (!activeImage) {
            toast.error("请先上传图片");
            return;
        }
        const crop = activeImage.crop;
        const { outputW, outputH } = getOutputSize(crop);
        const blob = await drawCropToBlob(activeImage, crop, outputW, outputH);
        if (!blob) {
            toast.error("导出失败");
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeImage.name}-crop-${outputW}x${outputH}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`已导出 ${outputW} × ${outputH}`);
    };

    const saveCurrentCrop = async () => {
        if (!activeImage) {
            toast.error("请先选择图片");
            return;
        }
        const crop = activeImage.crop;
        const { outputW, outputH } = getOutputSize(crop);
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
    };

    const exportBatch = async () => {
        if (!savedCrops.length) {
            toast.error("请先暂存裁切结果");
            return;
        }
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
    };

    const buildCroppedFiles = async () => {
        return savedCrops.map((item) => item.file);
    };

    const routeWithCrops = async (target: TransferTarget) => {
        if (!savedCrops.length) {
            toast.error("请先暂存裁切结果");
            return;
        }
        try {
            setIsRoutingExporting(true);
            const files = await buildCroppedFiles();
            if (!files.length) {
                toast.error("裁切结果生成失败");
                return;
            }
            setPendingCropTransfer(target, files);
            navigate(target === "watermark" ? "/watermark" : "/puzzle");
            toast.success(`已发送 ${files.length} 张裁切图到${target === "watermark" ? "水印" : "拼图"}`);
        } catch (err) {
            console.error(err);
            toast.error("发送失败，请重试");
        } finally {
            setIsRoutingExporting(false);
        }
    };

    const removeSavedCrop = (id: string) => {
        setSavedCrops((prev) => {
            const target = prev.find((item) => item.id === id);
            if (!target) return prev;
            releaseSavedPreviewUrl(target.previewUrl);
            return prev.filter((item) => item.id !== id);
        });
    };

    const clearSavedCrops = () => {
        savedPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        savedPreviewUrlsRef.current = [];
        savedCropSequenceRef.current = {};
        setSavedCrops([]);
    };

    const setCropX = (x: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => ({
            ...prev,
            x: clamp(x, 0, image.width - prev.w),
        }));
    };

    const setCropY = (y: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => ({
            ...prev,
            y: clamp(y, 0, image.height - prev.h),
        }));
    };

    const setCropW = (nextWRaw: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => {
            if (isFreeMode) {
                const w = clamp(nextWRaw, 1, image.width);
                const x = clamp(prev.x, 0, image.width - w);
                return { ...prev, x, w };
            }
            let w = clamp(nextWRaw, 1, image.width);
            let h = w / (selectedRatio ?? 1);
            if (h > image.height) {
                h = image.height;
                w = h * (selectedRatio ?? 1);
            }
            const x = clamp(prev.x, 0, image.width - w);
            const y = clamp(prev.y, 0, image.height - h);
            return { x, y, w, h };
        });
    };

    const setCropH = (nextHRaw: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => {
            if (isFreeMode) {
                const h = clamp(nextHRaw, 1, image.height);
                const y = clamp(prev.y, 0, image.height - h);
                return { ...prev, y, h };
            }
            let h = clamp(nextHRaw, 1, image.height);
            let w = h * (selectedRatio ?? 1);
            if (w > image.width) {
                w = image.width;
                h = w / (selectedRatio ?? 1);
            }
            const x = clamp(prev.x, 0, image.width - w);
            const y = clamp(prev.y, 0, image.height - h);
            return { x, y, w, h };
        });
    };

    const nudge = (dx: number, dy: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => ({
            ...prev,
            x: clamp(prev.x + dx, 0, image.width - prev.w),
            y: clamp(prev.y + dy, 0, image.height - prev.h),
        }));
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

    const handleMinimapPointer = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!activeImage) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const xRatio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const yRatio = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        centerViewportOnImagePoint(xRatio, yRatio);
    };

    const renderLeftPanel = (className = "") => (
        <Card className={`flex h-full min-h-0 flex-col border-border/60 bg-background/90 shadow-sm ${className}`}>
            <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Scissors className="h-4 w-4" />
                        图片裁切
                    </CardTitle>
                    <Badge variant="secondary">{images.length} 张</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button asChild className="w-full">
                            <label className="flex cursor-pointer items-center justify-center gap-2 text-center">
                                <ImagePlus className="h-4 w-4" />
                                上传原图
                                <input
                                    className="hidden"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleUpload}
                                />
                            </label>
                        </Button>
                        <Button variant="secondary" onClick={resetAllCrop} disabled={!images.length}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            重置全部
                        </Button>
                    </div>
                    <Button variant="ghost" className="w-full justify-center" onClick={clearAllImages} disabled={!images.length}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        清空原图列表
                    </Button>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Crop className="h-4 w-4" />
                        导出规则
                    </div>
                    <div className="space-y-2">
                        <Select value={mode} onValueChange={(v) => setMode(v as CropMode)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fixed">固定像素导出</SelectItem>
                                <SelectItem value="ratio">按比例选区导出</SelectItem>
                                <SelectItem value="free">自由裁切导出</SelectItem>
                            </SelectContent>
                        </Select>
                        {mode === "fixed" ? (
                            <div className="grid grid-cols-2 gap-2">
                                <Input type="number" value={targetWidth} min={1} onChange={(e) => setTargetWidth(Number(e.target.value || 1))} />
                                <Input type="number" value={targetHeight} min={1} onChange={(e) => setTargetHeight(Number(e.target.value || 1))} />
                            </div>
                        ) : mode === "ratio" ? (
                            <div className="space-y-2">
                                <Select value={ratioPreset} onValueChange={setRatioPreset}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ratioOptions.map((item) => (
                                            <SelectItem key={item.label} value={item.label}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {ratioPreset === "自定义" && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            type="number"
                                            value={customRatioW}
                                            min={1}
                                            onChange={(e) => setCustomRatioW(Number(e.target.value || 1))}
                                        />
                                        <Input
                                            type="number"
                                            value={customRatioH}
                                            min={1}
                                            onChange={(e) => setCustomRatioH(Number(e.target.value || 1))}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
                                自由裁切会按当前选区的原始像素导出。
                            </div>
                        )}
                    </div>
                </div>

                {/* {activeImage && (
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{activeImage.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {activeImage.width} × {activeImage.height}
                                </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={resetCurrentCrop}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                重置当前
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div className="rounded-xl bg-background px-3 py-2">
                                X / Y: {Math.round(activeImage.crop.x)} / {Math.round(activeImage.crop.y)}
                            </div>
                            <div className="rounded-xl bg-background px-3 py-2">
                                W / H: {Math.round(activeImage.crop.w)} / {Math.round(activeImage.crop.h)}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="number"
                                value={Math.round(activeImage.crop.x)}
                                onChange={(e) => setCropX(Number(e.target.value || 0))}
                            />
                            <Input
                                type="number"
                                value={Math.round(activeImage.crop.y)}
                                onChange={(e) => setCropY(Number(e.target.value || 0))}
                            />
                            <Input
                                type="number"
                                value={Math.round(activeImage.crop.w)}
                                onChange={(e) => setCropW(Number(e.target.value || 1))}
                            />
                            <Input
                                type="number"
                                value={Math.round(activeImage.crop.h)}
                                onChange={(e) => setCropH(Number(e.target.value || 1))}
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <Button variant="secondary" size="sm" onClick={() => nudge(0, -1)}>
                                <ArrowUp className="h-4 w-4" />
                                上
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => nudge(0, 1)}>
                                <ArrowDown className="h-4 w-4" />
                                下
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => nudge(-1, 0)}>
                                <ArrowLeft className="h-4 w-4" />
                                左
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => nudge(1, 0)}>
                                <ArrowRight className="h-4 w-4" />
                                右
                            </Button>
                        </div>
                    </div>
                )} */}

                <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Images className="h-4 w-4" />
                            原图列表
                        </div>
                        <div className="text-xs text-muted-foreground">选择一张进入编辑</div>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                        {images.length ? (
                            images.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveId(item.id)}
                                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                                        activeId === item.id
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-border/60 bg-background hover:bg-muted/30"
                                    }`}
                                >
                                    <img
                                        src={item.previewUrl}
                                        alt={item.name}
                                        className="h-14 w-14 rounded-xl object-cover bg-black/5"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm">{item.name}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {item.width} × {item.height}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-muted-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeImage(item.id);
                                        }}
                                    >
                                        删除
                                    </Button>
                                </button>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                                先上传一批原图，再从这里选择要裁切的图片。
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const renderRightPanel = (className = "") => (
        <Card className={`flex h-full min-h-0 flex-col border-border/60 bg-background/90 shadow-sm ${className}`}>
            <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <PackageOpen className="h-4 w-4" />
                        暂存结果
                    </CardTitle>
                    <Badge variant="secondary">{savedCrops.length} 张</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="grid gap-2">
                    <Button onClick={exportBatch} disabled={!savedCrops.length}>
                        <Download className="mr-2 h-4 w-4" />
                        导出 ZIP
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => routeWithCrops("watermark")}
                        disabled={!savedCrops.length || isRoutingExporting}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        发送到水印
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => routeWithCrops("puzzle")}
                        disabled={!savedCrops.length || isRoutingExporting}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        发送到拼图
                    </Button>
                    <Button variant="ghost" onClick={clearSavedCrops} disabled={!savedCrops.length}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        清空暂存
                    </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
                    {groupedSavedCrops.length ? (
                        groupedSavedCrops.map((group) => (
                            <div key={group.sourceImageId} className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{group.sourceName}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            已暂存 {group.items.length} 张
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {group.items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2">
                                            <img
                                                src={item.previewUrl}
                                                alt={item.file.name}
                                                className="h-14 w-14 rounded-lg object-cover bg-black/5"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs">第 {item.index} 张</div>
                                                <div className="truncate text-[11px] text-muted-foreground">
                                                    {item.outputW} × {item.outputH}
                                                </div>
                                                <div className="truncate text-[11px] text-muted-foreground">
                                                    {item.file.name}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-2 text-muted-foreground"
                                                onClick={() => removeSavedCrop(item.id)}
                                            >
                                                删除
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-2xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                            暂存区还是空的。先在中间裁一张，再点“暂存当前裁切”。
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="h-screen overflow-hidden bg-muted/20 p-4">
            <div className="mx-auto flex h-full max-w-[1520px] min-h-0 flex-col">
                <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_260px] grid-rows-[minmax(0,1fr)] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
                    <div className="flex min-h-0">
                        {renderLeftPanel("w-full")}
                    </div>

                    <div className="flex h-full min-h-0 flex-col gap-3">
                        <Card className="flex min-h-0 flex-1 flex-col border-border/60 bg-background/95 shadow-sm">
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
                                    <Button size="sm" className="px-2.5 sm:px-3" onClick={saveCurrentCrop} disabled={!activeImage}>
                                        <Scissors className="h-4 w-4" />
                                        <span className="hidden sm:inline">暂存当前裁切</span>
                                    </Button>
                                    <Button variant="secondary" size="sm" className="px-2.5 sm:px-3" onClick={exportCurrent} disabled={!activeImage}>
                                        <Download className="h-4 w-4" />
                                        <span className="hidden sm:inline">单独导出</span>
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                            {!activeImage ? (
                                <div className="flex h-full min-h-0 items-center justify-center rounded-[28px] border border-dashed bg-muted/20 text-sm text-muted-foreground">
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
                                        <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button variant="secondary" size="sm" onClick={() => applyRotationToActive(90)} disabled={!activeImage}>
                                                    <RotateCcw className="h-4 w-4" />
                                                    <span className="hidden sm:inline">顺时针 90°</span>
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => applyRotationToActive(-90)} disabled={!activeImage}>
                                                    <RotateCcw className="h-4 w-4" />
                                                    <span className="hidden sm:inline">逆时针 90°</span>
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={customAngle}
                                                    step="0.1"
                                                    className="h-8 w-20 bg-background"
                                                    onChange={(e) => setCustomAngle(Number(e.target.value || 0))}
                                                    placeholder="角度"
                                                />
                                                <Button variant="secondary" size="sm" onClick={() => applyRotationToActive(customAngle)} disabled={!activeImage}>
                                                    <RotateCcw className="h-4 w-4" />
                                                    <span className="hidden sm:inline">应用角度</span>
                                                </Button>
                                                <div className="mx-1 hidden h-5 w-px bg-border lg:block" />
                                                <Button variant="secondary" size="sm" onClick={() => setZoom(fitZoom)}>
                                                    <Maximize className="h-4 w-4" />
                                                    <span className="hidden sm:inline">适应窗口</span>
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => setZoom(1)}>
                                                    <ScanSearch className="h-4 w-4" />
                                                    <span className="hidden sm:inline">100%</span>
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => setZoom((prev) => clamp(prev * 1.5, fitZoom * 0.5, 4))}>
                                                    <Maximize className="h-4 w-4" />
                                                    <span className="hidden sm:inline">放大</span>
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => setZoom((prev) => clamp(prev / 1.5, fitZoom * 0.5, 4))}>
                                                    <Minimize className="h-4 w-4" />
                                                    <span className="hidden sm:inline">缩小</span>
                                                </Button>
                                                <div className="ml-auto hidden text-[11px] text-muted-foreground lg:block">
                                                    放大到 100% 或更高时会自动切到高清图源
                                                </div>
                                            </div>
                                        </div>
                                        <div className="relative min-h-0 flex-1">
                                            <div
                                                ref={viewportRef}
                                                className="h-full overflow-auto rounded border bg-black/5"
                                            >
                                                <div
                                                    className="flex min-h-full min-w-full"
                                                    style={{
                                                        justifyContent: displayWidth < viewportSize.width ? "center" : "flex-start",
                                                        alignItems: displayHeight < viewportSize.height ? "center" : "flex-start",
                                                    }}
                                                >
                                                    <div
                                                        className="relative inline-block select-none"
                                                        ref={stageRef}
                                                        onPointerDown={(e) => startDrag("new", e)}
                                                        style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
                                                    >
                                                        <img
                                                            src={currentDisplayUrl}
                                                            alt={activeImage.name}
                                                            className="block rounded-xl"
                                                            style={{ width: `${displayWidth}px`, height: `${displayHeight}px`, maxWidth: "none" }}
                                                            draggable={false}
                                                        />
                                                        {cropPercent && (
                                                            <>
                                                                <div className="absolute inset-0 pointer-events-none">
                                                                    <div className="absolute left-0 top-0 h-full bg-black/35" style={{ width: `${cropPercent.left}%` }} />
                                                                    <div className="absolute right-0 top-0 h-full bg-black/35" style={{ width: `${Math.max(0, 100 - cropPercent.left - cropPercent.width)}%` }} />
                                                                    <div className="absolute" style={{ left: `${cropPercent.left}%`, top: 0, width: `${cropPercent.width}%`, height: `${cropPercent.top}%`, backgroundColor: "rgba(0,0,0,0.35)" }} />
                                                                    <div className="absolute" style={{ left: `${cropPercent.left}%`, top: `${cropPercent.top + cropPercent.height}%`, width: `${cropPercent.width}%`, height: `${Math.max(0, 100 - cropPercent.top - cropPercent.height)}%`, backgroundColor: "rgba(0,0,0,0.35)" }} />
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
                                                                        startDrag("move", e);
                                                                    }}
                                                                >
                                                                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/60" />
                                                                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/60" />
                                                                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/60" />
                                                                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/60" />
                                                                    {(["nw", "ne", "sw", "se"] as DragMode[]).map((h) => {
                                                                        const map: Record<string, string> = {
                                                                            nw: "left-0 top-0 cursor-nwse-resize",
                                                                            ne: "right-0 top-0 cursor-nesw-resize",
                                                                            sw: "left-0 bottom-0 cursor-nesw-resize",
                                                                            se: "right-0 bottom-0 cursor-nwse-resize",
                                                                        };
                                                                        return (
                                                                            <div
                                                                                key={h}
                                                                                className={`absolute h-3 w-3 rounded-full border border-white bg-black/80 ${map[h]}`}
                                                                                onPointerDown={(e) => {
                                                                                    e.stopPropagation();
                                                                                    startDrag(h, e);
                                                                                }}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {shouldShowMinimap && (
                                                <div className="pointer-events-none absolute bottom-4 right-4 z-10">
                                                    <div className="pointer-events-auto w-[168px] rounded-2xl border border-border/70 bg-background/92 p-3 shadow-lg backdrop-blur-sm">
                                                        <div className="mb-2 text-sm font-medium">Minimap</div>
                                                        <div
                                                            className="relative overflow-hidden rounded-xl border bg-background"
                                                            style={{ aspectRatio: `${activeImage.width} / ${activeImage.height}` }}
                                                            onPointerDown={handleMinimapPointer}
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
                    </div>

                    <div className="flex min-h-0">
                        {renderRightPanel("w-full")}
                    </div>
                </div>
            </div>
        </div>
    );
}
