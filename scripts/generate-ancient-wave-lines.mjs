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

// The scan is very faint. Its long parallel contours are interrupted by
// low-contrast gaps, while many isolated 4-10 px skeleton pieces are noise.
// Join only nearly horizontal, mutually compatible contour ends; keep curls
// separate so a bridge cannot cut through a breaking crest.
const flowing = [];
const curls = [];
for (const line of lines) {
    if (line.length < 12) continue;
    const xs = line.points.map((point) => point[0]);
    const ys = line.points.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const verticalSpan = Math.max(...ys) - Math.min(...ys);
    const verticalArtifact = verticalSpan > 20 && maxX - minX < verticalSpan * 0.4
        && (maxX < 22 || minX > width - 25 || (minX > 680 && maxX < 705));
    if (verticalArtifact) continue;
    const first = line.points[0];
    const last = line.points[line.points.length - 1];
    const horizontalSpan = Math.abs(last[0] - first[0]);
    if (horizontalSpan < 15 || horizontalSpan / line.length < 0.62) {
        curls.push(line);
        continue;
    }
    const points = last[0] > first[0] ? line.points : [...line.points].reverse();
    const tangent = (fromStart) => {
        const anchor = fromStart ? points[0] : points[points.length - 1];
        let candidate = anchor;
        if (fromStart) {
            for (const point of points) {
                candidate = point;
                if (point[0] - anchor[0] >= 9) break;
            }
            return Math.max(-0.9, Math.min(0.9,
                (candidate[1] - anchor[1]) / Math.max(1, candidate[0] - anchor[0])));
        }
        for (let index = points.length - 1; index >= 0; index--) {
            candidate = points[index];
            if (anchor[0] - candidate[0] >= 9) break;
        }
        return Math.max(-0.9, Math.min(0.9,
            (anchor[1] - candidate[1]) / Math.max(1, anchor[0] - candidate[0])));
    };
    flowing.push({ points, length: line.length, startSlope: tangent(true), endSlope: tangent(false) });
}

const possibilities = [];
for (let from = 0; from < flowing.length; from++) {
    const a = flowing[from];
    const end = a.points[a.points.length - 1];
    for (let to = 0; to < flowing.length; to++) {
        if (from === to) continue;
        const b = flowing[to];
        const start = b.points[0];
        const dx = start[0] - end[0];
        if (dx < 3 || dx > 62) continue;
        const dy = start[1] - end[1];
        const joiningSlope = dy / dx;
        const tangentError = Math.abs(joiningSlope - a.endSlope)
            + Math.abs(joiningSlope - b.startSlope);
        const projectedError = Math.abs(dy - dx * (a.endSlope + b.startSlope) * 0.5);
        if (Math.abs(dy) > 28 || projectedError > 5 + dx * 0.20
            || tangentError > 1.05) continue;
        const score = dx * 0.16 + projectedError * 1.6 + tangentError * 8;
        possibilities.push({ from, to, score });
    }
}
possibilities.sort((a, b) => a.score - b.score);
const successor = new Int32Array(flowing.length).fill(-1);
const predecessor = new Int32Array(flowing.length).fill(-1);
for (const edge of possibilities) {
    if (successor[edge.from] !== -1 || predecessor[edge.to] !== -1) continue;
    successor[edge.from] = edge.to;
    predecessor[edge.to] = edge.from;
}

function bridge(a, b) {
    const end = a.points[a.points.length - 1];
    const start = b.points[0];
    const dx = start[0] - end[0];
    const inserted = [];
    for (let x = end[0] + 3; x < start[0] - 1; x += 3) {
        const u = (x - end[0]) / dx;
        const y = (2 * u ** 3 - 3 * u ** 2 + 1) * end[1]
            + (u ** 3 - 2 * u ** 2 + u) * dx * a.endSlope
            + (-2 * u ** 3 + 3 * u ** 2) * start[1]
            + (u ** 3 - u ** 2) * dx * b.startSlope;
        inserted.push([x, Math.round(y * 10) / 10]);
    }
    return inserted;
}

const joined = [];
for (let index = 0; index < flowing.length; index++) {
    if (predecessor[index] !== -1) continue;
    const points = [...flowing[index].points];
    let current = index;
    while (successor[current] !== -1) {
        const next = successor[current];
        points.push(...bridge(flowing[current], flowing[next]), ...flowing[next].points);
        current = next;
    }
    // One-pixel skeleton zigzags are smoothed without shifting the crest.
    const smoothed = points.map((point, position) => {
        if (position === 0 || position === points.length - 1) return point;
        const before = points[position - 1];
        const after = points[position + 1];
        return [Math.round((before[0] + 2 * point[0] + after[0]) * 2.5) / 10,
            Math.round((before[1] + 2 * point[1] + after[1]) * 2.5) / 10];
    });
    let length = 0;
    for (let position = 1; position < smoothed.length; position++) {
        length += Math.hypot(smoothed[position][0] - smoothed[position - 1][0],
            smoothed[position][1] - smoothed[position - 1][1]);
    }
    joined.push({ points: smoothed, length });
}

const continuousLines = [...joined, ...curls].sort((a, b) => b.length - a.length);
const output = `// Generated from tracedPaths.ts by scripts/generate-ancient-wave-lines.mjs.\n`
    + `// Continuous contours and separate breaking-crest curls in painting coordinates.\n`
    + `export const tracedWaveLines: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = `
    + JSON.stringify(continuousLines.map((line) => line.points)) + ";\n";
writeFileSync(new URL("../src/pages/ancient-waves/tracedLines.ts", import.meta.url), output);
console.log({ sourceRectangles: rectangles.length, skeletonPixels: pixels.length,
    sourceLines: lines.length, flowing: flowing.length, curls: curls.length,
    bridges: possibilities.length, joinedBridges: successor.filter((index) => index !== -1).length,
    lines: continuousLines.length,
    points: continuousLines.reduce((sum, line) => sum + line.points.length, 0),
    longest: Math.round(continuousLines[0]?.length ?? 0), outputBytes: output.length });
