export interface FocusStackOptions {
    autoAlign: boolean;
    manualShiftX: number;
    manualShiftY: number;
    scale: number;
    searchRadius: number;
    smoothRadius: number;
    confidenceThreshold: number;
    featherRadius: number;
    analysisMaxDimension?: number;
}

export interface FocusStackProgress {
    percent: number;
    label: string;
}

export interface FocusStackResult {
    resultUrl: string;
    maskUrl: string;
    winnerOverlayUrl: string;
    basePreviewUrl: string;
    alignedPreviewUrl: string;
    sharpnessAUrl: string;
    sharpnessBUrl: string;
    width: number;
    height: number;
    estimatedOffset: {
        x: number;
        y: number;
    };
}

type LoadedImage = ImageBitmap | HTMLImageElement;

const DEFAULT_ANALYSIS_MAX_DIMENSION = 1600;

function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
}

function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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

async function loadImageSource(file: File): Promise<LoadedImage> {
    if ("createImageBitmap" in window) {
        return createImageBitmap(file);
    }
    return loadImageElement(file);
}

function disposeImageSource(source: LoadedImage) {
    if ("close" in source && typeof source.close === "function") {
        source.close();
    }
}

function drawAlignedImage(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    width: number,
    height: number,
    shiftX = 0,
    shiftY = 0,
    scale = 1
) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.translate(width / 2 + shiftX, height / 2 + shiftY);
    ctx.scale(scale, scale);
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
    ctx.restore();
}

function rgbaToGrayscale(data: Uint8ClampedArray): Float32Array {
    const length = data.length / 4;
    const gray = new Float32Array(length);
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
            const center = gray[index];
            const value =
                Math.abs(
                    4 * center -
                        gray[index - 1] -
                        gray[index + 1] -
                        gray[index - width] -
                        gray[index + width]
                );
            output[index] = value;
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
            const clampedX = Math.max(0, Math.min(width - 1, x));
            sum += source[row + clampedX];
        }
        horizontal[row] = sum / windowSize;

        for (let x = 1; x < width; x += 1) {
            const addX = Math.min(width - 1, x + radius);
            const removeX = Math.max(0, x - radius - 1);
            sum += source[row + addX] - source[row + removeX];
            horizontal[row + x] = sum / windowSize;
        }
    }

    for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let y = -radius; y <= radius; y += 1) {
            const clampedY = Math.max(0, Math.min(height - 1, y));
            sum += horizontal[clampedY * width + x];
        }
        output[x] = sum / windowSize;

        for (let y = 1; y < height; y += 1) {
            const addY = Math.min(height - 1, y + radius);
            const removeY = Math.max(0, y - radius - 1);
            sum += horizontal[addY * width + x] - horizontal[removeY * width + x];
            output[y * width + x] = sum / windowSize;
        }
    }

    return output;
}

function normalizeMapToCanvas(
    map: Float32Array,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas 初始化失败");
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < map.length; i += 1) {
        const value = map[i];
        if (value < min) min = value;
        if (value > max) max = value;
    }

    const range = Math.max(1e-6, max - min);
    const imageData = ctx.createImageData(width, height);
    for (let i = 0, p = 0; p < map.length; i += 4, p += 1) {
        const normalized = Math.max(
            0,
            Math.min(255, Math.round(((map[p] - min) / range) * 255))
        );
        imageData.data[i] = normalized;
        imageData.data[i + 1] = normalized;
        imageData.data[i + 2] = normalized;
        imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function percentile(values: number[], ratio: number): number {
    if (values.length === 0) {
        return 0;
    }
    const index = Math.max(
        0,
        Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))
    );
    return values[index];
}

function normalizeScoreMap(map: Float32Array): Float32Array {
    const step = Math.max(1, Math.floor(map.length / 4096));
    const samples: number[] = [];
    for (let i = 0; i < map.length; i += step) {
        samples.push(map[i]);
    }
    samples.sort((a, b) => a - b);
    const low = percentile(samples, 0.05);
    const high = percentile(samples, 0.95);
    const range = Math.max(1e-6, high - low);

    const output = new Float32Array(map.length);
    for (let i = 0; i < map.length; i += 1) {
        output[i] = Math.max(0, Math.min(1, (map[i] - low) / range));
    }
    return output;
}

function maskToCanvas(
    mask: Float32Array,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas 初始化失败");
    }
    const imageData = ctx.createImageData(width, height);
    for (let i = 0, p = 0; p < mask.length; i += 4, p += 1) {
        const value = Math.max(0, Math.min(255, Math.round(mask[p] * 255)));
        imageData.data[i] = value;
        imageData.data[i + 1] = value;
        imageData.data[i + 2] = value;
        imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function winnerOverlayToCanvas(
    mask: Float32Array,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas 初始化失败");
    }

    const imageData = ctx.createImageData(width, height);
    for (let i = 0, p = 0; p < mask.length; i += 4, p += 1) {
        const value = mask[p];
        const red = Math.round((1 - value) * 255);
        const blue = Math.round(value * 255);
        imageData.data[i] = red;
        imageData.data[i + 1] = 0;
        imageData.data[i + 2] = blue;
        imageData.data[i + 3] = 180;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

async function canvasToObjectUrl(
    canvas: HTMLCanvasElement,
    type = "image/png",
    quality?: number
): Promise<string> {
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
            if (!value) {
                reject(new Error("图片导出失败"));
                return;
            }
            resolve(value);
        }, type, quality);
    });

    return URL.createObjectURL(blob);
}

function estimateTranslation(
    firstMap: Float32Array,
    secondMap: Float32Array,
    width: number,
    height: number,
    searchRadius: number
): { x: number; y: number } {
    const sampleStep = width * height > 250_000 ? 2 : 1;
    const marginX = Math.max(8, Math.floor(width * 0.1));
    const marginY = Math.max(8, Math.floor(height * 0.1));
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestX = 0;
    let bestY = 0;

    for (let dy = -searchRadius; dy <= searchRadius; dy += 1) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
            let score = 0;
            let count = 0;

            for (let y = marginY; y < height - marginY; y += sampleStep) {
                const shiftedY = y + dy;
                if (shiftedY < marginY || shiftedY >= height - marginY) {
                    continue;
                }

                for (let x = marginX; x < width - marginX; x += sampleStep) {
                    const shiftedX = x + dx;
                    if (shiftedX < marginX || shiftedX >= width - marginX) {
                        continue;
                    }

                    const firstValue = firstMap[y * width + x];
                    const secondValue = secondMap[shiftedY * width + shiftedX];
                    score += Math.min(firstValue, secondValue);
                    count += 1;
                }
            }

            const normalizedScore = count > 0 ? score / count : Number.NEGATIVE_INFINITY;
            if (normalizedScore > bestScore) {
                bestScore = normalizedScore;
                bestX = dx;
                bestY = dy;
            }
        }
    }

    return { x: bestX, y: bestY };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
    const denominator = Math.max(1e-6, edge1 - edge0);
    const t = Math.max(0, Math.min(1, (value - edge0) / denominator));
    return t * t * (3 - 2 * t);
}

function mixMaps(
    first: Float32Array,
    second: Float32Array,
    firstWeight: number
): Float32Array {
    const mixed = new Float32Array(first.length);
    const secondWeight = 1 - firstWeight;
    for (let i = 0; i < first.length; i += 1) {
        mixed[i] = first[i] * firstWeight + second[i] * secondWeight;
    }
    return mixed;
}

function confidenceOf(a: number, b: number): number {
    return (b - a) / (a + b + 1e-6);
}

function computeSobelMagnitudeMap(
    gray: Float32Array,
    width: number,
    height: number
): Float32Array {
    const output = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y += 1) {
        const row = y * width;
        for (let x = 1; x < width - 1; x += 1) {
            const index = row + x;
            const gx =
                -gray[index - width - 1] +
                gray[index - width + 1] -
                2 * gray[index - 1] +
                2 * gray[index + 1] -
                gray[index + width - 1] +
                gray[index + width + 1];
            const gy =
                gray[index - width - 1] +
                2 * gray[index - width] +
                gray[index - width + 1] -
                gray[index + width - 1] -
                2 * gray[index + width] -
                gray[index + width + 1];
            output[index] = Math.sqrt(gx * gx + gy * gy);
        }
    }
    return output;
}

function squareMap(source: Float32Array): Float32Array {
    const output = new Float32Array(source.length);
    for (let i = 0; i < source.length; i += 1) {
        output[i] = source[i] * source[i];
    }
    return output;
}

function computeLocalVarianceMap(
    gray: Float32Array,
    width: number,
    height: number,
    radius: number
): Float32Array {
    const mean = boxBlurMap(gray, width, height, radius);
    const meanSq = boxBlurMap(squareMap(gray), width, height, radius);
    const variance = new Float32Array(gray.length);
    for (let i = 0; i < gray.length; i += 1) {
        variance[i] = Math.max(0, meanSq[i] - mean[i] * mean[i]);
    }
    return variance;
}

function buildDecisionMask(
    gradientA: Float32Array,
    gradientB: Float32Array,
    laplacianA: Float32Array,
    laplacianB: Float32Array,
    varianceA: Float32Array,
    varianceB: Float32Array,
    threshold: number
): Float32Array {
    const mask = new Float32Array(gradientA.length);
    for (let i = 0; i < gradientA.length; i += 1) {
        const gradientConfidence = confidenceOf(gradientA[i], gradientB[i]);
        const laplacianConfidence = confidenceOf(laplacianA[i], laplacianB[i]);
        const varianceConfidence = confidenceOf(varianceA[i], varianceB[i]);
        const decisiveConfidence =
            gradientConfidence * 0.45 +
            laplacianConfidence * 0.35 +
            varianceConfidence * 0.2;

        if (decisiveConfidence <= -threshold) {
            mask[i] = 0;
            continue;
        }

        if (decisiveConfidence >= threshold) {
            mask[i] = 1;
            continue;
        }

        mask[i] = smoothstep(-threshold, threshold, decisiveConfidence);
    }
    return mask;
}

function buildRegionalWinnerMask(
    scoreA: Float32Array,
    scoreB: Float32Array,
    width: number,
    height: number,
    radius: number,
    threshold: number
): Float32Array {
    const regionalA = boxBlurMap(scoreA, width, height, radius);
    const regionalB = boxBlurMap(scoreB, width, height, radius);
    const mask = new Float32Array(scoreA.length);

    for (let i = 0; i < scoreA.length; i += 1) {
        const confidence = confidenceOf(regionalA[i], regionalB[i]);
        if (confidence <= -threshold) {
            mask[i] = 0;
            continue;
        }
        if (confidence >= threshold) {
            mask[i] = 1;
            continue;
        }
        mask[i] = smoothstep(-threshold, threshold, confidence);
    }

    return mask;
}

function buildBlockWinnerMask(
    scoreA: Float32Array,
    scoreB: Float32Array,
    width: number,
    height: number,
    blockSize: number,
    threshold: number
): Float32Array {
    const mask = new Float32Array(width * height);
    const effectiveBlockSize = Math.max(8, blockSize);

    for (let blockY = 0; blockY < height; blockY += effectiveBlockSize) {
        for (let blockX = 0; blockX < width; blockX += effectiveBlockSize) {
            const endY = Math.min(height, blockY + effectiveBlockSize);
            const endX = Math.min(width, blockX + effectiveBlockSize);
            let sumA = 0;
            let sumB = 0;
            let count = 0;

            for (let y = blockY; y < endY; y += 1) {
                const row = y * width;
                for (let x = blockX; x < endX; x += 1) {
                    const index = row + x;
                    sumA += scoreA[index];
                    sumB += scoreB[index];
                    count += 1;
                }
            }

            const averageA = count > 0 ? sumA / count : 0;
            const averageB = count > 0 ? sumB / count : 0;
            const confidence = confidenceOf(averageA, averageB);
            const winner = confidence >= -threshold ? (averageA >= averageB ? 0 : 1) : 0;

            for (let y = blockY; y < endY; y += 1) {
                const row = y * width;
                for (let x = blockX; x < endX; x += 1) {
                    mask[row + x] = winner;
                }
            }
        }
    }

    return mask;
}

function mergeMasks(
    regionalMask: Float32Array,
    detailMask: Float32Array
): Float32Array {
    const output = new Float32Array(regionalMask.length);
    for (let i = 0; i < regionalMask.length; i += 1) {
        const regionalValue = regionalMask[i];
        if (regionalValue <= 0.08 || regionalValue >= 0.92) {
            output[i] = regionalValue >= 0.5 ? 1 : 0;
            continue;
        }

        // 大区域先决定归属，只在交界不明确时用细节图修边。
        output[i] = regionalValue * 0.9 + detailMask[i] * 0.1 >= 0.5 ? 1 : 0;
    }
    return output;
}

function featherBinaryBoundaryMask(
    binaryMask: Float32Array,
    width: number,
    height: number,
    featherRadius: number
): Float32Array {
    if (featherRadius <= 0) {
        return binaryMask;
    }

    const blurred = boxBlurMap(binaryMask, width, height, featherRadius);
    const output = new Float32Array(binaryMask.length);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const i = y * width + x;
            const original = binaryMask[i];
            let boundary = false;
            if (x > 0 && binaryMask[i - 1] !== original) boundary = true;
            if (x < width - 1 && binaryMask[i + 1] !== original) boundary = true;
            if (y > 0 && binaryMask[i - width] !== original) boundary = true;
            if (y < height - 1 && binaryMask[i + width] !== original) boundary = true;

            if (!boundary) {
                output[i] = original;
                continue;
            }

            const feathered = blurred[i];
            output[i] = Math.max(0, Math.min(1, feathered));
        }
    }
    return output;
}

function getEffectiveAnalysisSize(
    width: number,
    height: number,
    maxDimension: number
): { width: number; height: number; scale: number } {
    const longestSide = Math.max(width, height);
    const scale = Math.min(1, maxDimension / longestSide);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scale,
    };
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas 上下文不可用");
    }
    return ctx;
}

function reportProgress(
    callback: ((value: FocusStackProgress) => void) | undefined,
    percent: number,
    label: string
) {
    callback?.({ percent, label });
}

export async function createFocusStackResult(
    firstFile: File,
    secondFile: File,
    options: FocusStackOptions,
    onProgress?: (value: FocusStackProgress) => void
): Promise<FocusStackResult> {
    reportProgress(onProgress, 5, "读取图片");
    const [firstSource, secondSource] = await Promise.all([
        loadImageSource(firstFile),
        loadImageSource(secondFile),
    ]);

    try {
        const outputWidth = Math.min(firstSource.width, secondSource.width);
        const outputHeight = Math.min(firstSource.height, secondSource.height);
        const analysisSize = getEffectiveAnalysisSize(
            outputWidth,
            outputHeight,
            options.analysisMaxDimension ?? DEFAULT_ANALYSIS_MAX_DIMENSION
        );

        const basePreviewCanvas = createCanvas(analysisSize.width, analysisSize.height);
        const alignedPreviewCanvas = createCanvas(analysisSize.width, analysisSize.height);
        const basePreviewCtx = getCanvasContext(basePreviewCanvas);
        const alignedPreviewCtx = getCanvasContext(alignedPreviewCanvas);

        drawAlignedImage(
            basePreviewCtx,
            firstSource,
            analysisSize.width,
            analysisSize.height
        );
        drawAlignedImage(
            alignedPreviewCtx,
            secondSource,
            analysisSize.width,
            analysisSize.height
        );

        reportProgress(onProgress, 20, "分析对齐");
        const baseGray = rgbaToGrayscale(
            basePreviewCtx.getImageData(0, 0, analysisSize.width, analysisSize.height).data
        );
        const targetGray = rgbaToGrayscale(
            alignedPreviewCtx.getImageData(0, 0, analysisSize.width, analysisSize.height).data
        );
        const baseEdgesForAlign = computeLaplacianMap(
            baseGray,
            analysisSize.width,
            analysisSize.height
        );
        const targetEdgesForAlign = computeLaplacianMap(
            targetGray,
            analysisSize.width,
            analysisSize.height
        );

        let autoOffset = { x: 0, y: 0 };
        if (options.autoAlign) {
            const scaledSearchRadius = Math.max(
                1,
                Math.round(options.searchRadius * analysisSize.scale)
            );
            const offset = estimateTranslation(
                baseEdgesForAlign,
                targetEdgesForAlign,
                analysisSize.width,
                analysisSize.height,
                scaledSearchRadius
            );
            autoOffset = {
                x: offset.x / analysisSize.scale,
                y: offset.y / analysisSize.scale,
            };
        }

        await nextFrame();

        const effectiveShiftX = autoOffset.x + options.manualShiftX;
        const effectiveShiftY = autoOffset.y + options.manualShiftY;

        drawAlignedImage(
            alignedPreviewCtx,
            secondSource,
            analysisSize.width,
            analysisSize.height,
            effectiveShiftX * analysisSize.scale,
            effectiveShiftY * analysisSize.scale,
            options.scale
        );

        reportProgress(onProgress, 45, "计算清晰区域");
        const alignedGray = rgbaToGrayscale(
            alignedPreviewCtx.getImageData(0, 0, analysisSize.width, analysisSize.height).data
        );
        const laplacianA = computeLaplacianMap(
            baseGray,
            analysisSize.width,
            analysisSize.height
        );
        const laplacianB = computeLaplacianMap(
            alignedGray,
            analysisSize.width,
            analysisSize.height
        );
        const sobelA = computeSobelMagnitudeMap(
            baseGray,
            analysisSize.width,
            analysisSize.height
        );
        const sobelB = computeSobelMagnitudeMap(
            alignedGray,
            analysisSize.width,
            analysisSize.height
        );
        const localVarianceA = computeLocalVarianceMap(
            baseGray,
            analysisSize.width,
            analysisSize.height,
            Math.max(1, Math.round(options.smoothRadius * 0.75))
        );
        const localVarianceB = computeLocalVarianceMap(
            alignedGray,
            analysisSize.width,
            analysisSize.height,
            Math.max(1, Math.round(options.smoothRadius * 0.75))
        );
        const normalizedSobelA = normalizeScoreMap(sobelA);
        const normalizedSobelB = normalizeScoreMap(sobelB);
        const normalizedLaplacianA = normalizeScoreMap(laplacianA);
        const normalizedLaplacianB = normalizeScoreMap(laplacianB);
        const normalizedVarianceA = normalizeScoreMap(localVarianceA);
        const normalizedVarianceB = normalizeScoreMap(localVarianceB);
        const sharpnessA = mixMaps(
            mixMaps(
                boxBlurMap(
                    normalizedSobelA,
                    analysisSize.width,
                    analysisSize.height,
                    Math.max(1, Math.round(options.smoothRadius * 0.5))
                ),
                boxBlurMap(
                    normalizedLaplacianA,
                    analysisSize.width,
                    analysisSize.height,
                    Math.max(1, Math.round(options.smoothRadius * 0.5))
                ),
                0.55
            ),
            boxBlurMap(
                normalizedVarianceA,
                analysisSize.width,
                analysisSize.height,
                Math.max(1, Math.round(options.smoothRadius * 0.5))
            ),
            0.8
        );
        const sharpnessB = mixMaps(
            boxBlurMap(
                mixMaps(
                    boxBlurMap(
                        normalizedSobelB,
                        analysisSize.width,
                        analysisSize.height,
                        Math.max(1, Math.round(options.smoothRadius * 0.5))
                    ),
                    boxBlurMap(
                        normalizedLaplacianB,
                        analysisSize.width,
                        analysisSize.height,
                        Math.max(1, Math.round(options.smoothRadius * 0.5))
                    ),
                    0.55
                ),
                analysisSize.width,
                analysisSize.height,
                0
            ),
            boxBlurMap(
                normalizedVarianceB,
                analysisSize.width,
                analysisSize.height,
                Math.max(1, Math.round(options.smoothRadius * 0.5))
            ),
            0.8
        );
        const detailMask = buildDecisionMask(
            boxBlurMap(
                normalizedSobelA,
                analysisSize.width,
                analysisSize.height,
                Math.max(1, Math.round(options.smoothRadius * 0.5))
            ),
            boxBlurMap(
                normalizedSobelB,
                analysisSize.width,
                analysisSize.height,
                Math.max(1, Math.round(options.smoothRadius * 0.5))
            ),
            normalizedLaplacianA,
            normalizedLaplacianB,
            normalizedVarianceA,
            normalizedVarianceB,
            options.confidenceThreshold
        );
        const regionalMask = buildRegionalWinnerMask(
            sharpnessA,
            sharpnessB,
            analysisSize.width,
            analysisSize.height,
            Math.max(6, Math.round(options.smoothRadius * 2.5)),
            Math.max(0.015, options.confidenceThreshold * 0.6)
        );
        const blockMask = buildBlockWinnerMask(
            sharpnessA,
            sharpnessB,
            analysisSize.width,
            analysisSize.height,
            Math.max(20, Math.round(options.smoothRadius * 6)),
            Math.max(0.01, options.confidenceThreshold * 0.4)
        );
        let mask = mergeMasks(blockMask, mergeMasks(regionalMask, detailMask));
        mask = featherBinaryBoundaryMask(
            mask,
            analysisSize.width,
            analysisSize.height,
            options.featherRadius
        );

        await nextFrame();

        reportProgress(onProgress, 70, "生成掩膜");
        const maskPreviewCanvas = maskToCanvas(
            mask,
            analysisSize.width,
            analysisSize.height
        );
        const winnerOverlayCanvas = winnerOverlayToCanvas(
            mask,
            analysisSize.width,
            analysisSize.height
        );
        const sharpnessACanvas = normalizeMapToCanvas(
            sharpnessA,
            analysisSize.width,
            analysisSize.height
        );
        const sharpnessBCanvas = normalizeMapToCanvas(
            sharpnessB,
            analysisSize.width,
            analysisSize.height
        );

        reportProgress(onProgress, 82, "合成全分辨率结果");
        const resultCanvas = createCanvas(outputWidth, outputHeight);
        const resultCtx = getCanvasContext(resultCanvas);
        drawAlignedImage(resultCtx, firstSource, outputWidth, outputHeight);

        const secondLayerCanvas = createCanvas(outputWidth, outputHeight);
        const secondLayerCtx = getCanvasContext(secondLayerCanvas);
        drawAlignedImage(
            secondLayerCtx,
            secondSource,
            outputWidth,
            outputHeight,
            effectiveShiftX,
            effectiveShiftY,
            options.scale
        );

        const fullMaskCanvas = createCanvas(outputWidth, outputHeight);
        const fullMaskCtx = getCanvasContext(fullMaskCanvas);
        fullMaskCtx.imageSmoothingEnabled = false;
        fullMaskCtx.drawImage(maskPreviewCanvas, 0, 0, outputWidth, outputHeight);
        secondLayerCtx.globalCompositeOperation = "destination-in";
        secondLayerCtx.drawImage(fullMaskCanvas, 0, 0);
        secondLayerCtx.globalCompositeOperation = "source-over";
        resultCtx.drawImage(secondLayerCanvas, 0, 0);

        reportProgress(onProgress, 92, "导出预览");
        const [
            resultUrl,
            maskUrl,
            winnerOverlayUrl,
            basePreviewUrl,
            alignedPreviewUrl,
            sharpnessAUrl,
            sharpnessBUrl,
        ] = await Promise.all([
            canvasToObjectUrl(resultCanvas),
            canvasToObjectUrl(maskPreviewCanvas),
            canvasToObjectUrl(winnerOverlayCanvas),
            canvasToObjectUrl(basePreviewCanvas),
            canvasToObjectUrl(alignedPreviewCanvas),
            canvasToObjectUrl(sharpnessACanvas),
            canvasToObjectUrl(sharpnessBCanvas),
        ]);

        reportProgress(onProgress, 100, "完成");
        return {
            resultUrl,
            maskUrl,
            winnerOverlayUrl,
            basePreviewUrl,
            alignedPreviewUrl,
            sharpnessAUrl,
            sharpnessBUrl,
            width: outputWidth,
            height: outputHeight,
            estimatedOffset: {
                x: autoOffset.x,
                y: autoOffset.y,
            },
        };
    } finally {
        disposeImageSource(firstSource);
        disposeImageSource(secondSource);
    }
}
