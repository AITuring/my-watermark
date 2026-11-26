export function zoomAroundCenter(position: {x: number; y: number}, oldScale: number, nextScale: number, width: number, height: number) {
    if (nextScale === 1) return {x: 0, y: 0};
    const ratio = nextScale / oldScale;
    return {x: width / 2 - (width / 2 - position.x) * ratio, y: height / 2 - (height / 2 - position.y) * ratio};
}

export function fitPreviewImage(imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number, padding = 12) {
    if (imageWidth <= 0 || imageHeight <= 0) return {width: 0, height: 0, scale: 0};
    const scale = Math.min(Math.max(1, viewportWidth - padding * 2) / imageWidth,
        Math.max(1, viewportHeight - padding * 2) / imageHeight);
    return {width: imageWidth * scale, height: imageHeight * scale, scale};
}

/** Camera center stays in image coordinates, independent of the viewport or zoom. */
export function previewPositionForCenter(center: {x: number; y: number}, zoom: number, viewportWidth: number, viewportHeight: number, imageWidth: number, imageHeight: number) {
    return zoomAroundCenter({x: (.5 - center.x) * imageWidth, y: (.5 - center.y) * imageHeight},
        1, zoom, viewportWidth, viewportHeight);
}

export function previewCenterForPosition(position: {x: number; y: number}, zoom: number, viewportWidth: number, viewportHeight: number, imageWidth: number, imageHeight: number) {
    if (zoom === 1 || !imageWidth || !imageHeight) return {x: .5, y: .5};
    const bounded = (value: number) => Math.max(0, Math.min(1, value));
    return {
        x: bounded(((viewportWidth / 2 - position.x) / zoom - (viewportWidth - imageWidth) / 2) / imageWidth),
        y: bounded(((viewportHeight / 2 - position.y) / zoom - (viewportHeight - imageHeight) / 2) / imageHeight),
    };
}
