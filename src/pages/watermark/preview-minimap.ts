type Point = {x: number; y: number};

/** Visible source-image rectangle, clipped to the thumbnail rather than letterboxing. */
export function getMinimapViewport(center: Point, zoom: number, viewportWidth: number, viewportHeight: number, imageWidth: number, imageHeight: number) {
    if (imageWidth <= 0 || imageHeight <= 0 || zoom <= 0) return {x: 0, y: 0, width: 1, height: 1};
    const halfWidth = viewportWidth / (imageWidth * zoom * 2);
    const halfHeight = viewportHeight / (imageHeight * zoom * 2);
    const x = Math.max(0, center.x - halfWidth), y = Math.max(0, center.y - halfHeight);
    return {x, y, width: Math.min(1, center.x + halfWidth) - x,
        height: Math.min(1, center.y + halfHeight) - y};
}

/** Preserve the grabbed point when dragging a view rectangle; clicks use zero offset. */
export function minimapPointToCenter(point: Point, offset: Point = {x: 0, y: 0}): Point {
    const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .5;
    return {x: bounded(point.x - offset.x), y: bounded(point.y - offset.y)};
}
