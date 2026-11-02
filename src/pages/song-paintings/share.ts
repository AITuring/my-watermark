import type { Catalog } from "./model";
import { buildReadingStats, type StatGroup } from "./statistics";

export interface ShareImageOptions {
    /** An optional public HTTPS address. Local development addresses are omitted. */
    productionUrl?: string;
    /** Uses the viewer's local calendar date by default. */
    date?: Date;
    /** Identifies the progress snapshot being shared, without fixing its owner. */
    profileLabel?: string;
}

const WIDTH = 1200;
const HEIGHT = 1600;
const PAPER = "#f6f3ec";
const INK = "#263a31";
const GREEN = "#315a47";
const RUST = "#9e5138";
const MUTED = "#69736a";
const RULE = "#d7d9cd";
const TRACK = "#e2e5da";
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
const SANS = '"PingFang SC", "Hiragino Sans GB", sans-serif';

function percentage(value: number): string {
    const bounded = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    return `${Number(bounded.toFixed(1))}%`;
}

function publicAddress(value?: string): string | null {
    if (!value) return null;
    try {
        const address = new URL(value);
        const host = address.hostname.toLowerCase();
        if (address.protocol !== "https:" || address.username || address.password) return null;
        if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
        if (/^(?:127|10|0)\./u.test(host) || /^192\.168\./u.test(host) || /^169\.254\./u.test(host)) return null;
        const private172 = /^172\.(\d+)\./u.exec(host);
        if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
        // A short public address is enough for a poster; never expose query credentials.
        return `${host}${address.pathname === "/" ? "" : address.pathname}`;
    } catch {
        return null;
    }
}

function localDate(value: Date): string {
    return `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日`;
}

async function waitForFonts(): Promise<void> {
    try {
        if (!document.fonts) return;
        await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(resolve, 1200);
            void document.fonts.ready.then(() => {
                window.clearTimeout(timeout);
                resolve();
            }, () => {
                window.clearTimeout(timeout);
                resolve();
            });
        });
    } catch {
        // Local serif/sans-serif fallbacks remain usable when font loading is unavailable.
    }
}

/** Create a standalone reading-progress poster; this function never publishes it. */
export async function createShareImage(catalog: Catalog, options: ShareImageOptions = {}): Promise<Blob> {
    if (typeof document === "undefined") throw new Error("请在浏览器中生成分享图片。");
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法生成图片，请更换浏览器后重试。");
    await waitForFonts();

    const stats = buildReadingStats(catalog.artworks);
    const date = options.date && Number.isFinite(options.date.getTime()) ? options.date : new Date();
    const address = publicAddress(options.productionUrl);

    const text = (value: string, x: number, y: number, size = 24, color = INK, family = SANS, align: CanvasTextAlign = "left", weight = "400") => {
        context.fillStyle = color;
        context.font = `${weight} ${size}px ${family}`;
        context.textAlign = align;
        context.textBaseline = "alphabetic";
        context.fillText(value, x, y);
    };
    const fittedText = (value: string, x: number, y: number, maxWidth: number, size = 24, color = INK, family = SANS, align: CanvasTextAlign = "left", weight = "400") => {
        context.font = `${weight} ${size}px ${family}`;
        let result = value;
        if (context.measureText(result).width > maxWidth) {
            const characters = Array.from(value);
            while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) characters.pop();
            result = `${characters.join("")}…`;
        }
        text(result, x, y, size, color, family, align, weight);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, color = RULE, width = 1) => {
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.strokeStyle = color;
        context.lineWidth = width;
        context.stroke();
    };
    const progress = (x: number, y: number, width: number, percent: number, height = 8, color = GREEN) => {
        context.fillStyle = TRACK;
        context.fillRect(x, y, width, height);
        const amount = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
        if (amount > 0) {
            context.fillStyle = color;
            context.fillRect(x, y, width * amount / 100, height);
        }
    };

    context.fillStyle = PAPER;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    // Quiet page furniture, inspired by the margins and rules of a catalogue.
    context.fillStyle = GREEN;
    context.fillRect(0, 0, 16, HEIGHT);
    fittedText(options.profileLabel?.trim() || "我的宋画阅读", 80, 92, 640, 23, GREEN);
    text(localDate(date), 1120, 92, 21, MUTED, SANS, "right");
    line(80, 120, 1120, 120);

    text("宋画全集", 76, 235, 88, INK, SERIF, "left", "600");
    text("一幅一幅读，一页一页记。", 81, 288, 25, MUTED, SERIF);
    context.strokeStyle = RUST;
    context.lineWidth = 2;
    context.strokeRect(1055, 167, 61, 113);
    text("读", 1086, 213, 35, RUST, SERIF, "center");
    text("画", 1086, 260, 35, RUST, SERIF, "center");

    text("已读作品", 80, 361, 23, MUTED);
    const readText = stats.read.toLocaleString("zh-CN");
    context.font = `500 112px ${SANS}`;
    const countSize = context.measureText(readText).width > 560 ? 82 : 112;
    fittedText(readText, 73, 475, 570, countSize, GREEN, SANS, "left", "500");
    text(`共 ${stats.total.toLocaleString("zh-CN")} 件作品`, 82, 521, 25, MUTED);
    text("完成率", 1118, 367, 22, MUTED, SANS, "right");
    text(percentage(stats.percent), 1120, 451, 61, GREEN, SANS, "right", "500");
    progress(80, 552, 1040, stats.percent, 10);
    const readVolumes = stats.volumes.filter((group) => group.read > 0).length;
    const readBooks = stats.books.filter((group) => group.read > 0).length;
    const invitation = stats.total === 0
        ? "目录暂时为空，收录作品后即可开始记录。"
        : stats.read === 0
            ? "从第一幅画开始，让每次翻阅都有迹可循。"
            : stats.read === stats.total
                ? `已读完目录中的全部 ${stats.total.toLocaleString("zh-CN")} 件作品。`
                : `阅读足迹已遍及 ${readVolumes} 卷、${readBooks} 册。`;
    fittedText(invitation, 80, 605, 1040, 25, INK, SERIF);

    text("国内与海外", 80, 683, 29, INK, SERIF, "left", "600");
    const drawEdition = (group: StatGroup, y: number, color: string) => {
        fittedText(group.label, 80, y, 200, 25, INK);
        progress(292, y - 13, 561, group.percent, 8, color);
        text(`${group.read} / ${group.total}`, 1120, y, 25, MUTED, SANS, "right");
    };
    stats.editions.forEach((group, index) => drawEdition(group, 740 + index * 63, index === 0 ? GREEN : RUST));

    line(80, 851, 1120, 851);
    text("循卷而读", 80, 903, 29, INK, SERIF, "left", "600");
    text(`${stats.volumes.length} 卷 · ${stats.books.length} 册`, 1120, 903, 21, MUTED, SANS, "right");
    const volumeRows = Math.max(1, Math.ceil(stats.volumes.length / 2));
    const volumeGap = Math.min(79, 305 / volumeRows);
    stats.volumes.forEach((group, index) => {
        const x = index % 2 === 0 ? 80 : 650;
        const y = 963 + Math.floor(index / 2) * volumeGap;
        fittedText(group.label, x, y, 220, 23, INK, SERIF);
        text(`${group.read} / ${group.total}`, x + 470, y, 21, MUTED, SANS, "right");
        progress(x, y + 18, 470, group.percent, 6);
    });

    line(80, 1279, 1120, 1279);
    const artistCoverage = stats.artists.filter((group) => group.read > 0).length;
    const collectionCoverage = stats.collections.filter((group) => group.read > 0).length;
    const coverage = (label: string, count: number, total: number, x: number) => {
        text(label, x, 1324, 22, MUTED);
        const countString = String(count);
        text(countString, x - 2, 1391, 52, GREEN, SANS, "left", "500");
        context.font = `500 52px ${SANS}`;
        const offset = context.measureText(countString).width;
        fittedText(`/ ${total} 项`, x + offset + 13, 1388, 270, 24, MUTED);
    };
    coverage("已读作者条目覆盖", artistCoverage, stats.artists.length, 80);
    coverage("已读馆藏条目覆盖", collectionCoverage, stats.collections.length, 650);
    text("按目录中的作者、馆藏名称计", 80, 1432, 19, MUTED);

    line(80, 1474, 1120, 1474);
    text("笑谈间气吐霓虹 · 宋画全集", 80, 1521, 25, GREEN, SERIF);
    text("读画留痕", 1120, 1521, 21, MUTED, SANS, "right");
    if (address) fittedText(address, 80, 1561, 1040, 18, MUTED);

    return new Promise<Blob>((resolve, reject) => {
        try {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("图片生成失败，请重试。"));
            }, "image/png");
        } catch {
            reject(new Error("当前浏览器无法导出 PNG 图片，请重试或更换浏览器。"));
        }
    });
}
