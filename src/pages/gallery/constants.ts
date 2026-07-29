import type { AspectRatio } from "./types";

export const getRandomColor = () => {
    const h = Math.floor(Math.random() * 360);
    const s = Math.floor(Math.random() * 20) + 5;
    const l = Math.floor(Math.random() * 30) + 50;

    const sPct = s / 100;
    const lPct = l / 100;

    const c = (1 - Math.abs(2 * lPct - 1)) * sPct;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lPct - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (0 <= h && h < 60) {
        r = c;
        g = x;
    } else if (60 <= h && h < 120) {
        r = x;
        g = c;
    } else if (120 <= h && h < 180) {
        g = c;
        b = x;
    } else if (180 <= h && h < 240) {
        g = x;
        b = c;
    } else if (240 <= h && h < 300) {
        r = x;
        b = c;
    } else if (300 <= h && h < 360) {
        r = c;
        b = x;
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const aspectRatioOptions: AspectRatio[] = [
    { width: null, height: null, label: "自适应" },
    { width: 1, height: 1, label: "1:1" },
    { width: 4, height: 3, label: "4:3" },
    { width: 3, height: 4, label: "3:4" },
    { width: 16, height: 9, label: "16:9" },
    { width: 9, height: 16, label: "9:16" },
    { width: 2, height: 1, label: "2:1" },
    { width: 1, height: 2, label: "1:2" },
];
