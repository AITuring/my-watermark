export interface FaceBox { x: number; y: number; width: number; height: number }
// Only choose a subject when its face clearly dominates; similarly sized faces remain manual.
export function primaryFace<T extends { box: FaceBox; score: number }>(faces: T[]): T | undefined {
    const ranked = [...faces].filter(f => f.score >= 0.5).sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
    if (!ranked.length) return undefined;
    if (ranked.length === 1) return ranked[0];
    const [first, second] = ranked;
    return first.box.width * first.box.height >= 4 * second.box.width * second.box.height ? first : undefined;
}
export function faceCrop(box: FaceBox, width: number, height: number) {
    const padding = Math.max(box.width, box.height) * 0.45;
    const x = Math.max(0, Math.floor(box.x - padding));
    const y = Math.max(0, Math.floor(box.y - padding));
    return { x, y, width: Math.min(width, Math.ceil(box.x + box.width + padding)) - x,
        height: Math.min(height, Math.ceil(box.y + box.height + padding)) - y };
}
