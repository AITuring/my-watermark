export interface FocusStackOptions {
    autoAlign: boolean;
    manualShiftX: number;
    manualShiftY: number;
    scale: number;
    searchRadius: number;
    smoothRadius: number;
    confidenceThreshold: number;
    featherRadius: number;
    // 前景边缘保护半径（分析像素）：把“清晰前景边缘（如玉璧内缘）”向内扩张这么多，
    // 用清晰那张覆盖失焦图在边缘外溢出的一圈亮边光晕。0 关闭。
    foregroundProtect?: number;
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

// 决策分析分辨率。两级规则下谷纹走“逐像素决定性”通道、不再依赖大连贯窗口，
// 因此可以用较高分辨率来解析细特征（细手指/衣纹）而不会让谷纹重新长斑块。
const DEFAULT_ANALYSIS_MAX_DIMENSION = 1536;
// 融合处理的像素预算：超过则按比例下采样，防止大图爆内存导致浏览器崩溃。
const MAX_PROCESS_PIXELS = 24_000_000;

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

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
        throw new Error("Canvas 上下文不可用");
    }
    return ctx;
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
    ctx.imageSmoothingQuality = "high";
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
            output[index] = Math.abs(
                4 * center -
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

function normalizeMapToCanvas(
    map: Float32Array,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = createCanvas(width, height);
    const ctx = getCanvasContext(canvas);

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

function maskToCanvas(
    mask: Float32Array,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = createCanvas(width, height);
    const ctx = getCanvasContext(canvas);
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
    const ctx = getCanvasContext(canvas);

    const imageData = ctx.createImageData(width, height);
    for (let i = 0, p = 0; p < mask.length; i += 4, p += 1) {
        const value = mask[p];
        imageData.data[i] = Math.round((1 - value) * 255);
        imageData.data[i + 1] = 0;
        imageData.data[i + 2] = Math.round(value * 255);
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

            const normalizedScore =
                count > 0 ? score / count : Number.NEGATIVE_INFINITY;
            if (normalizedScore > bestScore) {
                bestScore = normalizedScore;
                bestX = dx;
                bestY = dy;
            }
        }
    }

    return { x: bestX, y: bestY };
}

interface ChannelPlanes {
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
    lum: Float32Array;
    width: number;
    height: number;
}

function imageDataToChannelPlanes(
    data: Uint8ClampedArray,
    width: number,
    height: number
): ChannelPlanes {
    const length = width * height;
    const r = new Float32Array(length);
    const g = new Float32Array(length);
    const b = new Float32Array(length);
    const lum = new Float32Array(length);
    for (let i = 0, p = 0; p < length; i += 4, p += 1) {
        const rr = data[i];
        const gg = data[i + 1];
        const bb = data[i + 2];
        r[p] = rr;
        g[p] = gg;
        b[p] = bb;
        lum[p] = rr * 0.299 + gg * 0.587 + bb * 0.114;
    }
    return { r, g, b, lum, width, height };
}

// 在“归一化分析分辨率”下计算归属掩膜。
// 这是消除斑块的关键：清晰度/连贯窗口是绝对像素，若直接在原始高分辨率上计算，
// 窗口相对纹理（如谷纹）太小，判定会在纹理尺度上来回翻转 → 斑块。
// 固定在约 1024px 上决策，窗口相对纹理才够大，能把整块区域稳定归属同一张。
// 掩膜随后被放大回原分辨率，最终像素仍取自全分辨率原图，清晰度不损失。
function computeDecisionMask(
    lumA: Float32Array,
    lumB: Float32Array,
    width: number,
    height: number,
    options: FocusStackOptions
): Float32Array {
    const size = width * height;

    // 局部清晰度度量：亮度拉普拉斯（越大越清晰），再做一次平滑消除噪声。
    const focusRadius = Math.max(1, Math.round(options.smoothRadius));
    const focusA = boxBlurMap(
        computeLaplacianMap(lumA, width, height),
        width,
        height,
        focusRadius
    );
    const focusB = boxBlurMap(
        computeLaplacianMap(lumB, width, height),
        width,
        height,
        focusRadius
    );

    // B 相对 A 的“细尺度清晰度优势”，归一化到 [-1,1]（与绝对对比度无关）。
    // 这是逐像素“真相”：谁真的更清晰。它能分辨出细手指、衣纹等细特征。
    const fine = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
        fine[i] = (focusB[i] - focusA[i]) / (focusB[i] + focusA[i] + 1e-3);
    }

    // 大窗口连贯优势：抹平细小抖动，用于“细尺度暧昧”的平坦区做稳定的区域判定，
    // 避免平坦/低纹理处逐像素翻转产生斑块。
    const coherenceRadius = Math.max(6, Math.round(options.smoothRadius * 2));
    const coarse = boxBlurMap(fine, width, height, coherenceRadius);

    // 置信度地板：区域清晰度太低（暗部/两张都平坦）时判定无意义，直接归属参考图 A。
    const regionalA = boxBlurMap(focusA, width, height, coherenceRadius);
    const regionalB = boxBlurMap(focusB, width, height, coherenceRadius);
    const magnitudeSamples: number[] = [];
    for (let i = 0; i < size; i += 7) {
        magnitudeSamples.push(Math.max(regionalA[i], regionalB[i]));
    }
    magnitudeSamples.sort((a, b) => a - b);
    const confidenceFloor = percentile(magnitudeSamples, 0.9) * 0.04;

    // 核心：细节决定性优先。
    // 固定的连贯窗口无法同时“稳住谷纹”和“保留细手指”——窗口够大稳住纹理，就会吞掉细特征。
    // 所以：某像素的细尺度优势足够决定性（|fine| 大，说明这里明确有一张更清晰，
    // 如谷纹或陶俑手指）时，就直接采信逐像素真相；只有在细尺度暧昧（平坦/低纹理）
    // 时才退回大窗口的稳定区域判定。这样谷纹稳定不长斑块，细特征也不被连贯吞掉。
    const decisive = 0.2;

    // 对称“结构归属”：消除深度突变处“一圈光晕”的关键。
    // 失焦那张里，物体的虚化亮部会向外溢出、盖住边缘外一圈；而这圈溢出带梯度，
    // 清晰度测量会被骗、把本应干净的邻域误判给模糊那张 —— 这正是顽固光晕的来源。
    // 解法：让“清晰的一方”把紧贴自己的暧昧/被污染邻域认领过来，用自己那张的干净像素覆盖：
    //  - 清晰前景（玉璧内缘，强 A）认领 → 消除失焦亮边向内溢出的“内缘光晕”。
    //  - 清晰主体（对焦的陶俑，强 B）认领 → 用干净暗背景覆盖失焦图里陶俑向外溢出的“轮廓亮边”。
    // 谷纹等本身就是强结构的像素其归属值≈1，不会被对方认领，因此清晰区不受影响。
    // 光晕宽度大致占图像的固定比例，而决策在分析分辨率上进行，所以把滑杆值按
    // 分析分辨率缩放（以 1024 为基准），滑杆的实际效果才不随图片尺寸变化。
    const protectRadius = Math.max(
        0,
        Math.round((options.foregroundProtect ?? 8) * (Math.max(width, height) / 1024))
    );
    let dilatedA: Float32Array | null = null;
    let dilatedB: Float32Array | null = null;
    if (protectRadius > 0) {
        const strongA = new Float32Array(size);
        const strongB = new Float32Array(size);
        for (let i = 0; i < size; i += 1) {
            strongA[i] = fine[i] < -decisive ? 1 : 0;
            strongB[i] = fine[i] > decisive ? 1 : 0;
        }
        dilatedA = boxBlurMap(strongA, width, height, protectRadius);
        dilatedB = boxBlurMap(strongB, width, height, protectRadius);
    }

    const margin = Math.max(0.02, options.confidenceThreshold);
    const decisionMask = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
        const confident = Math.max(regionalA[i], regionalB[i]) > confidenceFloor;
        const advantage =
            fine[i] > decisive || fine[i] < -decisive ? fine[i] : coarse[i];
        let pick = confident && advantage > margin ? 1 : 0;
        if (dilatedA && dilatedB) {
            const claimA = dilatedA[i];
            const claimB = dilatedB[i];
            if (claimB > 0.12 && claimB >= claimA) {
                pick = 1;
            } else if (claimA > 0.12 && claimA > claimB) {
                pick = 0;
            }
        }
        decisionMask[i] = pick;
    }

    // 极窄羽化，仅消除接缝锯齿；随后放大 + 二值化，边界仍紧贴真实清晰区。
    const feather = Math.max(1, Math.round(options.featherRadius));
    return boxBlurMap(decisionMask, width, height, feather);
}

// 把分析分辨率的掩膜用双线性放大到目标分辨率，返回 0..1 权重。
function upscaleMaskToWeights(
    mask: Float32Array,
    maskWidth: number,
    maskHeight: number,
    targetWidth: number,
    targetHeight: number
): Float32Array {
    const smallCanvas = maskToCanvas(mask, maskWidth, maskHeight);
    const bigCanvas = createCanvas(targetWidth, targetHeight);
    const ctx = getCanvasContext(bigCanvas);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(smallCanvas, 0, 0, targetWidth, targetHeight);
    const data = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
    const out = new Float32Array(targetWidth * targetHeight);
    for (let i = 0, p = 0; p < out.length; i += 4, p += 1) {
        out[p] = data[i] / 255;
    }
    return out;
}

function channelsToCanvas(
    r: Float32Array,
    g: Float32Array,
    b: Float32Array,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = createCanvas(width, height);
    const ctx = getCanvasContext(canvas);
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0, p = 0; p < r.length; i += 4, p += 1) {
        data[i] = Math.max(0, Math.min(255, Math.round(r[p])));
        data[i + 1] = Math.max(0, Math.min(255, Math.round(g[p])));
        data[i + 2] = Math.max(0, Math.min(255, Math.round(b[p])));
        data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
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

function getProcessSize(
    width: number,
    height: number
): { width: number; height: number } {
    const totalPixels = width * height;
    if (totalPixels <= MAX_PROCESS_PIXELS) {
        return { width, height };
    }
    const ratio = Math.sqrt(MAX_PROCESS_PIXELS / totalPixels);
    return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio)),
    };
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
        const nativeWidth = Math.min(firstSource.width, secondSource.width);
        const nativeHeight = Math.min(firstSource.height, secondSource.height);
        const processSize = getProcessSize(nativeWidth, nativeHeight);
        const outputWidth = processSize.width;
        const outputHeight = processSize.height;

        const analysisSize = getEffectiveAnalysisSize(
            outputWidth,
            outputHeight,
            options.analysisMaxDimension ?? DEFAULT_ANALYSIS_MAX_DIMENSION
        );

        // --- 低分辨率对齐分析 ---
        const basePreviewCanvas = createCanvas(analysisSize.width, analysisSize.height);
        const alignedPreviewCanvas = createCanvas(
            analysisSize.width,
            analysisSize.height
        );
        const basePreviewCtx = getCanvasContext(basePreviewCanvas);
        const alignedPreviewCtx = getCanvasContext(alignedPreviewCanvas);

        drawAlignedImage(basePreviewCtx, firstSource, analysisSize.width, analysisSize.height);
        drawAlignedImage(
            alignedPreviewCtx,
            secondSource,
            analysisSize.width,
            analysisSize.height
        );

        reportProgress(onProgress, 18, "分析对齐");
        const baseGray = rgbaToGrayscale(
            basePreviewCtx.getImageData(0, 0, analysisSize.width, analysisSize.height).data
        );
        const targetGray = rgbaToGrayscale(
            alignedPreviewCtx.getImageData(0, 0, analysisSize.width, analysisSize.height)
                .data
        );

        let autoOffset = { x: 0, y: 0 };
        if (options.autoAlign) {
            const baseEdges = computeLaplacianMap(
                baseGray,
                analysisSize.width,
                analysisSize.height
            );
            const targetEdges = computeLaplacianMap(
                targetGray,
                analysisSize.width,
                analysisSize.height
            );
            const scaledSearchRadius = Math.max(
                1,
                Math.round(options.searchRadius * analysisSize.scale)
            );
            const offset = estimateTranslation(
                baseEdges,
                targetEdges,
                analysisSize.width,
                analysisSize.height,
                scaledSearchRadius
            );
            autoOffset = {
                x: offset.x / analysisSize.scale,
                y: offset.y / analysisSize.scale,
            };
        }

        const effectiveShiftX = autoOffset.x + options.manualShiftX;
        const effectiveShiftY = autoOffset.y + options.manualShiftY;

        // 更新对齐后的预览（低分辨率）。
        drawAlignedImage(
            alignedPreviewCtx,
            secondSource,
            analysisSize.width,
            analysisSize.height,
            effectiveShiftX * analysisSize.scale,
            effectiveShiftY * analysisSize.scale,
            options.scale
        );

        await nextFrame();

        // --- 处理分辨率下的对齐渲染 ---
        reportProgress(onProgress, 32, "渲染对齐图层");
        const layerACanvas = createCanvas(outputWidth, outputHeight);
        const layerBCanvas = createCanvas(outputWidth, outputHeight);
        const layerACtx = getCanvasContext(layerACanvas);
        const layerBCtx = getCanvasContext(layerBCanvas);

        drawAlignedImage(layerACtx, firstSource, outputWidth, outputHeight);
        drawAlignedImage(
            layerBCtx,
            secondSource,
            outputWidth,
            outputHeight,
            effectiveShiftX,
            effectiveShiftY,
            options.scale
        );

        const imageA = imageDataToChannelPlanes(
            layerACtx.getImageData(0, 0, outputWidth, outputHeight).data,
            outputWidth,
            outputHeight
        );
        const imageB = imageDataToChannelPlanes(
            layerBCtx.getImageData(0, 0, outputWidth, outputHeight).data,
            outputWidth,
            outputHeight
        );

        await nextFrame();

        // --- 归属决策（在归一化分析分辨率上进行，随后放大回原分辨率）---
        reportProgress(onProgress, 55, "分析清晰区域");
        const analysisLumA = baseGray;
        const analysisLumB = rgbaToGrayscale(
            alignedPreviewCtx.getImageData(
                0,
                0,
                analysisSize.width,
                analysisSize.height
            ).data
        );
        const analysisMask = computeDecisionMask(
            analysisLumA,
            analysisLumB,
            analysisSize.width,
            analysisSize.height,
            options
        );
        const maskWeights = upscaleMaskToWeights(
            analysisMask,
            analysisSize.width,
            analysisSize.height,
            outputWidth,
            outputHeight
        );

        // 硬选择：这是“全图清晰”的关键。任何介于 0~1 的权重都会把“清晰那张”与
        // “模糊那张”的像素做加权平均 —— 平均结果必然发糊。之前的柔性过渡/偏置反而
        // 会把小而暗但清晰的主体（如左侧小陶俑）拉回模糊的一张。
        // 掩膜已在 1024 上做过连贯与羽化、再双线性放大（边界因此平滑不锯齿），
        // 这里按 0.5 二值化：每个输出像素完全取自 A 或完全取自 B，绝不混合，
        // 因此只要归属正确，结果处处清晰。
        for (let i = 0; i < maskWeights.length; i += 1) {
            maskWeights[i] = maskWeights[i] >= 0.5 ? 1 : 0;
        }

        await nextFrame();

        // --- 全分辨率深度叠加：每像素取更清晰那张的原始像素 ---
        reportProgress(onProgress, 78, "生成结果与掩膜");
        const outputSize = outputWidth * outputHeight;
        const rOut = new Float32Array(outputSize);
        const gOut = new Float32Array(outputSize);
        const bOut = new Float32Array(outputSize);
        for (let i = 0; i < outputSize; i += 1) {
            const w = maskWeights[i];
            const iw = 1 - w;
            rOut[i] = imageA.r[i] * iw + imageB.r[i] * w;
            gOut[i] = imageA.g[i] * iw + imageB.g[i] * w;
            bOut[i] = imageA.b[i] * iw + imageB.b[i] * w;
        }
        const resultCanvas = channelsToCanvas(
            rOut,
            gOut,
            bOut,
            outputWidth,
            outputHeight
        );

        const maskPreviewCanvas = maskToCanvas(
            maskWeights,
            outputWidth,
            outputHeight
        );
        const winnerOverlayCanvas = winnerOverlayToCanvas(
            maskWeights,
            outputWidth,
            outputHeight
        );

        // 清晰度可视化：处理分辨率下各自的梯度能量。
        const sharpRawA = computeLaplacianMap(imageA.lum, outputWidth, outputHeight);
        const sharpRawB = computeLaplacianMap(imageB.lum, outputWidth, outputHeight);
        const sharpnessACanvas = normalizeMapToCanvas(
            normalizeScoreMap(
                boxBlurMap(sharpRawA, outputWidth, outputHeight, Math.max(1, options.smoothRadius))
            ),
            outputWidth,
            outputHeight
        );
        const sharpnessBCanvas = normalizeMapToCanvas(
            normalizeScoreMap(
                boxBlurMap(sharpRawB, outputWidth, outputHeight, Math.max(1, options.smoothRadius))
            ),
            outputWidth,
            outputHeight
        );

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
