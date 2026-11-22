import type { ImgProp } from './types';

export type PhotoSignature = { hash: number[]; histogram: number[]; contrast: number; aspect: number };
export type SimilarCandidate = { photo: ImgProp; signature: PhotoSignature | null };
export type SimilarPhotoGroup = { photos: ImgProp[]; reason: string };

export function photoNameKeys(name: string) {
    const base = name.replace(/\.[^.]+$/, '');
    const family = base.replace(/((?:DSC_?\d+|IMG_?\d+|未标题[-_ ]?\d+))(?:[-_]\d+)+$/i, '$1');
    const object = base.replace(/[-_ ]?(?:DSC_?\d+|IMG_?\d+|未标题[-_ ]?\d+).*$/i, '').replace(/[-_ ]+$/, '');
    return { family, object: object.length >= 8 ? object : '' };
}

export function similarityReason(a: SimilarCandidate, b: SimilarCandidate): string | null {
    const left = photoNameKeys(a.photo.fileName ?? ''), right = photoNameKeys(b.photo.fileName ?? '');
    if (left.family && left.family === right.family) return '同一拍摄编号的不同版本';
    // A precise findspot is useful evidence across different angles, but still needs user review.
    if (left.object && left.object === right.object && /(?:M\d+|M\d+墓|旧藏)/i.test(left.object)) return '器物名称与具体出土信息一致';
    const x = a.signature, y = b.signature;
    if (!x || !y || Math.min(x.contrast, y.contrast) < 9) return null;
    const distance = x.hash.reduce((sum, value, i) => sum + Number(value !== y.hash[i]), 0);
    const colorDistance = x.histogram.reduce((sum, value, i) => sum + Math.abs(value - y.histogram[i]), 0) / 6;
    const sameName = left.object && left.object === right.object;
    const aspectDistance = Math.abs(Math.log(x.aspect / y.aspect));
    if (distance <= 3 && colorDistance < .035 && aspectDistance < .08) return '画面高度相似';
    if (left.object && right.object && !sameName) return null;
    if (distance <= (sameName ? 22 : 10) && colorDistance < (sameName ? .26 : .12) && aspectDistance < .35) return sameName ? '器物名称一致，画面相似' : '画面相似，请核对是否同一件';
    return null;
}

export const photoPairKey = (a: string, b: string) => [a, b].sort().join('\n');

export function groupSimilarPhotos(candidates: SimilarCandidate[], ignoredPairs: Set<string> = new Set()): SimilarPhotoGroup[] {
    const groups: SimilarCandidate[][] = [];
    for (const candidate of candidates) {
        // Complete linkage prevents a weak A–B–C chain merging unrelated objects.
        const group = groups.find((members) => members.every((other) => !ignoredPairs.has(photoPairKey(other.photo.id, candidate.photo.id)) && similarityReason(other, candidate)));
        if (group) group.push(candidate); else groups.push([candidate]);
    }
    return groups.filter((group) => group.length > 1).map((group) => {
        const reasons = new Set(group.slice(1).map((item) => similarityReason(group[0], item)));
        return { photos: group.map((item) => item.photo), reason: reasons.size === 1 ? similarityReason(group[0], group[1])! : '文件名与画面线索，请逐张核对' };
    });
}

export async function readPhotoSignature(photo: ImgProp): Promise<PhotoSignature | null> {
    try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = photo.src; });
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(image, 0, 0, 32, 32);
        const pixels = ctx.getImageData(0, 0, 32, 32).data;
        const grey: number[] = [], histogram = new Array<number>(24).fill(0);
        for (let i = 0; i < pixels.length; i += 4) {
            grey.push(pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114);
            for (let c = 0; c < 3; c++) histogram[c * 8 + Math.min(7, Math.floor(pixels[i + c] / 32))] += 1 / 1024;
        }
        const hash: number[] = [];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const px = x * 4, py = y * 4;
            hash.push(Number(grey[py * 32 + px] > grey[py * 32 + Math.min(31, px + 3)]));
        }
        const mean = grey.reduce((a, b) => a + b, 0) / grey.length;
        const contrast = Math.sqrt(grey.reduce((sum, n) => sum + (n - mean) ** 2, 0) / grey.length);
        return { hash, histogram, contrast, aspect: photo.width / photo.height };
    } catch { return null; }
}
