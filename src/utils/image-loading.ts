// `utif` ships without first-party TypeScript declarations in this package.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Runtime dependency is present; declarations are not bundled.
import * as UTIF from "utif";

export type LoadedImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

interface PreviewOptions {
    maxDimension?: number;
}

const TIFF_MIME_TYPES = new Set([
    "image/tiff",
    "image/tif",
    "application/tiff",
    "application/x-tiff",
]);

function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
}

function downscaleCanvas(
    canvas: HTMLCanvasElement,
    maxDimension: number
): HTMLCanvasElement {
    const longestSide = Math.max(canvas.width, canvas.height);
    if (longestSide <= maxDimension) {
        return canvas;
    }

    const scale = maxDimension / longestSide;
    const resized = createCanvas(canvas.width * scale, canvas.height * scale);
    const ctx = getCanvasContext(resized);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, resized.width, resized.height);
    return resized;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
        throw new Error("Canvas 上下文不可用");
    }
    return ctx;
}

function getNumericTagValue(value: number | number[] | undefined): number {
    if (typeof value === "number") {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === "number") {
        return value[0];
    }
    return 0;
}

function getIfdSize(ifd: UTIF.IFD) {
    const width = getNumericTagValue(ifd.width) || getNumericTagValue(ifd.t256);
    const height = getNumericTagValue(ifd.height) || getNumericTagValue(ifd.t257);
    return { width, height };
}

function isRenderableIfd(ifd: UTIF.IFD) {
    const { width, height } = getIfdSize(ifd);
    return width > 0 && height > 0;
}

function pickMainIfd(ifds: UTIF.IFD[]): UTIF.IFD {
    const renderable = ifds.filter(isRenderableIfd);
    if (renderable.length === 0) {
        throw new Error("TIFF 图片中没有可解码的图像页");
    }

    return renderable.reduce((best, current) => {
        const bestSize = getIfdSize(best);
        const currentSize = getIfdSize(current);
        return currentSize.width * currentSize.height > bestSize.width * bestSize.height
            ? current
            : best;
    });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("图片加载失败"));
        };
        image.src = url;
    });
}

async function decodeTiffToCanvas(file: File): Promise<HTMLCanvasElement> {
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    const mainIfd = pickMainIfd(ifds);
    UTIF.decodeImage(buffer, mainIfd, ifds);

    const rgba = UTIF.toRGBA8(mainIfd);
    const { width, height } = getIfdSize(mainIfd);
    if (rgba.length !== width * height * 4) {
        throw new Error("TIFF 解码后的像素尺寸异常");
    }

    const canvas = createCanvas(width, height);
    const ctx = getCanvasContext(canvas);
    const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

async function canvasToObjectUrl(
    canvas: HTMLCanvasElement,
    type = "image/png",
    quality?: number
): Promise<string> {
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (value) => {
                if (!value) {
                    reject(new Error("图片导出失败"));
                    return;
                }
                resolve(value);
            },
            type,
            quality
        );
    });

    return URL.createObjectURL(blob);
}

export function isTiffFile(file: File): boolean {
    if (TIFF_MIME_TYPES.has(file.type.toLowerCase())) {
        return true;
    }
    return /\.(tif|tiff)$/i.test(file.name);
}

export async function loadImageSource(file: File): Promise<LoadedImage> {
    if (isTiffFile(file)) {
        return decodeTiffToCanvas(file);
    }
    if ("createImageBitmap" in window) {
        return createImageBitmap(file);
    }
    return loadImageElement(file);
}

export async function createPreviewUrl(
    file: File,
    options?: PreviewOptions
): Promise<string> {
    if (!isTiffFile(file)) {
        return URL.createObjectURL(file);
    }
    const canvas = await decodeTiffToCanvas(file);
    const previewCanvas = downscaleCanvas(canvas, options?.maxDimension ?? 1600);
    return canvasToObjectUrl(previewCanvas);
}

export function disposeImageSource(source: LoadedImage) {
    if ("close" in source && typeof source.close === "function") {
        source.close();
    }
}
