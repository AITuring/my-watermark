import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { ShallowWater } from "../src/pages/ancient-waves/ShallowWater.ts";
import { tracedWaveLines } from "../src/pages/ancient-waves/tracedLines.ts";

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
const ink = new AnimatedInk();
const water = new ShallowWater();
ink.updateGeometry();
const before = Float32Array.from(ink.mesh.geometry.getAttribute("position").array);

assert.ok(tracedWaveLines.length >= 1500, "Short wave strokes were omitted");
const greatestMotion = new Float32Array(tracedWaveLines.length);
let greatestHorizontalCenterDrift = 0;
for (let frame = 1; frame <= 180; frame++) {
    water.step(1 / 60);
    ink.step(water, 1 / 60);
    if (![15, 30, 45, 60, 90, 120, 180].includes(frame)) continue;
    ink.updateGeometry();
    const after = ink.mesh.geometry.getAttribute("position").array;
    let offset = 0;
    for (let line = 0; line < tracedWaveLines.length; line++) {
        const segments = tracedWaveLines[line].length - 1;
        for (let segment = 0; segment < segments; segment++) {
            const index = offset + segment * 18;
            const motion = Math.hypot(after[index] - before[index], after[index + 1] - before[index + 1]);
            greatestMotion[line] = Math.max(greatestMotion[line], motion);
            const centerBefore = (before[index] + before[index + 3]) / 2;
            const centerAfter = (after[index] + after[index + 3]) / 2;
            greatestHorizontalCenterDrift = Math.max(greatestHorizontalCenterDrift,
                Math.abs(centerAfter - centerBefore));
        }
        offset += segments * 18;
    }
    assert.equal(offset, after.length);
}
const smallestMotion = Math.min(...greatestMotion);
assert.ok(smallestMotion > 0.2, "A visible ink stroke stayed still across a wave cycle");
assert.ok(greatestHorizontalCenterDrift < 0.0001, "Ink strokes translated horizontally");
const after = ink.mesh.geometry.getAttribute("position").array;
let offset = 0;
let longStrokes = 0;
let bendingStrokes = 0;
let risingStrokes = 0;
let fallingStrokes = 0;
for (const stroke of tracedWaveLines) {
    const segments = stroke.length - 1;
    const span = Math.hypot(stroke[stroke.length - 1][0] - stroke[0][0],
        stroke[stroke.length - 1][1] - stroke[0][1]);
    let meanLift = 0;
    for (let segment = 0; segment < segments; segment++) {
        const index = offset + segment * 18;
        meanLift += (after[index + 1] + after[index + 4]
            - before[index + 1] - before[index + 4]) / (2 * segments);
    }
    if (meanLift > 0.5) risingStrokes++;
    if (meanLift < -0.5) fallingStrokes++;
    if (span >= 80) {
        longStrokes++;
        let minimumLift = Infinity;
        let maximumLift = -Infinity;
        for (let segment = 0; segment < segments; segment++) {
            const index = offset + segment * 18;
            const lift = (after[index + 1] + after[index + 4]
                - before[index + 1] - before[index + 4]) / 2;
            minimumLift = Math.min(minimumLift, lift);
            maximumLift = Math.max(maximumLift, lift);
        }
        if (maximumLift - minimumLift > 1) bendingStrokes++;
    }
    offset += segments * 18;
}
assert.ok(bendingStrokes > longStrokes * 0.8, "Long wave lines moved rigidly instead of bending");
assert.ok(risingStrokes > 100 && fallingStrokes > 100,
    "Separate wave lines moved in the same direction together");
ink.dispose();
console.log({ movingStrokes: tracedWaveLines.length, smallestMotion,
    greatestHorizontalCenterDrift, bendingStrokes, longStrokes,
    risingStrokes, fallingStrokes });
