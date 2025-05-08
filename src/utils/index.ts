import { ImageType } from "@/types";
import * as StackBlur from "stackblur-canvas";


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
    // scaleX和scaleY是相等的，用随便一个就行
    const scale = position.scaleX || position.scaleY || 1;
    const watermarkWidth = watermarkImage.width * scale;
    const watermarkHeight = watermarkImage.height * scale;

    // 水印的左上角坐标
    let watermarkX = position.x * imageWidth;
    let watermarkY = position.y * imageHeight;

    // 边缘检测
    // 检查水印是否超出图片的左边界
    if (watermarkX < 0) {
        watermarkX = 4;
    }
    // 检查水印是否超出图片的右边界
    if (watermarkX + watermarkWidth > imageWidth) {
        watermarkX = imageWidth - watermarkWidth - 4;
    }
    // 检查水印是否超出图片的顶边界
    if (watermarkY < 0) {
        watermarkY = 4;
    }
    // 检查水印是否超出图片的底边界
    if (watermarkY + watermarkHeight > imageHeight) {
        watermarkY = imageHeight - watermarkHeight - 4;
    }

    return {
        x: watermarkX,
        y: watermarkY,
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
): Promise<{ url: string; name: string }> {
    const startTime = performance.now();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const image = new Image();
            image.onload = async () => {
                // 创建一个canvas元素
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = image.width;
                canvas.height = image.height;

                // 绘制原始图片
                ctx.drawImage(image, 0, 0, image.width, image.height);

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

                if (watermarkBlur) {
                    // 创建一个临时canvas来应用模糊效果
                    const tempCanvas = document.createElement("canvas");
                    const tempCtx = tempCanvas.getContext("2d");
                    tempCanvas.width = image.width;
                    tempCanvas.height = image.height;
                    tempCtx.drawImage(image, 0, 0, image.width, image.height);

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

                    const innerRadius = 0; // 从中心开始渐变
                    const outerRadius = Math.max(
                        watermarkWidth,
                        watermarkHeight
                    ); // 渐变扩散的半径

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

                // 绘制清晰的水印
                ctx.globalCompositeOperation = "source-over";
                // 保存当前context的状态
                ctx.save();

                // 将canvas的原点移动到水印的中心位置
                ctx.translate(
                    watermarkX + watermarkWidth / 2,
                    watermarkY + watermarkHeight / 2
                );

                // 绕原点旋转画布
                ctx.rotate((position.rotation * Math.PI) / 180); // position.rotation是角度，需要转换为弧度

                // 因为canvas是绕新的原点旋转的，所以你需要将图片绘制在中心的相反位置
                ctx.drawImage(
                    watermarkImage,
                    -watermarkWidth / 2,
                    -watermarkHeight / 2,
                    watermarkWidth,
                    watermarkHeight
                );

                // 恢复canvas状态
                ctx.restore();

                // 导出最终的图片
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            resolve({ url, name: file.name });
                        } else {
                            reject(new Error("Canvas to Blob failed"));
                        }
                    },
                    "image/jpeg",
                    quality
                );
            };
            image.onerror = reject;
            image.src = e.target.result as string;
            const endTime = performance.now();
        console.log(`处理图片耗时: ${endTime - startTime} ms`);
        };
        reader.onerror = reject;
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
function adjustBatchSizeAndConcurrency(
    images: { file: File }[]
): { batchSize: number; globalConcurrency: number } {
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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    // 获取图像数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // 颜色计数对象
    const colorCounts = {};

    // 分析每个像素
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // 忽略透明像素
        if (a < 128) continue;

        // 简化颜色值以减少唯一颜色数量（量化）
        const quantizedR = Math.round(r / 32) * 32;
        const quantizedG = Math.round(g / 32) * 32;
        const quantizedB = Math.round(b / 32) * 32;

        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

        if (colorCounts[colorKey]) {
            colorCounts[colorKey]++;
        } else {
            colorCounts[colorKey] = 1;
        }
    }

    // 转换为数组并排序
    const colorEntries = Object.entries(colorCounts).map(([color, count]) => {
        const [r, g, b] = color.split(',').map(Number);
        return {
            color: `rgb(${r}, ${g}, ${b})`,
            count,
            r, g, b,
            // 计算亮度
            brightness: (r * 299 + g * 587 + b * 114) / 1000
        };
    });

    // 按出现频率排序
    colorEntries.sort((a, b) => (b.count as number) - (a.count as number));

    // 确保颜色多样性 - 选择亮度差异较大的颜色
    const result = [];
    const brightnessThreshold = 50; // 亮度差异阈值

    for (const entry of colorEntries) {
        // 检查这个颜色是否与已选颜色有足够的亮度差异
        const isDifferentEnough = result.every(
            selectedColor => Math.abs(selectedColor.brightness - entry.brightness) > brightnessThreshold
        );

        if (isDifferentEnough) {
            result.push(entry);
        }

        if (result.length >= numColors) break;
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
    if (color.startsWith('#')) {
        return hexToRgb(color);
    }

    // 处理RGB格式颜色
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
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
            if (typeof color === 'string') {
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
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 修改非透明像素的颜色
            for (let i = 0; i < data.length; i += 4) {
                // 如果像素不是完全透明
                if (data[i + 3] > 0) {
                    if (!(colorOrGradient instanceof CanvasGradient)) {
                        data[i] = colorOrGradient[0];     // R
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
