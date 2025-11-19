import { ImageType } from "@/types";
import * as StackBlur from "stackblur-canvas";

// ===== 性能优化：内存管理 =====

// Canvas 池管理器
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
            // 清理canvas
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // 重置canvas状态
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = 1;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            this.pool.push(canvas);
        }
    }

    cleanup(): void {
        this.pool = [];
    }
}

// 内存管理器
class MemoryManager {
    private static instance: MemoryManager;
    private canvasPool: CanvasPool;
    private urlCache = new Set<string>();

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    constructor() {
        this.canvasPool = CanvasPool.getInstance();
    }

    getCanvas(): HTMLCanvasElement {
        return this.canvasPool.getCanvas();
    }

    releaseCanvas(canvas: HTMLCanvasElement): void {
        this.canvasPool.releaseCanvas(canvas);
    }

    // URL 管理
    createObjectURL(blob: Blob): string {
        const url = URL.createObjectURL(blob);
        this.urlCache.add(url);
        return url;
    }

    revokeObjectURL(url: string): void {
        if (this.urlCache.has(url)) {
            URL.revokeObjectURL(url);
            this.urlCache.delete(url);
        }
    }

    // 清理所有缓存的URL
    cleanup(): void {
        this.urlCache.forEach((url) => URL.revokeObjectURL(url));
        this.urlCache.clear();
        this.canvasPool.cleanup();
    }

    // 获取内存使用情况
    getMemoryInfo(): {
        usedJSHeapSize?: number;
        totalJSHeapSize?: number;
        jsHeapSizeLimit?: number;
    } {
        if ("memory" in performance) {
            return (performance as any).memory;
        }
        return {};
    }
}

// ===== 性能优化：图片缓存 =====

interface CachedImage {
    image: HTMLImageElement;
    timestamp: number;
    size: number;
}

class ImageCache {
    private static instance: ImageCache;
    private cache = new Map<string, CachedImage>();
    private readonly maxSize = 50; // 最大缓存数量
    private readonly maxAge = 30 * 60 * 1000; // 30分钟过期
    private readonly maxMemorySize = 100 * 1024 * 1024; // 100MB内存限制
    private currentMemorySize = 0;

    static getInstance(): ImageCache {
        if (!ImageCache.instance) {
            ImageCache.instance = new ImageCache();
        }
        return ImageCache.instance;
    }

    async getImage(url: string): Promise<HTMLImageElement> {
        // 检查缓存
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.timestamp < this.maxAge) {
            return cached.image;
        }

        // 加载新图片
        const image = await this.loadImage(url);

        // 估算图片内存大小
        const size = this.estimateImageSize(image);

        // 清理过期缓存
        this.cleanupExpired();

        // 如果缓存已满，删除最旧的
        this.ensureCapacity(size);

        // 添加到缓存
        this.cache.set(url, {
            image,
            timestamp: Date.now(),
            size,
        });
        this.currentMemorySize += size;

        return image;
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = url;
        });
    }

    private estimateImageSize(image: HTMLImageElement): number {
        // 估算图片在内存中的大小 (width * height * 4 bytes per pixel)
        return image.width * image.height * 4;
    }

    private cleanupExpired(): void {
        const now = Date.now();
        for (const [url, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.maxAge) {
                this.currentMemorySize -= cached.size;
                this.cache.delete(url);
            }
        }
    }

    private ensureCapacity(newImageSize: number): void {
        // 如果新图片会超出内存限制，清理最旧的缓存
        while (
            (this.cache.size >= this.maxSize ||
                this.currentMemorySize + newImageSize > this.maxMemorySize) &&
            this.cache.size > 0
        ) {
            const oldestEntry = this.getOldestEntry();
            if (oldestEntry) {
                this.currentMemorySize -= oldestEntry.cached.size;
                this.cache.delete(oldestEntry.url);
            }
        }
    }

    private getOldestEntry(): { url: string; cached: CachedImage } | null {
        let oldest: { url: string; cached: CachedImage } | null = null;

        for (const [url, cached] of this.cache.entries()) {
            if (!oldest || cached.timestamp < oldest.cached.timestamp) {
                oldest = { url, cached };
            }
        }

        return oldest;
    }

    clear(): void {
        this.cache.clear();
        this.currentMemorySize = 0;
    }

    getStats(): {
        size: number;
        memorySize: number;
        maxSize: number;
        maxMemorySize: number;
    } {
        return {
            size: this.cache.size,
            memorySize: this.currentMemorySize,
            maxSize: this.maxSize,
            maxMemorySize: this.maxMemorySize,
        };
    }
}

// ===== 性能优化：图片预处理 =====

interface PreprocessedImage {
    thumbnail: string;
    dimensions: { width: number; height: number };
    size: number;
    aspectRatio: number;
}

async function preprocessImage(file: File): Promise<PreprocessedImage> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const image = new Image();
            image.onload = () => {
                const memoryManager = MemoryManager.getInstance();
                const canvas = memoryManager.getCanvas();
                const ctx = canvas.getContext("2d")!;

                try {
                    // 创建缩略图
                    const maxSize = 200;
                    const scale = Math.min(
                        maxSize / image.width,
                        maxSize / image.height
                    );
                    canvas.width = Math.floor(image.width * scale);
                    canvas.height = Math.floor(image.height * scale);

                    // 使用高质量缩放
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "high";
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                    const thumbnail = canvas.toDataURL("image/jpeg", 0.8);

                    resolve({
                        thumbnail,
                        dimensions: {
                            width: image.width,
                            height: image.height,
                        },
                        size: file.size,
                        aspectRatio: image.width / image.height,
                    });
                } catch (error) {
                    reject(error);
                } finally {
                    memoryManager.releaseCanvas(canvas);
                }
            };
            image.onerror = reject;
            image.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== 性能优化：批处理优化 =====

// 任务队列管理器
class TaskQueue {
    private static instance: TaskQueue;
    private queue: Array<() => Promise<any>> = [];
    private running = 0;
    private maxConcurrency: number;

    static getInstance(maxConcurrency = 4): TaskQueue {
        if (!TaskQueue.instance) {
            TaskQueue.instance = new TaskQueue(maxConcurrency);
        }
        return TaskQueue.instance;
    }

    constructor(maxConcurrency = 4) {
        this.maxConcurrency = maxConcurrency;
    }

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.process();
        });
    }

    private async process(): Promise<void> {
        if (this.running >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }

        this.running++;
        const task = this.queue.shift()!;

        try {
            await task();
        } finally {
            this.running--;
            this.process(); // 处理下一个任务
        }
    }

    setMaxConcurrency(max: number): void {
        this.maxConcurrency = max;
    }

    getStats(): { running: number; queued: number; maxConcurrency: number } {
        return {
            running: this.running,
            queued: this.queue.length,
            maxConcurrency: this.maxConcurrency,
        };
    }
}

// ===== 批量处理函数 =====
interface BatchProcessResult {
    url: string;
    name: string;
    success: boolean;
    error?: string;
}

async function processBatchImages(
    imgPositionList: Array<{ id: string; file: File; position: any }>,
    watermarkImage: HTMLImageElement,
    watermarkBlur: boolean,
    quality: number,
    watermarkOpacity: number = 1,
    batchSize = 5,
    globalConcurrency = 10,
    onProgress?: (progress: number) => void
): Promise<BatchProcessResult[]> {
    const taskQueue = TaskQueue.getInstance(globalConcurrency);
    const results: BatchProcessResult[] = [];
    let completedCount = 0;

    // 分批处理
    for (let i = 0; i < imgPositionList.length; i += batchSize) {
        const batch = imgPositionList.slice(i, i + batchSize);

        const batchPromises = batch.map((img, index) =>
            taskQueue.add(async () => {
                try {
                    const { url, name } = await processImage(
                        img.file,
                        watermarkImage,
                        img.position,
                        watermarkBlur,
                        quality,
                        watermarkOpacity,
                        (progress) => {
                            // 单个图片的进度回调
                            const overallProgress =
                                ((completedCount + progress / 100) /
                                    imgPositionList.length) *
                                100;
                            onProgress?.(overallProgress);
                        }
                    );

                    completedCount++;
                    const overallProgress =
                        (completedCount / imgPositionList.length) * 100;
                    onProgress?.(overallProgress);

                    return {
                        url,
                        name,
                        success: true,
                    };
                } catch (error) {
                    completedCount++;
                    const overallProgress =
                        (completedCount / imgPositionList.length) * 100;
                    onProgress?.(overallProgress);

                    return {
                        url: "",
                        name: img.file.name,
                        success: false,
                        error:
                            error instanceof Error ? error.message : "处理失败",
                    };
                }
            })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 批次间的小延时
        if (i + batchSize < imgPositionList.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    return results;
}

function uuid(): string {
    let idStr = Date.now().toString(36);
    idStr += Math.random().toString(36).substr(2);
    return idStr;
}

// 加载图片数据
async function loadImageData(files: File[]): Promise<ImageType[]> {
    // 注意Promise<ImageType>[]和Promise<ImageType[]>
    const promises: Promise<ImageType>[] = files.map(
        (file): Promise<ImageType> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = new Image();
                    img.onload = function () {
                        resolve({
                            id: uuid(),
                            width: img.width,
                            height: img.height,
                            file: file,
                        });
                    };
                    img.onerror = reject;
                    img.src = e.target.result as string;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    );
    return Promise.all(promises);
}

// 计算水印的位置
function calculateWatermarkPosition(
    watermarkImage,
    imageWidth,
    imageHeight,
    position
) {
    // 参数验证
    if (!watermarkImage || !position) {
        throw new Error("缺少必要的参数");
    }

    // 使用与预览一致的尺寸计算：标准10% * 用户缩放（position.scaleX）
    const minDimension = Math.min(imageWidth, imageHeight);
    const standardWatermarkSize = minDimension * 0.1;
    const standardScale = standardWatermarkSize / watermarkImage.width;
    const finalScale = standardScale * (position.scaleX || 1);

    const watermarkWidth = watermarkImage.width * finalScale;
    const watermarkHeight = watermarkImage.height * finalScale;

    // 预览里存的是“左上角坐标按图片宽高的百分比”，这里直接还原为像素
    const relX = Math.max(0, Math.min(1, position.x || 0.5));
    const relY = Math.max(0, Math.min(1, position.y || 0.5));
    let pxX = relX * imageWidth;
    let pxY = relY * imageHeight;

    // 边界约束（与预览一致：不让超出）
    pxX = Math.max(0, Math.min(imageWidth - watermarkWidth, pxX));
    pxY = Math.max(0, Math.min(imageHeight - watermarkHeight, pxY));

    return {
        x: pxX,
        y: pxY,
        width: watermarkWidth,
        height: watermarkHeight,
    };
}

// 防抖
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 图片处理
async function processImage(
    file: File,
    watermarkImage: HTMLImageElement,
    position,
    watermarkBlur: boolean,
    quality: number,
    watermarkOpacity: number = 1,
    onProgress?: (progress: number) => void
): Promise<{ url: string; name: string }> {
    const memoryManager = MemoryManager.getInstance();
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
        // 输入验证
        if (!file || !watermarkImage) {
            reject(new Error("缺少必要的文件或水印图片"));
            return;
        }
        // 不限制大小
        // if (file.size > 50 * 1024 * 1024) {
        //     // 50MB限制
        //     reject(
        //         new Error(
        //             `文件大小超过限制（50MB），当前大小：${(
        //                 file.size /
        //                 1024 /
        //                 1024
        //             ).toFixed(2)}MB`
        //         )
        //     );
        //     return;
        // }

        onProgress?.(10);

        const reader = new FileReader();
        reader.onload = async (e) => {
            onProgress?.(30);

            const image = new Image();
            image.onload = async () => {
                let canvas: HTMLCanvasElement | null = null;
                let tempCanvas: HTMLCanvasElement | null = null;

                try {
                    onProgress?.(50);

                    // 取消检查图片尺寸
                    // if (image.width > 8000 || image.height > 8000) {
                    //     throw new Error(`图片尺寸过大：${image.width}x${image.height}，最大支持8000x8000`);
                    // }

                    // 使用内存池中的canvas
                    canvas = memoryManager.getCanvas();
                    const ctx = canvas.getContext("2d");

                    if (!ctx) {
                        throw new Error("无法创建Canvas上下文");
                    }

                    canvas.width = image.width;
                    canvas.height = image.height;

                    // 绘制原始图片
                    ctx.drawImage(image, 0, 0, image.width, image.height);

                    onProgress?.(60);

                    // 应用水印位置和变换
                    const watermarkPosition = calculateWatermarkPosition(
                        watermarkImage,
                        image.width,
                        image.height,
                        position
                    );
                    const watermarkX = watermarkPosition.x;
                    const watermarkY = watermarkPosition.y;
                    const watermarkWidth = watermarkPosition.width;
                    const watermarkHeight = watermarkPosition.height;

                    onProgress?.(70);

                    if (watermarkBlur) {
                        // 使用另一个canvas处理模糊效果
                        tempCanvas = memoryManager.getCanvas();
                        const tempCtx = tempCanvas.getContext("2d")!;
                        tempCanvas.width = image.width;
                        tempCanvas.height = image.height;
                        tempCtx.drawImage(
                            image,
                            0,
                            0,
                            image.width,
                            image.height
                        );

                        // 应用全图高斯模糊
                        StackBlur.canvasRGBA(
                            tempCanvas,
                            0,
                            0,
                            image.width,
                            image.height,
                            20
                        );

                        // 创建径向渐变
                        const centerX = watermarkX + watermarkWidth / 2;
                        const centerY = watermarkY + watermarkHeight / 2;
                        const innerRadius = 0;
                        const outerRadius = Math.max(
                            watermarkWidth,
                            watermarkHeight
                        );

                        const gradient = ctx.createRadialGradient(
                            centerX,
                            centerY,
                            innerRadius,
                            centerX,
                            centerY,
                            outerRadius
                        );
                        gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
                        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

                        // 应用径向渐变作为蒙版
                        ctx.globalCompositeOperation = "destination-out";
                        ctx.fillStyle = gradient;
                        ctx.fillRect(
                            watermarkX,
                            watermarkY,
                            watermarkWidth,
                            watermarkHeight
                        );

                        // 绘制模糊的背景图片
                        ctx.globalCompositeOperation = "destination-over";
                        ctx.drawImage(tempCanvas, 0, 0);
                    }

                    onProgress?.(80);

                    // 绘制清晰的水印
                    ctx.globalCompositeOperation = "source-over";
                    ctx.save();

                    // 设置水印透明度
                    ctx.globalAlpha = watermarkOpacity;

                    // 添加调试日志
                    console.log('水印绘制参数:', {
                        watermarkOpacity,
                        watermarkX,
                        watermarkY,
                        watermarkWidth,
                        watermarkHeight,
                        imageWidth: canvas.width,
                        imageHeight: canvas.height,
                        position,
                        watermarkImageSize: {
                            width: watermarkImage.width,
                            height: watermarkImage.height
                        }
                    });

                    // 将canvas的原点移动到水印的中心位置
                    ctx.translate(
                        watermarkX + watermarkWidth / 2,
                        watermarkY + watermarkHeight / 2
                    );

                    // 绕原点旋转画布
                    ctx.rotate((position.rotation * Math.PI) / 180);

                    // 绘制水印
                    ctx.drawImage(
                        watermarkImage,
                        -watermarkWidth / 2,
                        -watermarkHeight / 2,
                        watermarkWidth,
                        watermarkHeight
                    );

                    console.log('水印绘制完成');

                    ctx.restore();

                    onProgress?.(90);

                    // 导出最终的图片
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const url = memoryManager.createObjectURL(blob);
                                onProgress?.(100);

                                const endTime = performance.now();
                                console.log(
                                    `处理图片耗时: ${(
                                        endTime - startTime
                                    ).toFixed(2)} ms`
                                );

                                resolve({ url, name: file.name });
                            } else {
                                reject(new Error("图片导出失败"));
                            }
                        },
                        "image/jpeg",
                        quality
                    );
                } catch (error) {
                    reject(error);
                } finally {
                    // 清理资源
                    if (canvas) memoryManager.releaseCanvas(canvas);
                    if (tempCanvas) memoryManager.releaseCanvas(tempCanvas);
                }
            };

            image.onerror = () => {
                reject(new Error("图片加载失败"));
            };

            image.src = e.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error("文件读取失败"));
        };

        reader.readAsDataURL(file);
    });
}

interface ExtendedNavigator extends Navigator {
    deviceMemory?: number; // 可选属性
}

// 获取设备性能信息
function getDevicePerformance(): { cores: number; memory: number } {
    const extendedNavigator = navigator as ExtendedNavigator;
    const cores = navigator.hardwareConcurrency || 4; // CPU 线程数，默认值为 4
    const memory = extendedNavigator.deviceMemory || 4; // 近似内存容量（GB），默认值为 4
    return { cores, memory };
}

// 根据设备性能动态调整批次大小和并发数
function adjustBatchSizeAndConcurrency(images: { file: File }[]): {
    batchSize: number;
    globalConcurrency: number;
} {
    const { cores, memory } = getDevicePerformance();

    // 图片文件大小统计
    const totalSize = images.reduce((sum, img) => sum + img.file.size, 0);
    const avgSize = totalSize / images.length / 1024 / 1024; // 平均大小（MB）

    // 动态调整规则
    const batchSize = Math.max(1, Math.min(Math.floor(cores / 2), 5)); // 每批次最多 5 张
    const globalConcurrency = Math.max(
        1,
        Math.min(Math.floor(memory * 2), 10) // 全局并发任务数，内存越多并发数越大
    );

    // 如果图片较大，进一步降低参数
    if (avgSize > 5) {
        return {
            batchSize: Math.max(1, batchSize - 1),
            globalConcurrency: Math.max(1, globalConcurrency - 2),
        };
    }

    return { batchSize, globalConcurrency };
}

// 提取图像的主要颜色
const extractDominantColors = (imageElement, numColors = 5) => {
    // 创建一个临时canvas来处理图像
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // 限制处理尺寸，提高性能
    const maxDimension = 100; // 限制最大尺寸为100px
    const scale = Math.min(
        1,
        maxDimension / Math.max(imageElement.width, imageElement.height)
    );
    const width = Math.floor(imageElement.width * scale);
    const height = Math.floor(imageElement.height * scale);

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imageElement, 0, 0, width, height);

    // 获取图像数据
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // 使用Map代替对象，提高性能
    const colorCounts = new Map();
    // 量化步长，可以调整以平衡精度和性能
    const quantizeStep = 32;

    // 分析每个像素
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // 忽略透明像素
        if (a < 128) continue;

        // 简化颜色值以减少唯一颜色数量（量化）
        const quantizedR = Math.round(r / quantizeStep) * quantizeStep;
        const quantizedG = Math.round(g / quantizeStep) * quantizeStep;
        const quantizedB = Math.round(b / quantizeStep) * quantizeStep;

        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
    }

    // 计算亮度的辅助函数
    const calculateBrightness = (r, g, b) =>
        (r * 299 + g * 587 + b * 114) / 1000;

    // 转换为数组并排序
    const colorEntries = Array.from(colorCounts.entries()).map(
        ([color, count]) => {
            const [r, g, b] = color.split(",").map(Number);
            return {
                color: `rgb(${r}, ${g}, ${b})`,
                count,
                r,
                g,
                b,
                brightness: calculateBrightness(r, g, b),
            };
        }
    );

    // 按出现频率排序
    colorEntries.sort((a, b) => b.count - a.count);

    // 确保颜色多样性 - 选择亮度差异较大的颜色
    const result = [];
    const brightnessThreshold = 50; // 亮度差异阈值

    // 优先选择出现频率最高的颜色
    if (colorEntries.length > 0) {
        result.push(colorEntries[0]);
    }

    // 然后选择与已选颜色有足够亮度差异的颜色
    for (let i = 1; i < colorEntries.length && result.length < numColors; i++) {
        const entry = colorEntries[i];

        // 检查这个颜色是否与已选颜色有足够的亮度差异
        const isDifferentEnough = result.every(
            (selectedColor) =>
                Math.abs(selectedColor.brightness - entry.brightness) >
                brightnessThreshold
        );

        if (isDifferentEnough) {
            result.push(entry);
        }
    }

    // 如果没有足够的颜色满足亮度差异要求，添加剩余的颜色
    if (result.length < numColors) {
        for (
            let i = 0;
            i < colorEntries.length && result.length < numColors;
            i++
        ) {
            if (!result.includes(colorEntries[i])) {
                result.push(colorEntries[i]);
            }
        }
    }

    return result;
};

// 将十六进制颜色转换为RGB数组
function hexToRgb(hex) {
    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return rgb
        ? [parseInt(rgb[1], 16), parseInt(rgb[2], 16), parseInt(rgb[3], 16)]
        : null;
}

// 创建渐变对象
function createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// 解析颜色字符串为RGB数组
function parseColor(color) {
    // 处理十六进制颜色
    if (color.startsWith("#")) {
        return hexToRgb(color);
    }

    // 处理RGB格式颜色
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return [
            parseInt(rgbMatch[1]),
            parseInt(rgbMatch[2]),
            parseInt(rgbMatch[3]),
        ];
    }

    // 默认返回黑色
    return [0, 0, 0];
}

// 应用颜色到水印
async function applyColorToWatermark(watermarkUrl, color) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "Anonymous"; // 确保跨域支持
        image.onload = () => {
            // 创建canvas元素
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = image.width;
            canvas.height = image.height;

            // 绘制原始图片
            ctx.drawImage(image, 0, 0);

            let colorOrGradient;

            // 判断颜色类型（单色或渐变色）
            if (typeof color === "string") {
                // 单色情况 - 使用parseColor函数处理不同格式的颜色
                colorOrGradient = parseColor(color);
            } else if (Array.isArray(color) && color.length === 2) {
                // 渐变色情况
                colorOrGradient = createGradient(ctx, color[0], color[1]);
            } else {
                console.error("不支持的颜色格式:", color);
                // 默认使用黑色
                colorOrGradient = [0, 0, 0];
            }

            // 如果是渐变色，设置 fillStyle 并填充矩形
            if (colorOrGradient instanceof CanvasGradient) {
                ctx.fillStyle = colorOrGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 获取图像数据
            const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );
            const data = imageData.data;

            // 修改非透明像素的颜色
            for (let i = 0; i < data.length; i += 4) {
                // 如果像素不是完全透明
                if (data[i + 3] > 0) {
                    if (!(colorOrGradient instanceof CanvasGradient)) {
                        data[i] = colorOrGradient[0]; // R
                        data[i + 1] = colorOrGradient[1]; // G
                        data[i + 2] = colorOrGradient[2]; // B
                        // Alpha保持不变
                    }
                }
            }

            // 将修改后的数据放回canvas
            ctx.putImageData(imageData, 0, 0);

            // 转换为DataURL并返回
            const dataURL = canvas.toDataURL("image/png");
            resolve(dataURL);
        };
        image.onerror = (e) => {
            console.error("加载水印图片失败:", e);
            reject(new Error("加载水印图片失败"));
        };
        image.src = watermarkUrl;
    });
}

export {
    uuid,
    loadImageData,
    calculateWatermarkPosition,
    debounce,
    processImage,
    adjustBatchSizeAndConcurrency,
    extractDominantColors,
    applyColorToWatermark,
};
