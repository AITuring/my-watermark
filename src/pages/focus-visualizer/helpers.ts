import { loadImageSource, disposeImageSource } from "@/utils/image-loading";
import {
    RawDecoder,
    type RawDecodeMode,
} from "@/pages/raw-editor/editor/engine/RawDecoder";

const RAW_FILE_RE = /\.(cr2|cr3|nef|nrw|arw|sr2|srf|dng|raf|orf|rw2|pef|iiq|3fr|srw)$/i;

export interface FocusPoint {
    x: number;
    y: number;
}

export interface FocusVisualizationResult {
    previewUrl: string;
    overlayUrl: string;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    focusPoint: FocusPoint;
    peakPoint: FocusPoint;
    focusCoverage: number;
    focusScore: number;
    peakValue: number;
    fileKind: "raw" | "image";
    rawDecodeMode?: RawDecodeMode;
    rawDecodePreset?: "high-quality" | "fast-preview";
}

export interface AnalyzeFocusFileOptions {
    rawDecodeMode?: RawDecodeMode;
    maxDimension?: number;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
        throw new Error("Canvas 上下文不可用");
    }
    return ctx;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function fitDimensions(
    width: number,
    height: number,
    maxDimension: number
): { width: number; height: number; scale: number } {
    const longestSide = Math.max(width, height);
    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scale,
    };
}

function percentile(values: number[], ratio: number): number {
    if (values.length === 0) {
        return 0;
    }
    const index = clamp(
        Math.floor((values.length - 1) * ratio),
        0,
        values.length - 1
    );
    return values[index];
}

function rgbaToGray(data: Uint8ClampedArray): Float32Array {
    const gray = new Float32Array(data.length / 4);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    return gray;
}

function computeLaplacianMap(
    gray: Float32Array,
    width: number,
    height: number
): Float32Array {
    const output = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y += 1) {
        const row = y * width;
        for (let x = 1; x < width - 1; x += 1) {
            const index = row + x;
            output[index] = Math.abs(
                4 * gray[index] -
                    gray[index - 1] -
                    gray[index + 1] -
                    gray[index - width] -
                    gray[index + width]
            );
        }
    }
    return output;
}

function boxBlurMap(
    source: Float32Array,
    width: number,
    height: number,
    radius: number
): Float32Array {
    if (radius <= 0) {
        return source.slice();
    }

    const horizontal = new Float32Array(width * height);
    const output = new Float32Array(width * height);
    const windowSize = radius * 2 + 1;

    for (let y = 0; y < height; y += 1) {
        const row = y * width;
        let sum = 0;
        for (let x = -radius; x <= radius; x += 1) {
            const clampedX = clamp(x, 0, width - 1);
            sum += source[row + clampedX];
        }
        horizontal[row] = sum / windowSize;

        for (let x = 1; x < width; x += 1) {
            const addX = clamp(x + radius, 0, width - 1);
            const removeX = clamp(x - radius - 1, 0, width - 1);
            sum += source[row + addX] - source[row + removeX];
            horizontal[row + x] = sum / windowSize;
        }
    }

    for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let y = -radius; y <= radius; y += 1) {
            const clampedY = clamp(y, 0, height - 1);
            sum += horizontal[clampedY * width + x];
        }
        output[x] = sum / windowSize;

        for (let y = 1; y < height; y += 1) {
            const addY = clamp(y + radius, 0, height - 1);
            const removeY = clamp(y - radius - 1, 0, height - 1);
            sum += horizontal[addY * width + x] - horizontal[removeY * width + x];
            output[y * width + x] = sum / windowSize;
        }
    }

    return output;
}

function normalizeMap(map: Float32Array): Float32Array {
    const samples: number[] = [];
    const step = Math.max(1, Math.floor(map.length / 4096));
    for (let i = 0; i < map.length; i += step) {
        samples.push(map[i]);
    }
    samples.sort((a, b) => a - b);

    const low = percentile(samples, 0.08);
    const high = percentile(samples, 0.985);
    const range = Math.max(1e-6, high - low);

    const output = new Float32Array(map.length);
    for (let i = 0; i < map.length; i += 1) {
        output[i] = clamp((map[i] - low) / range, 0, 1);
    }
    return output;
}

function getHeatColor(value: number): [number, number, number] {
    const clamped = clamp(value, 0, 1);
    if (clamped < 0.25) {
        const t = clamped / 0.25;
        return [0, Math.round(110 * t), Math.round(255 * (0.6 + 0.4 * t))];
    }
    if (clamped < 0.5) {
        const t = (clamped - 0.25) / 0.25;
        return [0, Math.round(110 + 145 * t), Math.round(255 - 155 * t)];
    }
    if (clamped < 0.75) {
        const t = (clamped - 0.5) / 0.25;
        return [Math.round(255 * t), 255, Math.round(100 - 100 * t)];
    }
    const t = (clamped - 0.75) / 0.25;
    return [255, Math.round(255 - 175 * t), 0];
}

function buildHeatOverlay(
    map: Float32Array,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = createCanvas(width, height);
    const ctx = getCanvasContext(canvas);
    const imageData = ctx.createImageData(width, height);

    for (let i = 0, p = 0; p < map.length; i += 4, p += 1) {
        const value = map[p];
        const [r, g, b] = getHeatColor(value);
        const alpha = Math.round(Math.pow(value, 1.25) * 215);
        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
        imageData.data[i + 3] = alpha;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

async function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
            if (!value) {
                reject(new Error("图片导出失败"));
                return;
            }
            resolve(value);
        }, "image/png");
    });
    return URL.createObjectURL(blob);
}

function isRawFile(file: File) {
    return RAW_FILE_RE.test(file.name);
}

function renderRawPreviewCanvas(
    rawImage: {
        width: number;
        height: number;
        data: Float32Array;
    },
    maxDimension: number
): HTMLCanvasElement {
    const size = fitDimensions(rawImage.width, rawImage.height, maxDimension);
    const canvas = createCanvas(size.width, size.height);
    const ctx = getCanvasContext(canvas);
    const imageData = ctx.createImageData(size.width, size.height);

    for (let y = 0; y < size.height; y += 1) {
        const srcY = Math.min(
            rawImage.height - 1,
            Math.round((y / Math.max(size.height - 1, 1)) * Math.max(rawImage.height - 1, 0))
        );
        for (let x = 0; x < size.width; x += 1) {
            const srcX = Math.min(
                rawImage.width - 1,
                Math.round((x / Math.max(size.width - 1, 1)) * Math.max(rawImage.width - 1, 0))
            );
            const srcIndex = (srcY * rawImage.width + srcX) * 4;
            const dstIndex = (y * size.width + x) * 4;

            const r = clamp(rawImage.data[srcIndex] ?? 0, 0, 1);
            const g = clamp(rawImage.data[srcIndex + 1] ?? 0, 0, 1);
            const b = clamp(rawImage.data[srcIndex + 2] ?? 0, 0, 1);
            imageData.data[dstIndex] = Math.round(Math.pow(r, 1 / 2.2) * 255);
            imageData.data[dstIndex + 1] = Math.round(Math.pow(g, 1 / 2.2) * 255);
            imageData.data[dstIndex + 2] = Math.round(Math.pow(b, 1 / 2.2) * 255);
            imageData.data[dstIndex + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

async function loadPreviewCanvas(
    file: File,
    maxDimension: number,
    options?: AnalyzeFocusFileOptions
): Promise<{
    canvas: HTMLCanvasElement;
    originalWidth: number;
    originalHeight: number;
    fileKind: "raw" | "image";
    rawDecodeMode?: RawDecodeMode;
    rawDecodePreset?: "high-quality" | "fast-preview";
}> {
    if (isRawFile(file)) {
        const decoder = new RawDecoder();
        const rawImage = await decoder.decode(file, {
            mode: options?.rawDecodeMode,
        });
        return {
            canvas: renderRawPreviewCanvas(rawImage, maxDimension),
            originalWidth: rawImage.metadata.sourceWidth ?? rawImage.metadata.width ?? rawImage.width,
            originalHeight:
                rawImage.metadata.sourceHeight ?? rawImage.metadata.height ?? rawImage.height,
            fileKind: "raw",
            rawDecodeMode: rawImage.metadata.rawDecodeMode,
            rawDecodePreset: rawImage.metadata.rawDecodePreset,
        };
    }

    const source = await loadImageSource(file);
    try {
        const width = "width" in source ? Number(source.width) : 0;
        const height = "height" in source ? Number(source.height) : 0;
        const targetSize = fitDimensions(width, height, maxDimension);
        const canvas = createCanvas(targetSize.width, targetSize.height);
        const ctx = getCanvasContext(canvas);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(source, 0, 0, targetSize.width, targetSize.height);

        return {
            canvas,
            originalWidth: width,
            originalHeight: height,
            fileKind: "image",
        };
    } finally {
        disposeImageSource(source);
    }
}

function analyzeSharpnessCanvas(canvas: HTMLCanvasElement) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = getCanvasContext(canvas);
    const imageData = ctx.getImageData(0, 0, width, height);
    const gray = rgbaToGray(imageData.data);
    const laplacian = computeLaplacianMap(gray, width, height);
    const smoothed = boxBlurMap(laplacian, width, height, Math.max(2, Math.round(Math.max(width, height) / 220)));
    const normalized = normalizeMap(smoothed);

    const samples = Array.from(normalized);
    samples.sort((a, b) => a - b);

    const focusThreshold = Math.max(0.38, percentile(samples, 0.88));
    const scoreThreshold = percentile(samples, 0.97);

    let focusWeightSum = 0;
    let weightedX = 0;
    let weightedY = 0;
    let coverageCount = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    let peakValue = -1;
    let peakX = 0;
    let peakY = 0;

    for (let y = 0; y < height; y += 1) {
        const row = y * width;
        for (let x = 0; x < width; x += 1) {
            const value = normalized[row + x];
            if (value > peakValue) {
                peakValue = value;
                peakX = x;
                peakY = y;
            }
            if (value >= focusThreshold) {
                const weight = Math.pow((value - focusThreshold) / Math.max(1 - focusThreshold, 1e-6), 1.6);
                focusWeightSum += weight;
                weightedX += x * weight;
                weightedY += y * weight;
                coverageCount += 1;
            }
            if (value >= scoreThreshold) {
                scoreSum += value;
                scoreCount += 1;
            }
        }
    }

    const focusPoint =
        focusWeightSum > 0
            ? {
                  x: weightedX / focusWeightSum,
                  y: weightedY / focusWeightSum,
              }
            : {
                  x: peakX,
                  y: peakY,
              };

    return {
        normalizedMap: normalized,
        focusPoint,
        peakPoint: { x: peakX, y: peakY },
        focusCoverage: coverageCount / Math.max(width * height, 1),
        focusScore: scoreCount > 0 ? scoreSum / scoreCount : peakValue,
        peakValue: peakValue < 0 ? 0 : peakValue,
    };
}

export async function analyzeFocusFile(
    file: File,
    options?: AnalyzeFocusFileOptions
): Promise<FocusVisualizationResult> {
    const resolvedMaxDimension =
        options?.maxDimension ??
        (isRawFile(file) && options?.rawDecodeMode === "fast" ? 1120 : 1440);
    const {
        canvas,
        originalWidth,
        originalHeight,
        fileKind,
        rawDecodeMode,
        rawDecodePreset,
    } = await loadPreviewCanvas(file, resolvedMaxDimension, options);
    const analysis = analyzeSharpnessCanvas(canvas);
    const overlayCanvas = buildHeatOverlay(
        analysis.normalizedMap,
        canvas.width,
        canvas.height
    );

    const [previewUrl, overlayUrl] = await Promise.all([
        canvasToObjectUrl(canvas),
        canvasToObjectUrl(overlayCanvas),
    ]);

    return {
        previewUrl,
        overlayUrl,
        width: canvas.width,
        height: canvas.height,
        originalWidth,
        originalHeight,
        focusPoint: analysis.focusPoint,
        peakPoint: analysis.peakPoint,
        focusCoverage: analysis.focusCoverage,
        focusScore: analysis.focusScore,
        peakValue: analysis.peakValue,
        fileKind,
        rawDecodeMode,
        rawDecodePreset,
    };
}

export function revokeFocusVisualizationUrls(result: FocusVisualizationResult | null | undefined) {
    if (!result) {
        return;
    }
    URL.revokeObjectURL(result.previewUrl);
    URL.revokeObjectURL(result.overlayUrl);
}

export function getFocusMarkerColor(index: number) {
    const palette = [
        "#ef4444",
        "#3b82f6",
        "#22c55e",
        "#f59e0b",
        "#a855f7",
        "#06b6d4",
        "#ec4899",
        "#84cc16",
    ];
    return palette[index % palette.length];
}

export function isSupportedFocusFile(file: File) {
    return file.type.startsWith("image/") || isRawFile(file);
}
