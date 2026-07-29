import * as StackBlur from "stackblur-canvas";
import { ImageType, MixedWatermarkConfig, WatermarkPosition } from "@/types";
import {
    createPreviewUrl,
    disposeImageSource,
    loadImageSource,
    type LoadedImage,
} from "@/utils/image-loading";
import {
    getAdaptiveWatermarkRenderMetrics,
    getImageOpaqueBounds,
} from "@/utils/watermark-editor";

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
    const { icon, textLine1, textLine2, color, fontSize, gap, layout = "horizontal" } =
        config;
    const memoryManager = MemoryManager.getInstance();

    let iconImg: HTMLImageElement;
    try {
        iconImg = await loadImage(icon);
    } catch (error) {
        console.error("Failed to load icon", error);
        return "";
    }

    const canvas = memoryManager.getCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        memoryManager.releaseCanvas(canvas);
        return "";
    }

    const font = `bold ${fontSize}px "SimSun", "Songti SC", serif`;
    ctx.font = font;

    const lineHeight = fontSize * 1.2;
    const targetIconHeight = fontSize * 2.5;
    const scale = targetIconHeight / iconImg.height;
    const targetIconWidth = iconImg.width * scale;

    let totalWidth = 0;
    let totalHeight = 0;

    if (layout === "vertical") {
        const colWidth = fontSize;
        const colGap = fontSize * 0.5;
        const textBlockH =
            Math.max(textLine1.length, textLine2.length) * lineHeight;
        const textBlockW =
            (textLine1 ? colWidth : 0) +
            (textLine2 ? colWidth : 0) +
            (textLine1 && textLine2 ? colGap : 0);

        totalWidth = Math.max(targetIconWidth, textBlockW);
        totalHeight = targetIconHeight + gap + textBlockH;
    } else {
        const text1Metrics = ctx.measureText(textLine1);
        const text2Metrics = ctx.measureText(textLine2);
        const textWidth = Math.max(text1Metrics.width, text2Metrics.width);
        const textHeight = lineHeight * 2;

        totalWidth = targetIconWidth + gap + textWidth;
        totalHeight = Math.max(targetIconHeight, textHeight);
    }

    canvas.width = totalWidth;
    canvas.height = totalHeight;
    ctx.clearRect(0, 0, totalWidth, totalHeight);

    const iconCanvas = memoryManager.getCanvas();
    iconCanvas.width = targetIconWidth;
    iconCanvas.height = targetIconHeight;
    const iconCtx = iconCanvas.getContext("2d");
    if (!iconCtx) {
        memoryManager.releaseCanvas(iconCanvas);
        memoryManager.releaseCanvas(canvas);
        return "";
    }

    iconCtx.drawImage(iconImg, 0, 0, targetIconWidth, targetIconHeight);
    iconCtx.globalCompositeOperation = "source-in";
    iconCtx.fillStyle = color;
    iconCtx.fillRect(0, 0, targetIconWidth, targetIconHeight);

    const iconX = layout === "vertical" ? (totalWidth - targetIconWidth) / 2 : 0;
    const iconY =
        layout === "vertical" ? 0 : (totalHeight - targetIconHeight) / 2;

    ctx.drawImage(iconCanvas, iconX, iconY);
    memoryManager.releaseCanvas(iconCanvas);

    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";

    if (layout === "vertical") {
        ctx.textAlign = "center";
        const colWidth = fontSize;
        const colGap = fontSize * 0.5;
        const textBlockW =
            (textLine1 ? colWidth : 0) +
            (textLine2 ? colWidth : 0) +
            (textLine1 && textLine2 ? colGap : 0);

        const startX = (totalWidth - textBlockW) / 2;
        const startY = targetIconHeight + gap;

        if (textLine1) {
            const l1X = startX + colWidth / 2;
            for (let i = 0; i < textLine1.length; i++) {
                ctx.fillText(textLine1[i], l1X, startY + i * lineHeight);
            }
        }
        if (textLine2) {
            const offset = textLine1 ? colWidth + colGap : 0;
            const l2X = startX + offset + colWidth / 2;
            for (let i = 0; i < textLine2.length; i++) {
                ctx.fillText(textLine2[i], l2X, startY + i * lineHeight);
            }
        }
    } else {
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        const textX = targetIconWidth + gap;
        const midY = totalHeight / 2;
        ctx.fillText(textLine1, textX, midY - lineHeight / 2);
        ctx.fillText(textLine2, textX, midY + lineHeight / 2);
    }

    const dataUrl = canvas.toDataURL("image/png");
    memoryManager.releaseCanvas(canvas);
    return dataUrl;
}

function calculateWatermarkPosition(
    watermarkImage: HTMLImageElement,
    imageWidth: number,
    imageHeight: number,
    position: WatermarkPosition
) {
    const contentBounds = getImageOpaqueBounds(watermarkImage);
    const renderMetrics = getAdaptiveWatermarkRenderMetrics(
        imageWidth,
        imageHeight,
        watermarkImage,
        position.scaleX || 1
    );
    const watermarkWidth = renderMetrics.width;
    const watermarkHeight = renderMetrics.height;

    const relX = Math.max(0, Math.min(1, position.x || 0.5));
    const relY = Math.max(0, Math.min(1, position.y || 0.5));
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
    onProgress?: (progress: number) => void,
    mixedConfig?: MixedWatermarkConfig
): Promise<{ url: string; name: string; mimeType: string }> {
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
                    tempCanvas = memoryManager.getCanvas();
                    const tempCtx = tempCanvas.getContext("2d");
                    if (!tempCtx) {
                        throw new Error("无法创建模糊画布");
                    }
                    tempCanvas.width = imageWidth;
                    tempCanvas.height = imageHeight;
                    tempCtx.drawImage(
                        image as CanvasImageSource,
                        0,
                        0,
                        imageWidth,
                        imageHeight
                    );

                    StackBlur.canvasRGBA(
                        tempCanvas,
                        0,
                        0,
                        imageWidth,
                        imageHeight,
                        20
                    );

                    const centerX = watermarkX + watermarkWidth / 2;
                    const centerY = watermarkY + watermarkHeight / 2;
                    const outerRadius = Math.max(watermarkWidth, watermarkHeight);
                    const gradient = ctx.createRadialGradient(
                        centerX,
                        centerY,
                        0,
                        centerX,
                        centerY,
                        outerRadius
                    );
                    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
                    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

                    ctx.globalCompositeOperation = "destination-out";
                    ctx.fillStyle = gradient;
                    ctx.fillRect(
                        watermarkX,
                        watermarkY,
                        watermarkWidth,
                        watermarkHeight
                    );

                    ctx.globalCompositeOperation = "destination-over";
                    ctx.drawImage(tempCanvas, 0, 0);
                }

                ctx.globalCompositeOperation = "source-over";
                ctx.save();
                ctx.globalAlpha = watermarkOpacity;
                ctx.translate(
                    watermarkX + watermarkWidth / 2,
                    watermarkY + watermarkHeight / 2
                );
                ctx.rotate((position.rotation * Math.PI) / 180);

                if (mixedConfig && mixedConfig.enabled) {
                    const {
                        textLine1,
                        textLine2,
                        color,
                        gap,
                        layout = "horizontal",
                    } = mixedConfig;

                    const iconImg = new Image();
                    iconImg.crossOrigin = "anonymous";
                    await new Promise<void>((resolveLoad, rejectLoad) => {
                        iconImg.onload = () => resolveLoad();
                        iconImg.onerror = () =>
                            rejectLoad(new Error("混合水印图标加载失败"));
                        iconImg.src = mixedConfig.icon;
                    });

                    const rectW = watermarkWidth;
                    const rectH = watermarkHeight;
                    const designFS = 100;
                    const designGap = (gap / mixedConfig.fontSize) * designFS;
                    const designLineHeight = designFS * 1.2;
                    const designIconH = designFS * 2.5;
                    const scaleIcon = designIconH / iconImg.height;
                    const designIconW = iconImg.width * scaleIcon;

                    let designTotalW = 0;
                    let designTotalH = 0;
                    const colWidth = designFS;
                    const colGap = designFS * 0.5;
                    let textBlockW = 0;
                    let textBlockH = 0;
                    let horzTextW = 0;
                    let horzTextH = 0;

                    if (layout === "vertical") {
                        textBlockH =
                            Math.max(textLine1.length, textLine2.length) *
                            designLineHeight;
                        textBlockW =
                            (textLine1 ? colWidth : 0) +
                            (textLine2 ? colWidth : 0) +
                            (textLine1 && textLine2 ? colGap : 0);
                        designTotalW = Math.max(designIconW, textBlockW);
                        designTotalH = designIconH + designGap + textBlockH;
                    } else {
                        const measureCanvas = memoryManager.getCanvas();
                        const measureCtx = measureCanvas.getContext("2d");
                        if (!measureCtx) {
                            memoryManager.releaseCanvas(measureCanvas);
                            throw new Error("无法创建文字测量画布");
                        }
                        measureCtx.font = `bold ${designFS}px "SimSun", "Songti SC", serif`;
                        const m1 = measureCtx.measureText(textLine1);
                        const m2 = measureCtx.measureText(textLine2);
                        horzTextW = Math.max(m1.width, m2.width);
                        horzTextH = designLineHeight * 2;
                        designTotalW = designIconW + designGap + horzTextW;
                        designTotalH = Math.max(designIconH, horzTextH);
                        memoryManager.releaseCanvas(measureCanvas);
                    }

                    const scaleFactor = Math.min(rectW / designTotalW, rectH / designTotalH);
                    const realFS = designFS * scaleFactor;
                    const realIconW = designIconW * scaleFactor;
                    const realIconH = designIconH * scaleFactor;
                    const realGap = designGap * scaleFactor;
                    const realLineHeight = designLineHeight * scaleFactor;
                    const contentW = designTotalW * scaleFactor;
                    const contentH = designTotalH * scaleFactor;
                    const startX = -contentW / 2;
                    const startY = -contentH / 2;

                    const iconX =
                        layout === "vertical"
                            ? startX + (contentW - realIconW) / 2
                            : startX;
                    const iconY =
                        layout === "vertical"
                            ? startY
                            : startY + (contentH - realIconH) / 2;

                    const iCanvas = memoryManager.getCanvas();
                    iCanvas.width = realIconW;
                    iCanvas.height = realIconH;
                    const iCtx = iCanvas.getContext("2d");
                    if (!iCtx) {
                        memoryManager.releaseCanvas(iCanvas);
                        throw new Error("无法创建图标画布");
                    }
                    iCtx.drawImage(iconImg, 0, 0, realIconW, realIconH);
                    iCtx.globalCompositeOperation = "source-in";
                    iCtx.fillStyle = color;
                    iCtx.fillRect(0, 0, realIconW, realIconH);
                    ctx.drawImage(iCanvas, iconX, iconY);
                    memoryManager.releaseCanvas(iCanvas);

                    ctx.font = `bold ${realFS}px "SimSun", "Songti SC", serif`;
                    ctx.fillStyle = color;

                    if (layout === "vertical") {
                        ctx.textBaseline = "top";
                        ctx.textAlign = "center";

                        const realColWidth = colWidth * scaleFactor;
                        const realColGap = colGap * scaleFactor;
                        const realTextBlockW = textBlockW * scaleFactor;
                        const textBlockX = startX + (contentW - realTextBlockW) / 2;
                        const textBlockY = iconY + realIconH + realGap;

                        if (textLine1) {
                            const l1X = textBlockX + realColWidth / 2;
                            for (let i = 0; i < textLine1.length; i++) {
                                ctx.fillText(textLine1[i], l1X, textBlockY + i * realLineHeight);
                            }
                        }
                        if (textLine2) {
                            const l2X =
                                textBlockX +
                                (textLine1 ? realColWidth + realColGap : 0) +
                                realColWidth / 2;
                            for (let i = 0; i < textLine2.length; i++) {
                                ctx.fillText(textLine2[i], l2X, textBlockY + i * realLineHeight);
                            }
                        }
                    } else {
                        ctx.textBaseline = "middle";
                        ctx.textAlign = "left";
                        const textX = iconX + realIconW + realGap;
                        const textCenterY = startY + contentH / 2;
                        ctx.fillText(textLine1, textX, textCenterY - realLineHeight / 2);
                        ctx.fillText(textLine2, textX, textCenterY + realLineHeight / 2);
                    }
                } else {
                    ctx.drawImage(
                        watermarkImage,
                        watermarkCrop.x,
                        watermarkCrop.y,
                        watermarkCrop.width,
                        watermarkCrop.height,
                        -watermarkWidth / 2,
                        -watermarkHeight / 2,
                        watermarkWidth,
                        watermarkHeight
                    );
                }

                ctx.restore();
                exportStarted = true;
                void exportCanvasWithSizeBudget(canvas, file, quality)
                    .then(({ blob, mimeType }) => {
                        try {
                            const url = memoryManager.createObjectURL(blob);
                            onProgress?.(100);
                            resolve({ url, name: file.name, mimeType });
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
