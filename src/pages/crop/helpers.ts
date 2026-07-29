import type { CropBox, CropMode } from "./types";

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const normalizeBox = (box: CropBox): CropBox => {
    const x = Math.min(box.x, box.x + box.w);
    const y = Math.min(box.y, box.y + box.h);
    return { x, y, w: Math.abs(box.w), h: Math.abs(box.h) };
};

export const fitBoxInImage = (box: CropBox, imgW: number, imgH: number): CropBox => {
    const n = normalizeBox(box);
    const w = clamp(n.w, 1, imgW);
    const h = clamp(n.h, 1, imgH);
    const x = clamp(n.x, 0, imgW - w);
    const y = clamp(n.y, 0, imgH - h);
    return { x, y, w, h };
};

export const buildUniqueNames = (existingNames: string[], incomingNames: string[]) => {
    const counts = new Map<string, number>();
    existingNames.forEach((name) => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
    });

    return incomingNames.map((name) => {
        const nextCount = (counts.get(name) ?? 0) + 1;
        counts.set(name, nextCount);
        return nextCount === 1 ? name : `${name}-${nextCount}`;
    });
};

export const sanitizeFileSegment = (value: string) =>
    value.replace(/[\\/:*?"<>|]/g, "-").trim() || "image";

export const createCenteredCrop = (imgW: number, imgH: number, ratio: number): CropBox => {
    const imageRatio = imgW / Math.max(imgH, 1);
    let w = imgW;
    let h = imgH;

    if (imageRatio > ratio) {
        h = imgH;
        w = h * ratio;
    } else {
        w = imgW;
        h = w / ratio;
    }

    const x = (imgW - w) / 2;
    const y = (imgH - h) / 2;
    return { x, y, w, h };
};

export const createCenteredFreeCrop = (imgW: number, imgH: number): CropBox => {
    return { x: 0, y: 0, w: imgW, h: imgH };
};

export const getDefaultCrop = (
    imgW: number,
    imgH: number,
    mode: CropMode,
    ratio: number | null
) => (mode === "free" ? createCenteredFreeCrop(imgW, imgH) : createCenteredCrop(imgW, imgH, ratio ?? 1));

export const buildAspectBox = (
    anchor: { x: number; y: number },
    point: { x: number; y: number },
    ratio: number,
    imgW: number,
    imgH: number
): CropBox => {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    let aw = Math.max(Math.abs(dx), 1);
    let ah = Math.max(Math.abs(dy), 1);

    if (aw / Math.max(ah, 1e-6) > ratio) {
        ah = aw / ratio;
    } else {
        aw = ah * ratio;
    }

    const maxW = sx > 0 ? imgW - anchor.x : anchor.x;
    const maxH = sy > 0 ? imgH - anchor.y : anchor.y;
    const scale = Math.min(1, maxW / aw, maxH / ah);
    aw *= scale;
    ah *= scale;

    const x = sx > 0 ? anchor.x : anchor.x - aw;
    const y = sy > 0 ? anchor.y : anchor.y - ah;
    return normalizeBox({ x, y, w: aw, h: ah });
};

export const getOutputSize = (
    crop: CropBox,
    mode: CropMode,
    targetWidth: number,
    targetHeight: number
) => ({
    outputW: mode === "fixed" ? Math.max(1, Math.round(targetWidth)) : Math.max(1, Math.round(crop.w)),
    outputH: mode === "fixed" ? Math.max(1, Math.round(targetHeight)) : Math.max(1, Math.round(crop.h)),
});

export const buildSavedCropFileName = (
    sourceName: string,
    index: number,
    outputW: number,
    outputH: number
) => `${sanitizeFileSegment(sourceName)}-crop-${String(index).padStart(2, "0")}-${outputW}x${outputH}.jpg`;
