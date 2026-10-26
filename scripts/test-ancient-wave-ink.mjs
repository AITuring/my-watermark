import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { ShallowWater } from "../src/pages/ancient-waves/ShallowWater.ts";
import { tracedWaveLines } from "../src/pages/ancient-waves/tracedLines.ts";

const directionCheck = new ShallowWater();
const crestX = () => {
    let peak = { x: 0, height: -Infinity };
    for (let x = 80; x < 370; x += 2) {
        const height = directionCheck.sample(x, 560).elevation;
        if (height > peak.height) peak = { x, height };
    }
    return peak.x;
};
const startingCrest = crestX();
for (let frame = 0; frame < 60; frame++) directionCheck.step(1 / 60);
assert.ok(crestX() > startingCrest + 40,
    "The simulated crest did not propagate from left to right");

const bundled = await build({
    entryPoints: [fileURLToPath(new URL("../src/pages/ancient-waves/AnimatedInk.ts", import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
});
const source = Buffer.from(bundled.outputFiles[0].contents).toString("base64");
const { AnimatedInk } = await import(`data:text/javascript;base64,${source}`);
const water = new ShallowWater();
const ink = new AnimatedInk(water);
ink.updateGeometry();
const before = Float32Array.from(ink.mesh.geometry.getAttribute("position").array);

assert.ok(tracedWaveLines.length >= 400 && tracedWaveLines.length <= 600,
    "The source trace has too many broken fragments or too few ink details");
let longContours = 0;
for (const points of tracedWaveLines) {
    let length = 0;
    for (let index = 1; index < points.length; index++) {
        const step = Math.hypot(points[index][0] - points[index - 1][0],
            points[index][1] - points[index - 1][1]);
        assert.ok(step < 6, "A reconstructed painted contour has a visible gap");
        length += step;
    }
    assert.ok(length >= 12, "An isolated speck survived in the water drawing");
    if (length > 200) longContours++;
}
assert.ok(longContours >= 50, "Too few continuous layered wave contours remain");
const greatestMotion = new Float32Array(tracedWaveLines.length);
const greatestBend = new Float32Array(tracedWaveLines.length);
const oneSecondMotion = new Float32Array(tracedWaveLines.length);
let greatestHorizontalCenterDrift = 0;
for (let frame = 1; frame <= 720; frame++) {
    water.step(1 / 60);
    ink.step(1 / 60);
    if (frame % 30 !== 0) continue;
    ink.updateGeometry();
    const after = ink.mesh.geometry.getAttribute("position").array;
    let offset = 0;
    for (let line = 0; line < tracedWaveLines.length; line++) {
        const segments = tracedWaveLines[line].length - 1;
        let minimumLift = Infinity;
        let maximumLift = -Infinity;
        for (let segment = 0; segment < segments; segment++) {
            const index = offset + segment * 18;
            const lift = after[index + 1] - before[index + 1];
            greatestMotion[line] = Math.max(greatestMotion[line], Math.abs(lift));
            if (frame === 60) oneSecondMotion[line] = Math.max(oneSecondMotion[line], Math.abs(lift));
            minimumLift = Math.min(minimumLift, lift);
            maximumLift = Math.max(maximumLift, lift);
            const centerBefore = (before[index] + before[index + 3]) / 2;
            const centerAfter = (after[index] + after[index + 3]) / 2;
            greatestHorizontalCenterDrift = Math.max(greatestHorizontalCenterDrift,
                Math.abs(centerAfter - centerBefore));
        }
        greatestBend[line] = Math.max(greatestBend[line], maximumLift - minimumLift);
        offset += segments * 18;
    }
    assert.equal(offset, after.length);
}
const smallestMotion = Math.min(...greatestMotion);
const sortedOneSecondMotion = [...oneSecondMotion].sort((a, b) => a - b);
const medianOneSecondMotion = sortedOneSecondMotion[Math.floor(sortedOneSecondMotion.length / 2)];
assert.ok(medianOneSecondMotion > 3,
    "Most ink lines still look motionless in the first second");
const stillStrokes = greatestMotion.filter((motion) => motion < 0.2).length;
assert.ok(stillStrokes < tracedWaveLines.length * 0.01,
    "Visible ink strokes stayed still over a full wave passage");
assert.ok(greatestHorizontalCenterDrift > 1 && greatestHorizontalCenterDrift < 25,
    "Ink should advect locally to the right without sliding the entire painting");
let longStrokes = 0;
let bendingStrokes = 0;
for (let line = 0; line < tracedWaveLines.length; line++) {
    const points = tracedWaveLines[line];
    const last = points[points.length - 1];
    const span = Math.hypot(last[0] - points[0][0], last[1] - points[0][1]);
    if (span < 80) continue;
    longStrokes++;
    if (greatestBend[line] > 0.7) bendingStrokes++;
}
assert.ok(bendingStrokes > longStrokes * 0.7,
    "Long painted contours did not bend as crests crossed them");
ink.dispose();
console.log({ movingStrokes: tracedWaveLines.length - stillStrokes,
    stillStrokes, smallestMotion, medianOneSecondMotion,
    greatestHorizontalCenterDrift, bendingStrokes, longStrokes });
