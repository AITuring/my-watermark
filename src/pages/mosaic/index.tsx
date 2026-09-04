import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
    Download,
    Grip,
    ImagePlus,
    Layers3,
    Package,
    Plus,
    SquareDashedMousePointer,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { loadJSZip, loadSaveAs } from "@/utils/lazy-deps";

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

type ZipConstructor = new () => {
    file: (name: string, data: Blob) => void;
    generateAsync: (options: { type: "blob" }) => Promise<Blob>;
};

const DEFAULT_REGION_BLOCK_SIZE = 18;
const PREVIEW_MAX_DIMENSION = 1400;
const MIN_REGION_SIZE = 0.04;

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

const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

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

const loadImageMeta = (file: File) =>
    new Promise<Omit<MosaicImage, "id" | "regions">>((resolve, reject) => {
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

        const sourceX = clamp(region.x, 0, 1) * image.width;
        const sourceY = clamp(region.y, 0, 1) * image.height;
        const sourceWidth = clamp(region.width, MIN_REGION_SIZE, 1) * image.width;
        const sourceHeight = clamp(region.height, MIN_REGION_SIZE, 1) * image.height;

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
    const [exportingCurrent, setExportingCurrent] = useState(false);
    const [exportingBatch, setExportingBatch] = useState(false);
    const [showOnlySelectedRegion, setShowOnlySelectedRegion] = useState(false);

    const previewBoxRef = useRef<HTMLDivElement | null>(null);
    const previewImageRef = useRef<HTMLImageElement | null>(null);
    const previewUrlRef = useRef<string>("");
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
        return () => {
            for (const image of images) {
                URL.revokeObjectURL(image.objectUrl);
            }
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, [images]);

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
            : createDefaultRegion(defaultBlockSize);

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

    const handleDownloadCurrent = async () => {
        if (!activeImage) {
            toast.error("请先选择图片");
            return;
        }

        try {
            setExportingCurrent(true);
            const { blob, fileName } = await renderMosaicBlob(activeImage, exportFormat, quality);
            const saveAs = await loadSaveAs();
            saveAs(blob, fileName);
            toast.success("当前图片已开始下载");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "导出失败");
        } finally {
            setExportingCurrent(false);
        }
    };

    const handleDownloadAll = async () => {
        if (images.length === 0) {
            toast.error("请先上传图片");
            return;
        }

        try {
            setExportingBatch(true);
            const JSZip = (await loadJSZip()) as ZipConstructor;
            const zip = new JSZip();

            for (const image of images) {
                const { blob, fileName } = await renderMosaicBlob(image, exportFormat, quality);
                zip.file(fileName, blob);
            }

            const content = await zip.generateAsync({ type: "blob" });
            const saveAs = await loadSaveAs();
            saveAs(content, `mosaic-batch-${Date.now()}.zip`);
            toast.success("批量导出已开始");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "批量导出失败");
        } finally {
            setExportingBatch(false);
        }
    };

    const totalRegions = useMemo(
        () => images.reduce((sum, image) => sum + image.regions.length, 0),
        [images]
    );

    const activeImagePreviewUrl = previewUrl || activeImage?.objectUrl || "";

    const renderEmptyState = () => (
        <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-sm">
            <div className="max-w-md space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <SquareDashedMousePointer className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-900">上传图片后开始打马赛克</h2>
                    <p className="text-sm leading-6 text-slate-600">
                        支持多图导入、区域框选、整图像素化和批量导出。先上传图片，再拖动蓝色框调整马赛克范围。
                    </p>
                </div>
                <Button onClick={open} className="rounded-full px-5">
                    <ImagePlus className="mr-2 h-4 w-4" />
                    选择图片
                </Button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1600px] space-y-6">
                <Card className="border-white/65 bg-white/85 shadow-xl backdrop-blur-md">
                    <CardHeader className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-2">
                                <CardTitle className="flex items-center gap-2 text-2xl text-slate-900">
                                    <Layers3 className="h-6 w-6 text-sky-600" />
                                    图片打马赛克
                                </CardTitle>
                                <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                                    给敏感区域快速加马赛克，支持多区域拖拽、整图像素化、不同图片批量导出。
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                                <div className="rounded-full bg-slate-100 px-3 py-1.5">图片 {images.length} 张</div>
                                <div className="rounded-full bg-slate-100 px-3 py-1.5">区域 {totalRegions} 个</div>
                                <div className="rounded-full bg-slate-100 px-3 py-1.5">
                                    导出格式 {exportFormat === "original" ? "原格式" : exportFormat.toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
                    <div className="space-y-6">
                        <Card className="border-white/65 bg-white/82 shadow-lg backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-base text-slate-900">上传图片</CardTitle>
                                <CardDescription>拖拽图片到这里，或使用按钮继续添加。</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div
                                    {...getRootProps()}
                                    className={cn(
                                        "rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
                                        isDragActive
                                            ? "border-sky-400 bg-sky-50 text-sky-700"
                                            : "border-slate-300 bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <input {...getInputProps()} />
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                        <ImagePlus className="h-5 w-5" />
                                    </div>
                                    <div className="mt-3 text-sm font-medium">
                                        {isDragActive ? "松开即可导入图片" : "将图片拖到这里"}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">支持一次导入多张图片</p>
                                </div>
                                <Button onClick={open} variant="outline" className="w-full rounded-xl">
                                    <Plus className="mr-2 h-4 w-4" />
                                    添加图片
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-white/65 bg-white/82 shadow-lg backdrop-blur-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base text-slate-900">图片列表</CardTitle>
                                <CardDescription>选择一张图片后，在中间画面中调整马赛克区域。</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {images.length === 0 ? (
                                    <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                                        还没有图片
                                    </div>
                                ) : (
                                    images.map((image) => (
                                        <button
                                            key={image.id}
                                            type="button"
                                            onClick={() => {
                                                setActiveImageId(image.id);
                                                setActiveRegionId(image.regions[0]?.id ?? null);
                                            }}
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-all",
                                                image.id === activeImageId
                                                    ? "border-sky-300 bg-sky-50 shadow-sm"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            )}
                                        >
                                            <img
                                                src={image.objectUrl}
                                                alt={image.name}
                                                className="h-16 w-16 rounded-xl object-cover"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium text-slate-900">
                                                    {image.name}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {image.width} x {image.height} · {formatBytes(image.file.size)}
                                                </div>
                                                <div className="mt-1 text-xs text-sky-700">
                                                    {image.regions.length} 个区域
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="shrink-0 text-slate-500 hover:text-rose-600"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    removeImage(image.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </button>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-white/65 bg-white/80 shadow-xl backdrop-blur-md">
                        <CardHeader className="pb-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-lg text-slate-900">编辑区域</CardTitle>
                                    <CardDescription>
                                        拖动区域可移动，拖右下角手柄可缩放，支持每张图多个马赛克框。
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={() => addRegionToActive(false)}
                                        disabled={!activeImage}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        新增区域
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={() => addRegionToActive(true)}
                                        disabled={!activeImage}
                                    >
                                        <SquareDashedMousePointer className="mr-2 h-4 w-4" />
                                        整图马赛克
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!activeImage ? (
                                renderEmptyState()
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {activeImage.regions.map((region, index) => (
                                            <button
                                                key={region.id}
                                                type="button"
                                                onClick={() => setActiveRegionId(region.id)}
                                                className={cn(
                                                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                                                    region.id === activeRegionId
                                                        ? "border-sky-300 bg-sky-50 text-sky-700"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                                )}
                                            >
                                                区域 {index + 1} · {region.blockSize}px
                                            </button>
                                        ))}
                                    </div>

                                    <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(226,232,240,0.62))] p-4">
                                        <div className="flex min-h-[520px] items-center justify-center overflow-auto rounded-[24px] border border-white/70 bg-slate-950/90 px-4 py-6">
                                            <div
                                                ref={previewBoxRef}
                                                className="relative inline-block select-none"
                                                onPointerDown={() => setActiveRegionId(null)}
                                            >
                                                <img
                                                    ref={previewImageRef}
                                                    src={activeImage.objectUrl}
                                                    alt={activeImage.name}
                                                    className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl"
                                                    draggable={false}
                                                />
                                                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                                                    {activeImage.regions.map((region) => {
                                                        if (showOnlySelectedRegion && region.id !== activeRegionId) {
                                                            return null;
                                                        }
                                                        const isActive = region.id === activeRegionId;
                                                        return (
                                                            <div
                                                                key={region.id}
                                                                className={cn(
                                                                    "absolute overflow-hidden rounded-xl border-2 transition-colors touch-none",
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
                                                                                  "absolute h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-lg",
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
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="border-white/65 bg-white/82 shadow-lg backdrop-blur-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base text-slate-900">区域设置</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-700">马赛克强度</span>
                                        <span className="font-medium text-slate-900">
                                            {(activeRegion?.blockSize ?? defaultBlockSize)}px
                                        </span>
                                    </div>
                                    <Slider
                                        value={[activeRegion?.blockSize ?? defaultBlockSize]}
                                        min={0}
                                        max={80}
                                        step={1}
                                        onValueChange={(value) => {
                                            const next = value[0];
                                            if (typeof next !== "number") return;
                                            handleStrengthChange(next);
                                        }}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">仅显示当前区域</div>
                                        <div className="text-xs text-slate-500">方便精确调整多区域图片</div>
                                    </div>
                                    <Switch
                                        checked={showOnlySelectedRegion}
                                        onCheckedChange={setShowOnlySelectedRegion}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="justify-start rounded-xl"
                                        onClick={copyRegionsToAll}
                                        disabled={!activeImage || activeImage.regions.length === 0}
                                    >
                                        <Layers3 className="mr-2 h-4 w-4" />
                                        复制当前布局到全部图片
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="justify-start rounded-xl"
                                        onClick={removeActiveRegion}
                                        disabled={!activeRegion}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        删除当前区域
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="justify-start rounded-xl text-rose-600 hover:text-rose-700"
                                        onClick={clearActiveRegions}
                                        disabled={!activeImage || activeImage.regions.length === 0}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        清空当前图片区域
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-white/65 bg-white/82 shadow-lg backdrop-blur-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base text-slate-900">导出设置</CardTitle>
                                <CardDescription>编辑区已经是所见即所得，这里只保留导出相关设置。</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700" htmlFor="mosaic-export-format">
                                        导出格式
                                    </label>
                                    <select
                                        id="mosaic-export-format"
                                        value={exportFormat}
                                        onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                                        className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                                    >
                                        <option value="original">保留原格式</option>
                                        <option value="jpeg">JPEG</option>
                                        <option value="png">PNG</option>
                                        <option value="webp">WebP</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-700">导出质量</span>
                                        <span className="font-medium text-slate-900">{Math.round(quality * 100)}%</span>
                                    </div>
                                    <Slider
                                        value={[quality]}
                                        min={0.4}
                                        max={1}
                                        step={0.01}
                                        onValueChange={(value) => setQuality(value[0] ?? 0.92)}
                                    />
                                    <p className="text-xs text-slate-500">对 JPEG 和 WebP 生效，PNG 会始终无损导出。</p>
                                </div>

                                <div className="grid gap-2">
                                    <Button
                                        type="button"
                                        className="rounded-xl"
                                        onClick={() => void handleDownloadCurrent()}
                                        disabled={!activeImage || exportingCurrent || exportingBatch}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        {exportingCurrent ? "正在导出当前图片..." : "下载当前图片"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => void handleDownloadAll()}
                                        disabled={images.length === 0 || exportingCurrent || exportingBatch}
                                    >
                                        <Package className="mr-2 h-4 w-4" />
                                        {exportingBatch ? "正在打包全部图片..." : "打包下载全部图片"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
