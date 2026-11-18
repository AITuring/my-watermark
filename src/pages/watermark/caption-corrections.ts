import type { MixedWatermarkConfig } from '@/types';

export type CaptionCorrection = Partial<Pick<MixedWatermarkConfig, 'textLine1' | 'textLine2'>>;
export type CaptionCorrectionMap = Record<string, CaptionCorrection>;

const STORAGE_KEY = 'my-watermark-caption-corrections-v1';

function normalizeStem(filename: string) {
    return filename.replace(/\.[^.]+$/, '').trim().toLowerCase()
        .replace(/[－—–−~～]/g, '-')
        .replace(/(?:dsc|img|pxl|_?mg|rimg|dcim|dji)[-_ ]?[a-z0-9_-]*$/i, '{photo}')
        .replace(/(?:未标题|未命名|无标题|副本|拷贝)(?:[-_ ]?\d+)?$/u, '{photo}')
        .replace(/[-_ ]+\d+(?:[-_ ]+\d+)*$/u, '{photo}')
        .replace(/[-_ ]+/g, '-');
}

export function getCaptionCorrectionKeys(filename: string) {
    const exact = filename.replace(/\.[^.]+$/, '').trim().toLowerCase();
    const normalized = normalizeStem(filename);
    return exact === normalized ? [exact] : [exact, normalized];
}

export function getCaptionCorrection(map: CaptionCorrectionMap, filename: string) {
    return getCaptionCorrectionKeys(filename).reduce<CaptionCorrection | undefined>(
        (found, key) => found || map[key], undefined,
    );
}

export function setCaptionCorrection(map: CaptionCorrectionMap, filename: string, patch: CaptionCorrection) {
    const next = {...map};
    for (const key of getCaptionCorrectionKeys(filename)) next[key] = {...next[key], ...patch};
    return next;
}

export function clearCaptionCorrection(map: CaptionCorrectionMap, filename: string) {
    const next = {...map};
    for (const key of getCaptionCorrectionKeys(filename)) delete next[key];
    return next;
}

export function loadCaptionCorrections(): CaptionCorrectionMap {
    if (typeof window === 'undefined') return {};
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        if (!value) return {};
        const parsed = JSON.parse(value) as CaptionCorrectionMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
}

export function saveCaptionCorrections(map: CaptionCorrectionMap) {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* storage is optional */ }
}
