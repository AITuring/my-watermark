import { WatermarkPosition } from "@/types";
import { getAdaptiveWatermarkRenderMetrics } from "@/utils/watermark-editor";

const ANALYSIS_SIZE = 240;

export function findSmartWatermarkPosition(
    photo: HTMLImageElement,
    watermark: HTMLImageElement,
    id: string,
    scale: number,
    originalWidth = photo.naturalWidth,
    originalHeight = photo.naturalHeight
): WatermarkPosition {
    const width = photo.naturalWidth;
    const height = photo.naturalHeight;
    const metrics = getAdaptiveWatermarkRenderMetrics(originalWidth, originalHeight, watermark, scale);
    const canvas = document.createElement("canvas");
    const factor = Math.min(1, ANALYSIS_SIZE / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * factor));
    canvas.height = Math.max(1, Math.round(height * factor));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法分析图片位置");
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; i++) {
        const p = i * 4;
        gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    const stride = w + 1;
    const detail = new Float64Array(stride * (h + 1));
    for (let y = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const p = i * 4;
            const contrast = Math.abs(gray[i] - gray[y * w + Math.max(0, x - 1)])
                + Math.abs(gray[i] - gray[Math.max(0, y - 1) * w + x]);
            const saturation = Math.max(data[p], data[p + 1], data[p + 2])
                - Math.min(data[p], data[p + 1], data[p + 2]);
            row += contrast + saturation * 0.12;
            detail[(y + 1) * stride + x + 1] = detail[y * stride + x + 1] + row;
        }
    }

    const boxW = Math.min(w, Math.max(1, Math.ceil(metrics.width * w / originalWidth)));
    const boxH = Math.min(h, Math.max(1, Math.ceil(metrics.height * h / originalHeight)));
    const marginX = Math.min(Math.round(w * 0.015), Math.max(0, (w - boxW) >> 1));
    const marginY = Math.min(Math.round(h * 0.015), Math.max(0, (h - boxH) >> 1));
    const maxX = Math.max(marginX, w - boxW - marginX);
    const maxY = Math.max(marginY, h - boxH - marginY);
    const step = Math.max(2, Math.round(Math.min(w, h) / 32));
    let bestX = marginX;
    let bestY = marginY;
    let bestScore = Infinity;
    for (let y = marginY; y <= maxY; y += step) {
        for (let x = marginX; x <= maxX; x += step) {
            const x2 = x + boxW;
            const y2 = y + boxH;
            const energy = detail[y2 * stride + x2] - detail[y * stride + x2]
                - detail[y2 * stride + x] + detail[y * stride + x];
            const centerX = (x + boxW / 2) / w;
            const centerY = (y + boxH / 2) / h;
            const centerPenalty = Math.max(0, 1 - Math.hypot(centerX - 0.5, centerY - 0.5) * 1.4);
            const score = energy / (boxW * boxH) + centerPenalty * 18;
            if (score < bestScore) {
                bestScore = score;
                bestX = x;
                bestY = y;
            }
        }
    }

    return {
        id,
        x: bestX / w,
        y: bestY / h,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
    };
}

export function loadPositionImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("图片加载失败"));
        image.src = url;
    });
}
