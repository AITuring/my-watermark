import { createTextWatermark } from "@/utils/text-watermark";
import { createBlurredWatermarkBackground, createWatermarkBlurPatch } from "@/utils/watermark-blur";
import { ImageType, MixedWatermarkConfig, WatermarkPosition } from "@/types";
import {
    createPreviewUrl,
    disposeImageSource,
    loadImageSource,
    type LoadedImage,
} from "@/utils/image-loading";
import {
    getAdaptiveWatermarkRenderMetrics,
    fitWatermarkPosition,
    getImageOpaqueBounds,
} from "@/utils/watermark-editor";
import { compositeLargeImage, getLargeImageAsset } from '@/utils/large-image';

class CanvasPool {
    private static instance: CanvasPool;
    private pool: HTMLCanvasElement[] = [];
    private readonly maxPoolSize = 10;

    static getInstance(): CanvasPool {
        if (!CanvasPool.instance) {
            CanvasPool.instance = new CanvasPool();
        }
        return CanvasPool.instance;
    }

    getCanvas(): HTMLCanvasElement {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return document.createElement("canvas");
    }

    releaseCanvas(canvas: HTMLCanvasElement): void {
        if (this.pool.length < this.maxPoolSize) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = 1;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            this.pool.push(canvas);
        }
    }
}

class MemoryManager {
    private static instance: MemoryManager;
    private readonly canvasPool = CanvasPool.getInstance();
    private readonly urlCache = new Set<string>();

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    getCanvas(): HTMLCanvasElement {
        return this.canvasPool.getCanvas();
    }

    releaseCanvas(canvas: HTMLCanvasElement): void {
        this.canvasPool.releaseCanvas(canvas);
    }

    createObjectURL(blob: Blob): string {
        const url = URL.createObjectURL(blob);
        this.urlCache.add(url);
        return url;
    }
}

type RenderableImageSource = LoadedImage | HTMLImageElement;

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function getRenderableImageDimensions(source: RenderableImageSource) {
    if ("naturalWidth" in source) {
        return {
            width: source.naturalWidth,
            height: source.naturalHeight,
        };
    }

    return {
        width: source.width,
        height: source.height,
    };
}

async function loadRenderableImageSource(src: string | File): Promise<{
    image: RenderableImageSource;
    dispose: () => void;
}> {
    if (typeof src === "string") {
        return { image: await loadImage(src), dispose: () => {} };
    }

    const image = await loadImageSource(src);
    return {
        image,
        dispose: () => disposeImageSource(image),
    };
}

function uuid(): string {
    let idStr = Date.now().toString(36);
    idStr += Math.random().toString(36).slice(2);
    return idStr;
}

interface LoadImageDataResult {
    images: ImageType[];
    failedFiles: string[];
}

const HIGH_QUALITY_FLOOR = 0.88;
const MAX_AUTO_QUALITY_DROP = 0.04;
const EXPORT_QUALITY_STEP = 0.02;
const SOFT_MAX_SIZE_RATIO = 1.2;

function clampExportQuality(quality: number): number {
    return Math.max(0.01, Math.min(1, quality));
}

function getExportMimeType(file: File): "image/jpeg" | "image/webp" {
    return file.type === "image/webp" ? "image/webp" : "image/jpeg";
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: "image/jpeg" | "image/webp",
    quality: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("图片导出失败"));
                    return;
                }
                resolve(blob);
            },
            type,
            quality
        );
    });
}

async function exportCanvasWithSizeBudget(
    canvas: HTMLCanvasElement,
    file: File,
    quality: number
): Promise<{ blob: Blob; mimeType: string }> {
    const exportType = getExportMimeType(file);
    const requestedQuality = clampExportQuality(quality);
    const minAutoQuality =
        requestedQuality >= HIGH_QUALITY_FLOOR
            ? Math.max(
                  HIGH_QUALITY_FLOOR,
                  Number(
                      (requestedQuality - MAX_AUTO_QUALITY_DROP).toFixed(2)
                  )
              )
            : requestedQuality;
    const softSizeLimit = Math.max(
        file.size,
        Math.round(file.size * SOFT_MAX_SIZE_RATIO)
    );

    let currentQuality = requestedQuality;
    let blob = await canvasToBlob(canvas, exportType, currentQuality);
    let bestBlob = blob;

    if (blob.size <= softSizeLimit) {
        return { blob, mimeType: blob.type || exportType };
    }

    while (
        blob.size > softSizeLimit &&
        currentQuality > minAutoQuality + Number.EPSILON
    ) {
        currentQuality = Math.max(
            minAutoQuality,
            Number((currentQuality - EXPORT_QUALITY_STEP).toFixed(2))
        );
        blob = await canvasToBlob(canvas, exportType, currentQuality);
        if (blob.size < bestBlob.size) {
            bestBlob = blob;
        }
        if (blob.size <= softSizeLimit) {
            return { blob, mimeType: blob.type || exportType };
        }
    }

    return { blob: bestBlob, mimeType: bestBlob.type || exportType };
}

export async function loadImageData(
    files: File[]
): Promise<LoadImageDataResult> {
    const results = await Promise.allSettled(
        files.map(async (file): Promise<ImageType> => {
            let source: LoadedImage | null = null;
            let previewUrl: string | null = null;
            try {
                const largeAsset = await getLargeImageAsset(file);
                if (largeAsset) {
                    return { id: uuid(), width: largeAsset.width, height: largeAsset.height,
                        file, previewUrl: largeAsset.previewUrl };
                }
                previewUrl = await createPreviewUrl(file);
                source = await loadImageSource(file);
                return {
                    id: uuid(),
                    width: source.width,
                    height: source.height,
                    file,
                    previewUrl,
                };
            } catch (error) {
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                }
                throw error;
            } finally {
                if (source) {
                    disposeImageSource(source);
                }
            }
        })
    );

    const loadedImages: ImageType[] = [];
    const failedFiles: string[] = [];

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            loadedImages.push(result.value);
            return;
        }

        const fileName = files[index]?.name || `第 ${index + 1} 个文件`;
        const reason =
            result.reason instanceof Error ? result.reason.message : "图片加载失败";
        console.error(`读取图片失败: ${fileName}`, result.reason);
        failedFiles.push(`${fileName}（${reason}）`);
    });

    if (loadedImages.length === 0) {
        throw new Error(`读取图片失败：${failedFiles.join("、")}`);
    }

    return { images: loadedImages, failedFiles };
}

export async function createMixedWatermark(
    config: MixedWatermarkConfig
): Promise<string> {
    return createTextWatermark(config);
}

function calculateWatermarkPosition(
    watermarkImage: HTMLImageElement,
    imageWidth: number,
    imageHeight: number,
    position: WatermarkPosition
) {
    position = fitWatermarkPosition(imageWidth,imageHeight,watermarkImage,position);
    const contentBounds = getImageOpaqueBounds(watermarkImage);
    const renderMetrics = getAdaptiveWatermarkRenderMetrics(
        imageWidth,
        imageHeight,
        watermarkImage,
        position.scaleX || 1
    );
    const watermarkWidth = renderMetrics.width;
    const watermarkHeight = renderMetrics.height;

    const relX = Math.max(0, Math.min(1, position.x ?? 0.5));
    const relY = Math.max(0, Math.min(1, position.y ?? 0.5));
    let pxX = relX * imageWidth;
    let pxY = relY * imageHeight;

    pxX = Math.max(0, Math.min(imageWidth - watermarkWidth, pxX));
    pxY = Math.max(0, Math.min(imageHeight - watermarkHeight, pxY));

    return {
        x: pxX,
        y: pxY,
        width: watermarkWidth,
        height: watermarkHeight,
        crop: {
            x: contentBounds.x,
            y: contentBounds.y,
            width: contentBounds.width,
            height: contentBounds.height,
        },
    };
}

export async function processImage(
    file: File,
    watermarkImage: HTMLImageElement,
    position: WatermarkPosition,
    watermarkBlur: boolean,
    quality: number,
    watermarkOpacity = 1,
    onProgress?: (progress: number) => void
): Promise<{ blob: Blob; name: string; mimeType: string }> {
    const largeAsset = await getLargeImageAsset(file);
    if (largeAsset) {
        onProgress?.(20);
        const placement = calculateWatermarkPosition(
            watermarkImage, largeAsset.width, largeAsset.height, position
        );
        const radians = (position.rotation * Math.PI) / 180;
        const overlayWidth = Math.max(1, Math.ceil(Math.abs(placement.width * Math.cos(radians)) +
            Math.abs(placement.height * Math.sin(radians))));
        const overlayHeight = Math.max(1, Math.ceil(Math.abs(placement.width * Math.sin(radians)) +
            Math.abs(placement.height * Math.cos(radians))));
        const canvas = document.createElement('canvas');
        canvas.width = overlayWidth;
        canvas.height = overlayHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('无法绘制大图水印');
        ctx.globalAlpha = watermarkOpacity;
        ctx.translate(overlayWidth / 2, overlayHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(watermarkImage,
            placement.crop.x,
            placement.crop.y,
            placement.crop.width,
            placement.crop.height,
            -placement.width / 2, -placement.height / 2, placement.width, placement.height);
        const overlay = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('大图水印图层生成失败')), 'image/png'
        ));
        const left = Math.max(0, Math.min(largeAsset.width - overlayWidth,
            Math.round(placement.x + (placement.width - overlayWidth) / 2)));
        const top = Math.max(0, Math.min(largeAsset.height - overlayHeight,
            Math.round(placement.y + (placement.height - overlayHeight) / 2)));
        onProgress?.(55);
        const blob = await compositeLargeImage(file, overlay, {
            x: left, y: top, quality: Math.round(Math.max(0.01, Math.min(1, quality)) * 100),
            blur: watermarkBlur,
        });
        if (!blob) throw new Error('大图水印服务不可用');
        onProgress?.(100);
        return { blob, name: file.name, mimeType: 'image/jpeg' };
    }
    const memoryManager = MemoryManager.getInstance();

    return new Promise((resolve, reject) => {
        void (async () => {
            if (!file || !watermarkImage) {
                reject(new Error("缺少必要的文件或水印图片"));
                return;
            }

            onProgress?.(10);
            const { image, dispose } = await loadRenderableImageSource(file);
            onProgress?.(30);

            let canvas: HTMLCanvasElement | null = null;
            let tempCanvas: HTMLCanvasElement | null = null;
            let exportStarted = false;

            try {
                const { width: imageWidth, height: imageHeight } =
                    getRenderableImageDimensions(image);

                canvas = memoryManager.getCanvas();
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    throw new Error("无法创建Canvas上下文");
                }

                canvas.width = imageWidth;
                canvas.height = imageHeight;
                ctx.drawImage(image as CanvasImageSource, 0, 0, imageWidth, imageHeight);

                const watermarkPosition = calculateWatermarkPosition(
                    watermarkImage,
                    imageWidth,
                    imageHeight,
                    position
                );

                const { x: watermarkX, y: watermarkY, width: watermarkWidth, height: watermarkHeight, crop: watermarkCrop } =
                    watermarkPosition;

                if (watermarkBlur) {
                    tempCanvas = createBlurredWatermarkBackground(image as CanvasImageSource, imageWidth, imageHeight);
                    const patch = createWatermarkBlurPatch(tempCanvas, {
                        x: watermarkX, y: watermarkY, width: watermarkWidth, height: watermarkHeight,
                    });
                    ctx.drawImage(patch.canvas, patch.x, patch.y, patch.width, patch.height);
                }

                ctx.globalCompositeOperation = "source-over";
                ctx.save();
                ctx.globalAlpha = watermarkOpacity;
                ctx.translate(
                    watermarkX + watermarkWidth / 2,
                    watermarkY + watermarkHeight / 2
                );
                ctx.rotate((position.rotation * Math.PI) / 180);

                ctx.drawImage(
                    watermarkImage,
                    watermarkCrop.x, watermarkCrop.y, watermarkCrop.width, watermarkCrop.height,
                    -watermarkWidth / 2, -watermarkHeight / 2, watermarkWidth, watermarkHeight
                );

                ctx.restore();
                exportStarted = true;
                void exportCanvasWithSizeBudget(canvas, file, quality)
                    .then(({ blob, mimeType }) => {
                        try {
                            onProgress?.(100);
                            resolve({ blob, name: file.name, mimeType });
                        } finally {
                            if (canvas) {
                                memoryManager.releaseCanvas(canvas);
                            }
                        }
                    })
                    .catch((error) => {
                        if (canvas) {
                            memoryManager.releaseCanvas(canvas);
                        }
                        reject(error);
                    });
            } catch (error) {
                if (canvas && !exportStarted) {
                    memoryManager.releaseCanvas(canvas);
                }
                reject(error);
            } finally {
                dispose();
                if (tempCanvas) {
                    memoryManager.releaseCanvas(tempCanvas);
                }
            }
        })().catch(reject);
    });
}
