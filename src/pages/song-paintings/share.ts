import type { Catalog } from "./model";
import { buildShareData, collapseShareGroups, type ShareScope } from "./shareData";
import { createShareQr } from "./shareQr";
import { SONG_SHARE_URL } from "./shareUrl";
import { SHARE_THEME } from "./shareTheme";

export interface ShareImageOptions {
    date?: Date;
    scope?: ShareScope;
}

const WIDTH = 1200;
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
// Lining figures stay the same height and share a baseline, including fractions.
const SANS = '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
const percentage = (value: number) => `${Number(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)).toFixed(1))}%`;
const number = (value: number) => value.toLocaleString("zh-CN");

async function waitForFonts(): Promise<void> {
    if (!document.fonts) return;
    await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 1200);
        void document.fonts.ready.then(() => { window.clearTimeout(timeout); resolve(); }, () => { window.clearTimeout(timeout); resolve(); });
    });
}

/** A local, fixed snapshot. Only the selected edition affects the statistics. */
export async function createShareImage(catalog: Catalog, options: ShareImageOptions = {}): Promise<Blob> {
    if (typeof document === "undefined") throw new Error("请在浏览器中生成分享图片。");
    const data = buildShareData(catalog.artworks, options.scope);
    const { stats } = data;
    const editionBand = data.editionProgress.length > 1 ? 80 : 0;
    const HEIGHT = 1240 + editionBand;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法生成图片，请更换浏览器后重试。");
    const { paper, ink, accent, cinnabar, gold, jade, muted, rule, track } = SHARE_THEME;
    const palette = [accent, cinnabar, gold, jade];
    const [, qr] = await Promise.all([waitForFonts(), createShareQr(SONG_SHARE_URL, ink)]);
    const date = options.date && Number.isFinite(options.date.getTime()) ? options.date : new Date();
    // Align the visible marks, not the QR canvas's transparent padding.
    const graphicSize = qr.canvas.width - qr.padding * 2;
    const graphicsTop = 910 + editionBand;
    const qrX = 1104 - graphicSize - qr.padding, qrY = graphicsTop - qr.padding;

    const text = (value: string, x: number, y: number, size = 24, color: string = ink, family = SANS, align: CanvasTextAlign = "left", weight = "400") => {
        context.fillStyle = color;
        context.font = `${weight} ${size}px ${family}`;
        context.textAlign = align;
        context.textBaseline = "alphabetic";
        context.fillText(value, x, y);
    };
    const fitted = (value: string, x: number, y: number, maxWidth: number, size = 24, color: string = ink, family = SANS) => {
        context.font = `400 ${size}px ${family}`;
        let result = value;
        const characters = Array.from(value);
        while (characters.length && context.measureText(result).width > maxWidth) { characters.pop(); result = `${characters.join("")}…`; }
        text(result, x, y, size, color, family);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, color: string, width: number) => {
        context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2);
        context.strokeStyle = color; context.lineWidth = width; context.stroke();
    };

    context.fillStyle = paper; context.fillRect(0, 0, WIDTH, HEIGHT);
    let seed = 31;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    context.save(); context.fillStyle = gold;
    for (let index = 0; index < 2600; index += 1) {
        const x = random() * WIDTH, y = random() * HEIGHT;
        if (x > qrX - 14 && x < qrX + qr.canvas.width + 14 && y > qrY - 14 && y < qrY + qr.canvas.height + 14) continue;
        context.globalAlpha = .025 + random() * .035;
        context.fillRect(x, y, index % 4 === 0 ? 2 + random() * 5 : .7, .6);
    }
    context.restore();
    context.strokeStyle = rule; context.lineWidth = 1;
    context.strokeRect(44.5, 44.5, WIDTH - 89, HEIGHT - 89);

    text("宋画全集 · 观画记录", 96, 132, 56, ink, SERIF, "left", "600");
    const formattedDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    text(`${data.scopeLabel} · ${formattedDate}`, 99, 180, 23, muted);

    text("已看作品", 99, 266, 24, muted);
    text(number(stats.read), 94, 352, 84, accent, SANS, "left", "500");
    const readWidth = context.measureText(number(stats.read)).width;
    text(`/ ${number(stats.total)} 件`, 110 + readWidth, 352, 27, muted);
    text("馆藏覆盖", 718, 266, 23, muted, SANS, "center");
    text(`${data.collectionCoverage.read} / ${data.collectionCoverage.total}`, 718, 334, 38, accent, SANS, "center", "500");
    const centerX = 1030, centerY = 303, radius = 65;
    context.lineWidth = 8; context.strokeStyle = track;
    context.beginPath(); context.arc(centerX, centerY, radius, 0, Math.PI * 2); context.stroke();
    if (stats.percent > 0) {
        context.strokeStyle = accent;
        context.beginPath(); context.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * stats.percent / 100); context.stroke();
    }
    text(percentage(stats.percent), centerX, 306, 31, accent, SANS, "center", "500");
    text("完成率", centerX, 339, 20, muted, SANS, "center");

    // Only the combined scope needs an edition comparison; single editions stay compact.
    if (editionBand) data.editionProgress.forEach((group, index) => {
        const x = index === 0 ? 96 : 650, width = 454;
        const color = group.id === "domestic" ? accent : cinnabar;
        text(group.label, x, 414, 23, ink, SERIF);
        text(`${group.read} / ${group.total}`, x + width, 414, 23, color, SANS, "right");
        context.fillStyle = track; context.fillRect(x, 436, width, 7);
        context.fillStyle = color; context.fillRect(x, 436, width * group.percent / 100, 7);
    });

    const sectionY = 450 + editionBand;
    text(data.collections.length > 6 ? "馆藏足迹 · 前六" : "馆藏足迹", 96, sectionY, 30, ink, SERIF, "left", "600");
    text("已看 / 收录", 1104, sectionY, 22, muted, SANS, "right");
    const shown = data.collections.slice(0, 6);
    const axisStart = 560, axisEnd = 950;
    shown.forEach((group, index) => {
        const y = sectionY + 62 + index * 52;
        fitted(group.label, 96, y + 8, 426, 26, ink, SERIF);
        text(`${group.read} / ${group.total}`, 1104, y + 8, 25, group.read > 0 ? accent : muted, SANS, "right");
        line(axisStart, y, axisEnd, y, track, 2);
        const end = axisStart + (axisEnd - axisStart) * group.percent / 100;
        if (group.read > 0) line(axisStart, y, end, y, accent, 3);
        context.beginPath(); context.arc(end, y, 4, 0, Math.PI * 2); context.fillStyle = group.read > 0 ? accent : rule; context.fill();
    });
    if (!shown.length) text("暂无馆藏记录", 96, sectionY + 95, 24, muted);

    text("已看作品年代", 96, graphicsTop - 54, 30, ink, SERIF, "left", "600");
    const periods = collapseShareGroups([...stats.periods].filter((group) => group.read > 0).sort((a, b) => b.read - a.read || b.total - a.total), 3, "其他年代");
    const gap = 3;
    const step = (graphicSize + gap) / 10;
    const cellSize = step - gap;
    for (let cell = 0; cell < 100; cell++) {
        const x = 96 + cell % 10 * step, y = graphicsTop + Math.floor(cell / 10) * step;
        context.fillStyle = track; context.fillRect(x, y, cellSize, cellSize);
        let start = 0;
        periods.forEach((group, index) => {
            const end = start + group.read / stats.read * 100;
            const from = Math.max(cell, start), to = Math.min(cell + 1, end);
            if (to > from) { context.fillStyle = palette[index]; context.fillRect(x + (from - cell) * cellSize, y, (to - from) * cellSize, cellSize); }
            start = end;
        });
    }
    const legendStart = graphicsTop + (graphicSize - Math.max(0, periods.length - 1) * 44) / 2 + 8;
    periods.forEach((group, index) => {
        const y = legendStart + index * 44;
        context.fillStyle = palette[index]; context.fillRect(351, y - 14, 11, 11);
        fitted(group.label, 382, y, 178, 25, ink, SERIF);
        text(`${group.read} 件 · ${percentage(group.read / stats.read * 100)}`, 795, y, 23, muted, SANS, "right");
    });
    if (!periods.length) text("还没有已看作品", 351, graphicsTop + graphicSize / 2 + 8, 25, muted);

    context.imageSmoothingEnabled = false;
    context.drawImage(qr.canvas, qrX, qrY);
    text("扫码记录看画足迹", qrX + qr.canvas.width / 2, graphicsTop + graphicSize + 46, 22, muted, SANS, "center");

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败，请重试。")), "image/png");
    });
}
