import { useImageExport } from "@/hooks/useImageExport";
import { ImageWorkbenchHeader, ImageWorkbenchPanels } from "@/components/image-workbench/ImageWorkbench";
import ImageAssetPicker from "@/components/ImageAssetPicker";
import SliderNumberField from "@/components/SliderNumberField";
import { SettingsSection } from "@/components/SettingsSection";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
    Grip,
    Layers3,
    Plus,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getLargeImageAsset, processLargeImage } from '@/utils/large-image';
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import WatermarkExportMenu from "@/components/image-workbench/ImageExportMenu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import "./mosaic.css";
import ImageViewport from "@/components/image-workbench/ImageViewport";
import EmptyMosaicPanel from "./EmptyMosaicPanel";

type ExportFormat = "original" | "jpeg" | "png" | "webp";

type MosaicRegion = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    blockSize: number;
    enabled: boolean;
};

type MosaicImage = {
    id: string;
    file: File;
    name: string;
    objectUrl: string;
    width: number;
    height: number;
    regions: MosaicRegion[];
};

type DragSession = {
    imageId: string;
    regionId: string;
    mode: ResizeHandleDirection;
    startClientX: number;
    startClientY: number;
    startRegion: MosaicRegion;
};

type ResizeHandleDirection =
    | "move"
    | "n"
    | "s"
    | "e"
    | "w"
    | "ne"
    | "nw"
    | "se"
    | "sw";

const DEFAULT_REGION_BLOCK_SIZE = 18;
const PREVIEW_MAX_DIMENSION = 1400;
const MIN_REGION_SIZE = 0.001;

const resizeHandles: Array<{
    direction: Exclude<ResizeHandleDirection, "move">;
    className: string;
}> = [
    { direction: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
    { direction: "n", className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
    { direction: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
    { direction: "e", className: "right-[-8px] top-1/2 -translate-y-1/2 cursor-ew-resize" },
    { direction: "se", className: "-right-2 -bottom-2 cursor-nwse-resize" },
    { direction: "s", className: "bottom-[-8px] left-1/2 -translate-x-1/2 cursor-ns-resize" },
    { direction: "sw", className: "-left-2 -bottom-2 cursor-nesw-resize" },
    { direction: "w", className: "left-[-8px] top-1/2 -translate-y-1/2 cursor-ew-resize" },
];

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const getBaseName = (fileName: string) => fileName.replace(/\.[^/.]+$/, "") || "image";

const createRegionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createDefaultRegion = (blockSize: number): MosaicRegion => ({
    id: createRegionId(),
    x: 0.2,
    y: 0.22,
    width: 0.38,
    height: 0.28,
    blockSize,
    enabled: true,
});

const createFullRegion = (blockSize: number): MosaicRegion => ({
    id: createRegionId(),
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    blockSize,
    enabled: true,
});

const imageElementCache = new Map<string, Promise<HTMLImageElement>>();

const loadImageElement = (src: string) => {
    let pending = imageElementCache.get(src);
    if (!pending) {
        pending = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("图片加载失败"));
            img.src = src;
        });
        imageElementCache.set(src, pending);
    }
    return pending;
};

const loadImageMeta = async (file: File): Promise<Omit<MosaicImage, 'id' | 'regions'>> => {
    const largeAsset = await getLargeImageAsset(file);
    if (largeAsset) return { file, name: file.name, objectUrl: largeAsset.previewUrl,
        width: largeAsset.width, height: largeAsset.height };
    return new Promise<Omit<MosaicImage, "id" | "regions">>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({
                file,
                name: file.name,
                objectUrl,
                width: img.naturalWidth,
                height: img.naturalHeight,
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`无法读取图片: ${file.name}`));
        };
        img.src = objectUrl;
    });
};

const getOutputInfo = (file: File, format: ExportFormat) => {
    if (format === "jpeg") {
        return { mime: "image/jpeg", extension: "jpg", qualitySensitive: true };
    }
    if (format === "png") {
        return { mime: "image/png", extension: "png", qualitySensitive: false };
    }
    if (format === "webp") {
        return { mime: "image/webp", extension: "webp", qualitySensitive: true };
    }

    if (file.type === "image/png") {
        return { mime: "image/png", extension: "png", qualitySensitive: false };
    }
    if (file.type === "image/webp") {
        return { mime: "image/webp", extension: "webp", qualitySensitive: true };
    }

    return { mime: "image/jpeg", extension: "jpg", qualitySensitive: true };
};

const renderMosaicBlob = async (
    image: MosaicImage,
    format: ExportFormat,
    quality: number,
    maxDimension?: number
) => {
    const largeAsset = await getLargeImageAsset(image.file);
    if (largeAsset && maxDimension === undefined) {
        const output = getOutputInfo(image.file, format);
        const mosaic = image.regions.filter((region) => region.enabled && region.blockSize > 0)
            .map((region) => ({
                x: Math.round(clamp(region.x, 0, 1) * image.width),
                y: Math.round(clamp(region.y, 0, 1) * image.height),
                width: Math.max(1, Math.min(image.width - Math.round(clamp(region.x, 0, 1) * image.width),
                    Math.round(clamp(region.width, MIN_REGION_SIZE, 1) * image.width))),
                height: Math.max(1, Math.min(image.height - Math.round(clamp(region.y, 0, 1) * image.height),
                    Math.round(clamp(region.height, MIN_REGION_SIZE, 1) * image.height))),
                blockSize: Math.round(region.blockSize),
            }));
        const blob = await processLargeImage(image.file, { mosaic,
            format: output.mime === 'image/png' ? 'png' : output.mime === 'image/webp' ? 'webp' : 'jpeg',
            quality: Math.round(quality * 100) });
        if (!blob) throw new Error('本地大图处理服务不可用');
        return { blob, fileName: `${getBaseName(image.name)}-mosaic.${output.extension}` };
    }
    const source = await loadImageElement(image.objectUrl);
    const scale =
        typeof maxDimension === "number"
            ? Math.min(1, maxDimension / Math.max(image.width, image.height))
            : 1;
    const canvasWidth = Math.max(1, Math.round(image.width * scale));
    const canvasHeight = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("浏览器不支持画布导出");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, 0, 0, canvasWidth, canvasHeight);

    for (const region of image.regions) {
        if (!region.enabled || region.blockSize <= 0) continue;

        const sourceX = clamp(region.x, 0, 1) * source.naturalWidth;
        const sourceY = clamp(region.y, 0, 1) * source.naturalHeight;
        const sourceWidth = clamp(region.width, MIN_REGION_SIZE, 1) * source.naturalWidth;
        const sourceHeight = clamp(region.height, MIN_REGION_SIZE, 1) * source.naturalHeight;

        const destX = Math.round(clamp(region.x, 0, 1) * canvasWidth);
        const destY = Math.round(clamp(region.y, 0, 1) * canvasHeight);
        const destWidth = Math.max(1, Math.round(clamp(region.width, MIN_REGION_SIZE, 1) * canvasWidth));
        const destHeight = Math.max(1, Math.round(clamp(region.height, MIN_REGION_SIZE, 1) * canvasHeight));

        const scaledBlock = Math.max(
            1,
            Math.round(region.blockSize * ((canvasWidth + canvasHeight) / (image.width + image.height)))
        );
        const sampleWidth = Math.max(1, Math.round(destWidth / scaledBlock));
        const sampleHeight = Math.max(1, Math.round(destHeight / scaledBlock));
        const pixelCanvas = document.createElement("canvas");
        pixelCanvas.width = sampleWidth;
        pixelCanvas.height = sampleHeight;
        const pixelCtx = pixelCanvas.getContext("2d");
        if (!pixelCtx) continue;

        pixelCtx.imageSmoothingEnabled = false;
        pixelCtx.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sampleWidth, sampleHeight);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pixelCanvas, 0, 0, sampleWidth, sampleHeight, destX, destY, destWidth, destHeight);
    }

    const output = getOutputInfo(image.file, format);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (result) {
                    resolve(result);
                    return;
                }
                reject(new Error("图片导出失败"));
            },
            output.mime,
            output.qualitySensitive ? quality : undefined
        );
    });

    return {
        blob,
        fileName: `${getBaseName(image.name)}-mosaic.${output.extension}`,
    };
};

export default function MosaicPage() {
    const [images, setImages] = useState<MosaicImage[]>([]);
    const [activeImageId, setActiveImageId] = useState<string | null>(null);
    const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
    const [defaultBlockSize, setDefaultBlockSize] = useState(DEFAULT_REGION_BLOCK_SIZE);
    const [exportFormat, setExportFormat] = useState<ExportFormat>("original");
    const [quality, setQuality] = useState(0.92);
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [showOnlySelectedRegion, setShowOnlySelectedRegion] = useState(false);

    const [previewView, setPreviewView] = useState({ zoom: 1, center: { x: .5, y: .5 } });
    const previewBoxRef = useRef<HTMLDivElement | null>(null);
    const previewImageRef = useRef<HTMLImageElement | null>(null);
    const previewUrlRef = useRef<string>("");
    const imagesRef = useRef(images);
    const dragSessionRef = useRef<DragSession | null>(null);

    const activeImage = useMemo(
        () => images.find((item) => item.id === activeImageId) ?? null,
        [images, activeImageId]
    );

    const activeRegion = useMemo(
        () => activeImage?.regions.find((region) => region.id === activeRegionId) ?? null,
        [activeImage, activeRegionId]
    );

    const syncActiveRegion = useCallback((updater: (region: MosaicRegion) => MosaicRegion) => {
        setImages((prev) =>
            prev.map((image) => {
                if (image.id !== activeImageId) return image;
                return {
                    ...image,
                    regions: image.regions.map((region) =>
                        region.id === activeRegionId ? updater(region) : region
                    ),
                };
            })
        );
    }, [activeImageId, activeRegionId]);

    const ensureRegionSelection = useCallback((nextImages: MosaicImage[]) => {
        const nextActive = nextImages.find((item) => item.id === activeImageId) ?? nextImages[0] ?? null;
        if (!nextActive) {
            setActiveImageId(null);
            setActiveRegionId(null);
            return;
        }

        if (nextActive.id !== activeImageId) {
            setActiveImageId(nextActive.id);
        }

        const regionStillExists = nextActive.regions.some((region) => region.id === activeRegionId);
        if (!regionStillExists) {
            setActiveRegionId(nextActive.regions[0]?.id ?? null);
        }
    }, [activeImageId, activeRegionId]);

    useEffect(() => {
        ensureRegionSelection(images);
    }, [images, ensureRegionSelection]);

    useEffect(() => {
        imagesRef.current = images;
    }, [images]);

    useEffect(() => {
        return () => {
            for (const image of imagesRef.current) {
                URL.revokeObjectURL(image.objectUrl);
            }
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    const handleUpload = useCallback(async (incomingFiles: File[]) => {
        const imageFiles = incomingFiles.filter((file) => file.type.startsWith("image/"));
        if (!imageFiles.length) {
            toast.error("请上传图片文件");
            return;
        }

        try {
            const loaded = await Promise.all(imageFiles.map((file) => loadImageMeta(file)));
            const prepared: MosaicImage[] = loaded.map((item) => ({
                id: createRegionId(),
                ...item,
                regions: [createDefaultRegion(defaultBlockSize)],
            }));

            setImages((prev) => [...prev, ...prepared]);
            setActiveImageId((prev) => prev ?? prepared[0]?.id ?? null);
            setActiveRegionId((prev) => prev ?? prepared[0]?.regions[0]?.id ?? null);
            toast.success(`已导入 ${prepared.length} 张图片`);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "图片导入失败");
        }
    }, [defaultBlockSize]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: (acceptedFiles) => void handleUpload(acceptedFiles),
        accept: { "image/*": [] },
        noClick: true,
        multiple: true,
    });

    useEffect(() => {
        if (!activeImage) {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = "";
            }
            setPreviewUrl("");
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const result = await renderMosaicBlob(activeImage, exportFormat, quality, PREVIEW_MAX_DIMENSION);
                if (cancelled) return;
                const nextUrl = URL.createObjectURL(result.blob);
                if (previewUrlRef.current) {
                    URL.revokeObjectURL(previewUrlRef.current);
                }
                previewUrlRef.current = nextUrl;
                setPreviewUrl(nextUrl);
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    toast.error("生成预览失败");
                }
            }
        }, 120);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [activeImage, exportFormat, quality]);

    const addRegionToActive = (fullImage: boolean) => {
        if (!activeImage) {
            toast.error("请先上传图片");
            return;
        }

        const nextRegion = fullImage
            ? createFullRegion(defaultBlockSize)
            : { ...createDefaultRegion(defaultBlockSize),
                x: clamp(previewView.center.x - .19 / previewView.zoom, 0, 1 - .38 / previewView.zoom),
                y: clamp(previewView.center.y - .14 / previewView.zoom, 0, 1 - .28 / previewView.zoom),
                width: .38 / previewView.zoom, height: .28 / previewView.zoom,
            };

        setImages((prev) =>
            prev.map((image) =>
                image.id === activeImage.id
                    ? { ...image, regions: [...image.regions, nextRegion] }
                    : image
            )
        );
        setActiveRegionId(nextRegion.id);
    };

    const handleStrengthChange = (value: number) => {
        setDefaultBlockSize(value);
        if (!activeRegion) return;
        syncActiveRegion((region) => ({ ...region, blockSize: value }));
    };

    const removeActiveRegion = () => {
        if (!activeImage || !activeRegion) return;

        setImages((prev) =>
            prev.map((image) => {
                if (image.id !== activeImage.id) return image;
                return {
                    ...image,
                    regions: image.regions.filter((region) => region.id !== activeRegion.id),
                };
            })
        );
    };

    const clearActiveRegions = () => {
        if (!activeImage) return;
        setImages((prev) =>
            prev.map((image) =>
                image.id === activeImage.id
                    ? { ...image, regions: [] }
                    : image
            )
        );
    };

    const copyRegionsToAll = () => {
        if (!activeImage || activeImage.regions.length === 0) {
            toast.error("当前图片没有可复制的马赛克区域");
            return;
        }

        const template = activeImage.regions.map((region) => ({
            ...region,
            id: createRegionId(),
        }));

        setImages((prev) =>
            prev.map((image) =>
                image.id === activeImage.id
                    ? image
                    : {
                          ...image,
                          regions: template.map((region) => ({
                              ...region,
                              id: createRegionId(),
                          })),
                      }
            )
        );
        toast.success("已复制到其他图片");
    };

    const removeImage = (imageId: string) => {
        setImages((prev) => {
            const next = prev.filter((image) => image.id !== imageId);
            const removed = prev.find((image) => image.id === imageId);
            if (removed) {
                URL.revokeObjectURL(removed.objectUrl);
            }
            return next;
        });
    };

    const handlePointerMove = useCallback((event: PointerEvent) => {
        const session = dragSessionRef.current;
        const bounds =
            previewImageRef.current?.getBoundingClientRect() ??
            previewBoxRef.current?.getBoundingClientRect();
        if (!session || !bounds || bounds.width <= 0 || bounds.height <= 0) return;

        const deltaX = (event.clientX - session.startClientX) / bounds.width;
        const deltaY = (event.clientY - session.startClientY) / bounds.height;

        setImages((prev) =>
            prev.map((image) => {
                if (image.id !== session.imageId) return image;
                return {
                    ...image,
                    regions: image.regions.map((region) => {
                        if (region.id !== session.regionId) return region;

                        let nextX = session.startRegion.x;
                        let nextY = session.startRegion.y;
                        let nextWidth = session.startRegion.width;
                        let nextHeight = session.startRegion.height;

                        if (session.mode === "move") {
                            nextX = clamp(
                                session.startRegion.x + deltaX,
                                0,
                                1 - session.startRegion.width
                            );
                            nextY = clamp(
                                session.startRegion.y + deltaY,
                                0,
                                1 - session.startRegion.height
                            );
                        } else {
                            const affectsWest = session.mode.includes("w");
                            const affectsEast = session.mode.includes("e");
                            const affectsNorth = session.mode.includes("n");
                            const affectsSouth = session.mode.includes("s");

                            if (affectsWest) {
                                const maxLeft = session.startRegion.x + session.startRegion.width - MIN_REGION_SIZE;
                                nextX = clamp(session.startRegion.x + deltaX, 0, maxLeft);
                                nextWidth = session.startRegion.width + (session.startRegion.x - nextX);
                            }

                            if (affectsEast) {
                                nextWidth = clamp(
                                    session.startRegion.width + deltaX,
                                    MIN_REGION_SIZE,
                                    1 - session.startRegion.x
                                );
                            }

                            if (affectsNorth) {
                                const maxTop =
                                    session.startRegion.y + session.startRegion.height - MIN_REGION_SIZE;
                                nextY = clamp(session.startRegion.y + deltaY, 0, maxTop);
                                nextHeight = session.startRegion.height + (session.startRegion.y - nextY);
                            }

                            if (affectsSouth) {
                                nextHeight = clamp(
                                    session.startRegion.height + deltaY,
                                    MIN_REGION_SIZE,
                                    1 - session.startRegion.y
                                );
                            }
                        }

                        return {
                            ...region,
                            x: nextX,
                            y: nextY,
                            width: nextWidth,
                            height: nextHeight,
                        };
                    }),
                };
            })
        );
    }, []);

    const handlePointerUp = useCallback(() => {
        dragSessionRef.current = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
    }, [handlePointerMove]);

    const startDrag = (
        event: React.PointerEvent<HTMLDivElement>,
        region: MosaicRegion,
        mode: ResizeHandleDirection
    ) => {
        if (!activeImage) return;
        event.preventDefault();
        event.stopPropagation();
        dragSessionRef.current = {
            imageId: activeImage.id,
            regionId: region.id,
            mode,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startRegion: region,
        };
        setActiveRegionId(region.id);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    const imageExport = useImageExport({ items: images, current: activeImage,
        archiveName: "mosaic-images.zip",
        render: async (image: MosaicImage) => {
            const { blob, fileName } = await renderMosaicBlob(image, exportFormat, quality);
            return { data: blob, name: fileName };
        },
    });
    const exportWithFeedback = async (mode: "current" | "files" | "zip") => {
        try { await imageExport.run(mode); }
        catch (error) { toast.error(error instanceof Error ? error.message : "导出失败"); }
    };
    const activeImagePreviewUrl = previewUrl || activeImage?.objectUrl || "";
    const [mobilePanel, setMobilePanel] = useState<"images" | "editor" | "settings">("editor");

    return (
        <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-6 lg:px-8">
            <div className={cn("mx-auto space-y-4", activeImage ? "max-w-[1680px]" : "max-w-[1040px]")}>
                <ImageWorkbenchHeader title="图片马赛克" icon={<Layers3 className="h-5 w-5 text-muted-foreground" />}
                    description={activeImage ? "遮住想隐藏的部分，其余保留原样。" : undefined}
                    actions={activeImage && <Button variant="outline" onClick={open}><Plus className="h-4 w-4" />添加图片</Button>} />
                <div {...getRootProps()} className={cn("rounded-2xl", !activeImage && "flex min-h-[calc(100dvh-100px)] items-center", isDragActive && "ring-2 ring-sky-500/50")}>
                    <input {...getInputProps()} />
                    {!activeImage ? <section className="w-full overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-[0_8px_40px_-24px_rgba(0,0,0,0.15)]"><EmptyMosaicPanel isDragActive={isDragActive} onSelect={open} /></section> : <>
                        <ImageWorkbenchPanels imageCount={images.length} activePanel={mobilePanel} onPanelChange={setMobilePanel}
                            className="lg:h-[calc(100dvh-120px)] lg:min-h-[520px]"
                            images={<aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card" aria-label="图片列表">
                                <ImageAssetPicker layout="rows" title="图片" images={images.map(image => ({ ...image, previewUrl: image.objectUrl }))} selectedId={activeImageId}
                                    className="bg-transparent" onUpload={handleUpload} onDelete={removeImage}
                                    onClear={() => { images.forEach(image => URL.revokeObjectURL(image.objectUrl)); setImages([]); }}
                                    onSelect={image => { setActiveImageId(image.id); setActiveRegionId(images.find(item => item.id === image.id)?.regions[0]?.id ?? null); setMobilePanel("editor"); }}
                                    renderDetails={image => `${images.find(item => item.id === image.id)?.regions.length ?? 0} 个区域`} />
                            </aside>}
                            editor={
                            <section aria-label="图片编辑" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{activeImage.name}</span>
                                    <Button variant="outline" size="sm" onClick={() => addRegionToActive(false)}><Plus className="mr-1 h-4 w-4" />添加区域</Button>
                                </div>
                                <ImageViewport key={activeImage.id} src={activeImage.objectUrl} width={activeImage.width} height={activeImage.height} onViewChange={setPreviewView}>
                                            <div
                                                ref={previewBoxRef}
                                                className="relative h-full w-full select-none"
                                                onPointerDown={() => setActiveRegionId(null)}
                                            >
                                                <img
                                                    ref={previewImageRef}
                                                    src={activeImage.objectUrl}
                                                    alt={activeImage.name}
                                                    className="block h-full w-full"
                                                    draggable={false}
                                                />
                                                <div className="absolute inset-0">
                                                    {activeImage.regions.map((region) => {
                                                        if (showOnlySelectedRegion && region.id !== activeRegionId) {
                                                            return null;
                                                        }
                                                        const isActive = region.id === activeRegionId;
                                                        return (
                                                            <div
                                                                key={region.id}
                                                                data-image-interaction="true"
                                                                className={cn(
                                                                    "absolute border-2 transition-colors touch-none",
                                                                    isActive
                                                                        ? "border-sky-400 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
                                                                        : "border-white/90"
                                                                )}
                                                                style={{
                                                                    left: `${region.x * 100}%`,
                                                                    top: `${region.y * 100}%`,
                                                                    width: `${region.width * 100}%`,
                                                                    height: `${region.height * 100}%`,
                                                                }}
                                                            >
                                                                <div className="absolute inset-0 overflow-hidden">
                                                                    <img
                                                                        src={activeImagePreviewUrl}
                                                                        alt=""
                                                                        className="absolute max-w-none select-none"
                                                                        style={{
                                                                            left: `${(-region.x / Math.max(region.width, MIN_REGION_SIZE)) * 100}%`,
                                                                            top: `${(-region.y / Math.max(region.height, MIN_REGION_SIZE)) * 100}%`,
                                                                            width: `${100 / Math.max(region.width, MIN_REGION_SIZE)}%`,
                                                                            height: `${100 / Math.max(region.height, MIN_REGION_SIZE)}%`,
                                                                        }}
                                                                        draggable={false}
                                                                    />
                                                                </div>
                                                                <div
                                                                    className="absolute inset-0 flex cursor-move items-center justify-center text-white/75"
                                                                    onPointerDown={(event) => startDrag(event, region, "move")}
                                                                >
                                                                    {isActive ? <Grip className="h-4 w-4" /> : null}
                                                                </div>
                                                                {isActive
                                                                    ? resizeHandles.map((handle) => (
                                                                          <div
                                                                              key={handle.direction}
                                                                              className={cn(
                                                                                  "absolute h-4 w-4 rounded-full border-2 border-white bg-white shadow-lg",
                                                                                  handle.className
                                                                              )}
                                                                              onPointerDown={(event) =>
                                                                                  startDrag(event, region, handle.direction)
                                                                              }
                                                                          />
                                                                      ))
                                                                    : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                </ImageViewport>


                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>{activeImage.width} × {activeImage.height}</span><span>拖动框移动 · 拖动边角缩放</span></div>
                            </section>}
                            settings={<aside id="mosaic-panel-settings" aria-label="区域与导出设置" className="mosaic-controls min-h-0 flex-1 space-y-6 overflow-y-auto rounded-xl border border-border bg-card p-4">
                            <SettingsSection title="区域调整" bodyClassName="space-y-5">
                                <SliderNumberField label="马赛克强度" value={activeRegion?.blockSize ?? defaultBlockSize} min={0} max={80} step={1} onChange={handleStrengthChange} valueFormatter={value => `${value}px`} sliderClassName="mosaic-slider" />
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => addRegionToActive(false)}><Plus className="mr-1 h-4 w-4" />添加区域</Button>
                                    <Button variant="outline" size="sm" onClick={() => addRegionToActive(true)}>整图马赛克</Button>
                                    <Button variant="outline" size="sm" onClick={clearActiveRegions} disabled={!activeImage.regions.length}>清空区域</Button>
                                    <Button variant="outline" size="sm" onClick={removeActiveRegion} disabled={!activeRegion}><Trash2 className="mr-1 h-4 w-4" />删除选中</Button>
                                </div>
                                <label className="flex items-center justify-between gap-3 text-sm"><span>仅显示选中区域</span><Switch checked={showOnlySelectedRegion} onCheckedChange={setShowOnlySelectedRegion} /></label>
                                {activeImage.regions.length > 1 && <div className="flex flex-wrap gap-2" aria-label="区域列表">
                                    {activeImage.regions.map((region, index) => <button key={region.id} type="button" aria-pressed={region.id === activeRegionId} onClick={() => setActiveRegionId(region.id)} className={cn("rounded-md border px-3 py-1.5 text-xs", region.id === activeRegionId ? "border-sky-500 bg-sky-500/10 text-foreground" : "border-border text-muted-foreground")}>区域 {index + 1}</button>)}
                                </div>}
                                {images.length > 1 && <Button variant="outline" size="sm" disabled={!activeImage.regions.length} onClick={copyRegionsToAll}>将当前区域应用到全部图片</Button>}
                            </SettingsSection>
                            <SettingsSection title="导出" bodyClassName="space-y-5">
                                <div className="flex items-center justify-between gap-3 text-sm"><label htmlFor="mosaic-export-format">导出格式</label>
                                    <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                                        <SelectTrigger id="mosaic-export-format" className="w-36 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="original">保留原格式</SelectItem><SelectItem value="jpeg">JPEG</SelectItem><SelectItem value="png">PNG</SelectItem><SelectItem value="webp">WebP</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <SliderNumberField label="导出质量（JPEG / WebP）" value={quality} min={.4} max={1} step={.01} onChange={setQuality} valueFormatter={value => `${Math.round(value * 100)}%`} sliderClassName="mosaic-slider" />
                                <WatermarkExportMenu
                                    className="mosaic-export"
                                    onExportCurrent={() => void exportWithFeedback("current")}
                                    onExportAll={() => void exportWithFeedback("files")}
                                    onExportZip={() => void exportWithFeedback("zip")}
                                    loading={imageExport.loading}
                                    progress={imageExport.progress}
                                    imageCount={images.length}
                                    currentDisabled={!activeImage}
                                />
                            </SettingsSection>
                            </aside>}
                        />
                    </>}
                </div>
            </div>
        </main>
    );
}
