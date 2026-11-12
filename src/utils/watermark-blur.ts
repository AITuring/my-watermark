import * as StackBlur from 'stackblur-canvas';

export const WATERMARK_BLUR_RADIUS = 20;

export function createBlurredWatermarkBackground(
    source: CanvasImageSource, width: number, height: number, radius = WATERMARK_BLUR_RADIUS,
) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建模糊预览');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    StackBlur.canvasRGBA(canvas, 0, 0, canvas.width, canvas.height, Math.max(1, Math.round(radius)));
    return canvas;
}

/** The same feathered rectangle is used by preview and browser export. */
export function createWatermarkBlurPatch(
    blurred: HTMLCanvasElement,
    rect: {x: number; y: number; width: number; height: number},
) {
    const width = Math.min(blurred.width, Math.max(1, rect.width));
    const height = Math.min(blurred.height, Math.max(1, rect.height));
    const x = Math.max(0, Math.min(blurred.width - width, rect.x));
    const y = Math.max(0, Math.min(blurred.height - height, rect.y));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法绘制模糊区域');
    context.drawImage(blurred, x, y, width, height, 0, 0, width, height);
    const gradient = context.createRadialGradient(width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height));
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return {canvas, x, y, width, height};
}
