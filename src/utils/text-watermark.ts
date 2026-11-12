import { ensureWatermarkFont } from "@/pages/watermark/fonts/registry";
import { getImageOpaqueBounds } from "@/utils/watermark-editor";
import type { MixedWatermarkConfig } from "@/types";

export interface WatermarkTextRegion {
    field: 'textLine1' | 'textLine2';
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    letterSpacing: number;
}

/** Render at export resolution; preview and batch export share the same layout. */
export async function createTextWatermark(config: MixedWatermarkConfig, onLayout?: (regions: WatermarkTextRegion[]) => void): Promise<string> {
    const lines = [config.textLine1.trim(), config.textLine2.trim()];
    if (!lines.some(Boolean) && (config.textOnly || !config.icon)) return "";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建文字水印");
    let icon: HTMLImageElement | undefined;
    if (!config.textOnly && config.icon) {
        icon = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("水印图标加载失败"));
            image.src = config.icon;
        });
    }
    const families = await Promise.all([
        ensureWatermarkFont(config.fontId,lines[0]),
        ensureWatermarkFont(config.captionFontId,lines[1]),
    ]);
    const sizes = [Math.max(24, config.fontSize * 4), Math.max(24, config.fontSize * 2.6)];
    await Promise.all(sizes.map((size,index) => document.fonts.load(`${size}px ${families[index]}`,lines[index] || "秋")));
    const vertical = config.layout === "vertical";
    const padding = sizes[0] * 0.3;
    const gap = sizes[0] * (config.lineGap ?? 0.25);
    const letterSpacing = sizes[0] * (config.letterSpacing ?? 0);
    const blocks = lines.map((text, index) => {
        const size = sizes[index];
        ctx.font = `${size}px ${families[index]}`;
        const characters = Array.from(text);
        return { text, size, family: families[index], characters, field: index === 0 ? 'textLine1' as const : 'textLine2' as const,
            width: vertical ? size * 1.3 : ctx.measureText(text).width + Math.max(0,characters.length-1) * letterSpacing,
            height: vertical ? characters.length * size * 1.2 + Math.max(0,characters.length-1) * letterSpacing : size * 1.4 };
    }).filter(block => block.text);
    const textWidth = (vertical ? blocks.reduce((sum, b) => sum + b.width, 0) + gap * Math.max(0,blocks.length - 1)
        : Math.max(0,...blocks.map(b => b.width))) + padding * 2;
    const textHeight = (vertical ? Math.max(0,...blocks.map(b => b.height))
        : blocks.reduce((sum, b) => sum + b.height, 0) + gap * Math.max(0,blocks.length - 1)) + padding * 2;
    const iconBounds = icon ? getImageOpaqueBounds(icon) : undefined;
    const iconH = icon ? sizes[0] * 2.2 * (config.iconScale ?? 1) : 0;
    const iconW = icon ? iconH * iconBounds!.width / iconBounds!.height : 0;
    const iconGap = icon ? sizes[0] * 0.4 : 0;
    const width = vertical ? Math.max(textWidth, iconW + padding * 2) : textWidth + iconW + iconGap;
    const height = vertical ? textHeight + iconH + iconGap : Math.max(textHeight, iconH + padding * 2);
    const scale = Math.min(1, 8192 / Math.max(width, height));
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    ctx.scale(scale, scale);
    ctx.fillStyle = config.color;
    if (icon) {
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = Math.ceil(iconW);
        iconCanvas.height = Math.ceil(iconH);
        const iconCtx = iconCanvas.getContext('2d');
        if (!iconCtx) throw new Error('无法绘制水印图标');
        iconCtx.drawImage(icon, iconBounds!.x, iconBounds!.y, iconBounds!.width, iconBounds!.height, 0, 0, iconW, iconH);
        iconCtx.globalCompositeOperation = 'source-in';
        iconCtx.fillStyle = config.color;
        iconCtx.fillRect(0, 0, iconW, iconH);
        ctx.save();
        ctx.drawImage(iconCanvas, vertical ? (width - iconW) / 2 : padding, vertical ? padding : (height - iconH) / 2);
        ctx.restore();
    }
    const textX = vertical ? (width - textWidth) / 2 : iconW + iconGap;
    const textY = vertical ? iconH + iconGap : (height - textHeight) / 2;
    ctx.translate(textX, textY);
    const drawText = (text: string, x: number, y: number) => {
        ctx.fillText(text, x, y);
    };
    ctx.textBaseline = "middle";
    let offset = padding;
    const regions: WatermarkTextRegion[] = [];
    for (const block of blocks) {
        regions.push({field: block.field, x: (textX + (vertical ? offset : padding)) * scale,
            y: (textY + (vertical ? padding : offset)) * scale,
            width: block.width * scale, height: block.height * scale,
            fontSize: block.size * scale, fontFamily: block.family, letterSpacing: letterSpacing * scale});
        ctx.font = `${block.size}px ${block.family}`;
        ctx.textAlign = vertical ? "center" : "left";
        if (vertical) {
            block.characters.forEach((character, index) => {
                drawText(character, offset + block.width / 2,
                    padding + block.size * 0.7 + index * (block.size * 1.2 + letterSpacing));
            });
            offset += block.width + gap;
        } else {
            if (!letterSpacing) drawText(block.text, padding, offset + block.height / 2);
            else {
                let x = padding;
                for (const character of block.characters) {
                    drawText(character,x,offset + block.height / 2);
                    x += ctx.measureText(character).width + letterSpacing;
                }
            }
            offset += block.height + gap;
        }
    }
    onLayout?.(regions);
    return canvas.toDataURL("image/png");
}
