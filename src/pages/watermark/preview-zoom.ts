export function zoomAroundCenter(position: {x: number; y: number}, oldScale: number, nextScale: number, width: number, height: number) {
    if (nextScale === 1) return {x: 0, y: 0};
    const ratio = nextScale / oldScale;
    return {x: width / 2 - (width / 2 - position.x) * ratio, y: height / 2 - (height / 2 - position.y) * ratio};
}
