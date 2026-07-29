const WATERMARK_BASE_RATIO = 0.1;
const WATERMARK_MIN_SIZE = 80;
const WATERMARK_MAX_RATIO = 0.18;

interface ImageBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

const watermarkBoundsCache = new WeakMap<HTMLImageElement, ImageBounds>();

export function getImageOpaqueBounds(image: HTMLImageElement): ImageBounds {
    const cachedBounds = watermarkBoundsCache.get(image);
    if (cachedBounds) {
        return cachedBounds;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return { x: 0, y: 0, width: image.width, height: image.height };
    }

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha <= 8) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    const bounds =
        maxX >= minX && maxY >= minY
            ? {
                  x: minX,
                  y: minY,
                  width: maxX - minX + 1,
                  height: maxY - minY + 1,
              }
            : { x: 0, y: 0, width: image.width, height: image.height };

    watermarkBoundsCache.set(image, bounds);
    return bounds;
}

function getAdaptiveWatermarkTargetSize(
    imageWidth: number,
    imageHeight: number
): number {
    const minDimension = Math.min(imageWidth, imageHeight);
    const preferredSize = minDimension * WATERMARK_BASE_RATIO;
    const cappedMinSize = Math.min(
        WATERMARK_MIN_SIZE,
        minDimension * WATERMARK_MAX_RATIO
    );
    return Math.min(
        Math.max(preferredSize, cappedMinSize),
        minDimension * WATERMARK_MAX_RATIO
    );
}

export function getAdaptiveWatermarkBaseScale(
    imageWidth: number,
    imageHeight: number,
    watermarkWidth: number
): number {
    if (!watermarkWidth) {
        return 1;
    }

    return getAdaptiveWatermarkTargetSize(imageWidth, imageHeight) / watermarkWidth;
}

export function getAdaptiveWatermarkRenderMetrics(
    imageWidth: number,
    imageHeight: number,
    watermarkImage: HTMLImageElement,
    scale = 1
): ImageBounds {
    const contentBounds = getImageOpaqueBounds(watermarkImage);
    const standardScale = getAdaptiveWatermarkBaseScale(
        imageWidth,
        imageHeight,
        contentBounds.width
    );
    const finalScale = standardScale * scale;

    return {
        ...contentBounds,
        width: contentBounds.width * finalScale,
        height: contentBounds.height * finalScale,
    };
}

interface DominantColor {
    color: string;
    count: number;
    r: number;
    g: number;
    b: number;
    brightness: number;
}

export const extractDominantColors = (
    imageElement: HTMLImageElement,
    numColors = 5
): DominantColor[] => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const maxDimension = 100;
    const scale = Math.min(
        1,
        maxDimension / Math.max(imageElement.width, imageElement.height)
    );
    const width = Math.floor(imageElement.width * scale);
    const height = Math.floor(imageElement.height * scale);

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imageElement, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const colorCounts = new Map<string, number>();
    const quantizeStep = 32;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a < 128) continue;

        const quantizedR = Math.round(r / quantizeStep) * quantizeStep;
        const quantizedG = Math.round(g / quantizeStep) * quantizeStep;
        const quantizedB = Math.round(b / quantizeStep) * quantizeStep;
        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
    }

    const calculateBrightness = (r: number, g: number, b: number) =>
        (r * 299 + g * 587 + b * 114) / 1000;

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

    colorEntries.sort((a, b) => b.count - a.count);

    const result: DominantColor[] = [];
    const brightnessThreshold = 50;

    if (colorEntries.length > 0) {
        result.push(colorEntries[0]);
    }

    for (let i = 1; i < colorEntries.length && result.length < numColors; i++) {
        const entry = colorEntries[i];
        const isDifferentEnough = result.every(
            (selectedColor) =>
                Math.abs(selectedColor.brightness - entry.brightness) >
                brightnessThreshold
        );

        if (isDifferentEnough) {
            result.push(entry);
        }
    }

    if (result.length < numColors) {
        for (let i = 0; i < colorEntries.length && result.length < numColors; i++) {
            if (!result.includes(colorEntries[i])) {
                result.push(colorEntries[i]);
            }
        }
    }

    return result;
};

function hexToRgb(hex: string): [number, number, number] | null {
    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return rgb
        ? [
              parseInt(rgb[1], 16),
              parseInt(rgb[2], 16),
              parseInt(rgb[3], 16),
          ]
        : null;
}

function createGradient(
    ctx: CanvasRenderingContext2D,
    color1: string,
    color2: string
) {
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

function parseColor(color: string): [number, number, number] {
    if (color.startsWith("#")) {
        return hexToRgb(color) || [0, 0, 0];
    }

    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return [
            parseInt(rgbMatch[1], 10),
            parseInt(rgbMatch[2], 10),
            parseInt(rgbMatch[3], 10),
        ];
    }

    return [0, 0, 0];
}

export async function applyColorToWatermark(
    watermarkUrl: string,
    color: string | [string, string]
): Promise<string> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "Anonymous";
        image.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("无法创建画布"));
                return;
            }

            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);

            let colorOrGradient: CanvasGradient | [number, number, number];
            if (typeof color === "string") {
                colorOrGradient = parseColor(color);
            } else if (Array.isArray(color) && color.length === 2) {
                colorOrGradient = createGradient(ctx, color[0], color[1]);
            } else {
                colorOrGradient = [0, 0, 0];
            }

            if (colorOrGradient instanceof CanvasGradient) {
                ctx.fillStyle = colorOrGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0 && !(colorOrGradient instanceof CanvasGradient)) {
                    data[i] = colorOrGradient[0];
                    data[i + 1] = colorOrGradient[1];
                    data[i + 2] = colorOrGradient[2];
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        image.onerror = () => reject(new Error("加载水印图片失败"));
        image.src = watermarkUrl;
    });
}
