import { writeFileSync } from "node:fs";
import { tracedWavePaths } from "../src/pages/ancient-waves/tracedPaths.ts";

// The source tracing is a union of one-pixel horizontal runs. Thin that union
// and walk its eight-connected skeleton so each stroke has its own point list.
const width = 1380;
const height = 896;
const size = width * height;
const ink = new Uint8Array(size);
const rectangles = [...tracedWavePaths.matchAll(/M(\d+) (\d+)h(\d+)v1\.2h-\d+z/g)];
for (const match of rectangles) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    const span = Number(match[3]);
    ink.fill(1, y * width + x, y * width + Math.min(width, x + span));
}

const neighbors = [-width, -width + 1, 1, width + 1, width, width - 1, -1, -width - 1];
const marked = [];
for (let iteration = 0; iteration < 24; iteration++) {
    let removed = 0;
    for (let pass = 0; pass < 2; pass++) {
        marked.length = 0;
        for (let y = 1; y < height - 1; y++) {
            const row = y * width;
            for (let x = 1; x < width - 1; x++) {
                const index = row + x;
                if (!ink[index]) continue;
                const p = neighbors.map((offset) => ink[index + offset]);
                const count = p.reduce((sum, value) => sum + value, 0);
                if (count < 2 || count > 6) continue;
                let transitions = 0;
                for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) & 7]) transitions++;
                if (transitions !== 1) continue;
                if (pass === 0 ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6]
                    : p[0] * p[2] * p[6] || p[0] * p[4] * p[6]) continue;
                marked.push(index);
            }
        }
        for (const index of marked) ink[index] = 0;
        removed += marked.length;
    }
    if (!removed) break;
}

function adjacent(index) {
    const x = index % width;
    const y = Math.floor(index / width);
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) return [];
    const list = [];
    for (let direction = 0; direction < 8; direction++) {
        const next = index + neighbors[direction];
        if (ink[next]) list.push(next);
    }
    return list;
}

const edgeKey = (a, b) => Math.min(a, b) * size + Math.max(a, b);
const visited = new Set();
const strokes = [];

function walk(start, initial) {
    const line = [start];
    let previous = start;
    let current = initial;
    visited.add(edgeKey(start, initial));
    while (line.length < 10000) {
        line.push(current);
        const options = adjacent(current).filter((candidate) => !visited.has(edgeKey(current, candidate)));
        if (!options.length) break;
        const px = previous % width;
        const py = Math.floor(previous / width);
        const cx = current % width;
        const cy = Math.floor(current / width);
        const vx = cx - px;
        const vy = cy - py;
        options.sort((a, b) => {
            const ax = a % width - cx;
            const ay = Math.floor(a / width) - cy;
            const bx = b % width - cx;
            const by = Math.floor(b / width) - cy;
            return (bx * vx + by * vy) / Math.hypot(bx, by)
                - (ax * vx + ay * vy) / Math.hypot(ax, ay);
        });
        const next = options[0];
        visited.add(edgeKey(current, next));
        previous = current;
        current = next;
        if (current === start) { line.push(start); break; }
    }
    return line;
}

const pixels = [];
for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        if (ink[index]) pixels.push(index);
    }
}

// Open strokes first; closed and branched remnants follow.
for (const index of pixels) {
    const links = adjacent(index);
    if (links.length !== 1) continue;
    for (const next of links) {
        if (!visited.has(edgeKey(index, next))) strokes.push(walk(index, next));
    }
}
for (const index of pixels) {
    for (const next of adjacent(index)) {
        if (!visited.has(edgeKey(index, next))) strokes.push(walk(index, next));
    }
}

const lines = strokes.flatMap((stroke) => {
    if (stroke.length < 4) return [];
    const sampled = [stroke[0]];
    for (let i = 3; i < stroke.length - 1; i += 3) sampled.push(stroke[i]);
    sampled.push(stroke[stroke.length - 1]);
    const points = sampled.map((index) => [index % width, Math.floor(index / width)]);
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    return length >= 4 ? [{ points, length }] : [];
});

lines.sort((a, b) => b.length - a.length);
const output = `// Generated from tracedPaths.ts by scripts/generate-ancient-wave-lines.mjs.\n`
    + `// Each entry is one independently animated ink stroke in painting coordinates.\n`
    + `export const tracedWaveLines: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = `
    + JSON.stringify(lines.map((line) => line.points)) + ";\n";
writeFileSync(new URL("../src/pages/ancient-waves/tracedLines.ts", import.meta.url), output);
console.log({ sourceRectangles: rectangles.length, skeletonPixels: pixels.length,
    lines: lines.length, points: lines.reduce((sum, line) => sum + line.points.length, 0),
    longest: Math.round(lines[0]?.length ?? 0), outputBytes: output.length });
