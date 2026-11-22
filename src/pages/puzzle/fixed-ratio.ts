export type PhotoSize = { width: number; height: number };

export function recommendColumns(photos: PhotoSize[], ratio: number): number {
    if (!photos.length) return 1;
    let best = 1, score = -1;
    for (let columns = 1; columns <= Math.min(15, photos.length); columns++) {
        const rows = Math.ceil(photos.length / columns), cellAspect = ratio * rows / columns;
        const fill = photos.reduce((sum, photo) => {
            const aspect = photo.width / photo.height;
            return sum + Math.min(aspect / cellAspect, cellAspect / aspect);
        }, 0) / (columns * rows);
        if (fill > score) { score = fill; best = columns; }
    }
    return best;
}

export function fixedRatioPlacements(photos: PhotoSize[], width: number, height: number, columns: number, requestedGap: number) {
    const cols = Math.max(1, Math.min(15, Math.round(columns))), rows = Math.max(1, Math.ceil(photos.length / cols));
    const gap = Math.min(Math.max(0, requestedGap), width / (cols + 1) * .4, height / (rows + 1) * .4);
    const cellWidth = (width - gap * (cols + 1)) / cols, cellHeight = (height - gap * (rows + 1)) / rows;
    return photos.map((photo, index) => {
        const scale = Math.min(cellWidth / photo.width, cellHeight / photo.height);
        const w = photo.width * scale, h = photo.height * scale;
        return { x: Math.max(0, gap + (index % cols) * (cellWidth + gap) + (cellWidth - w) / 2), y: Math.max(0, gap + Math.floor(index / cols) * (cellHeight + gap) + (cellHeight - h) / 2), width: w, height: h };
    });
}

export function exactRatioSize(sourceWidth: number, ratioWidth: number, ratioHeight: number) {
    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
    const divisor = gcd(ratioWidth, ratioHeight), w = ratioWidth / divisor, h = ratioHeight / divisor;
    const units = Math.max(1, Math.floor(Math.min(sourceWidth / w, 16384 / w, 16384 / h, Math.sqrt(32_000_000 / (w * h)))));
    return { width: w * units, height: h * units };
}
