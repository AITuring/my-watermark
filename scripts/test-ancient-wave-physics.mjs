import assert from "node:assert/strict";
import { ShallowWater } from "../src/pages/ancient-waves/ShallowWater.ts";
import { BreakingWater } from "../src/pages/ancient-waves/BreakingWater.ts";
import { tracedWaveLines } from "../src/pages/ancient-waves/tracedLines.ts";

assert.ok(tracedWaveLines.length >= 1500, "The painting lost its short wave strokes");
for (const stroke of tracedWaveLines) {
    for (let point = 1; point < stroke.length; point++) {
        assert.ok(Math.hypot(stroke[point][0] - stroke[point - 1][0],
            stroke[point][1] - stroke[point - 1][1]) < 5,
        "A traced stroke is discontinuous");
    }
}

const totalWater = (water) => water.eta.reduce((sum, value) => sum + value, 0);

const exchangeWater = new ShallowWater();
const beforeExchange = totalWater(exchangeWater);
exchangeWater.exchange(499, 622, -0.01, 83);
assert.ok(Math.abs(totalWater(exchangeWater) - beforeExchange + 0.01) < 1e-6);

const control = new ShallowWater();
const coupled = new ShallowWater();
const breaking = new BreakingWater();
let greatestMassError = 0;
let greatestSegments = 0;
let sawOverturn = false;
let sawSpray = false;

for (let frame = 1; frame <= 3600; frame++) {
    control.step(1 / 60);
    coupled.step(1 / 60);
    breaking.step(1 / 60, coupled);

    if (frame <= 180 && frame % 60 === 0) {
        const airborne = breaking.diagnostics().airborneVolume;
        const error = Math.abs(totalWater(coupled) + airborne - totalWater(control));
        greatestMassError = Math.max(greatestMassError, error);
    }
    if (frame === 36 || frame === 90 || frame % 60 === 0) {
        let segments = 0;
        let uppermost = Infinity;
        let rightmost = -Infinity;
        breaking.forEachInkSegment((ax, ay, bx, by) => {
            segments++;
            uppermost = Math.min(uppermost, ay, by);
            rightmost = Math.max(rightmost, ax, bx);
        });
        greatestSegments = Math.max(greatestSegments, segments);
        if (frame === 36) sawOverturn = uppermost < 510 && rightmost > 860;
        if (frame === 90) sawSpray = breaking.diagnostics().spray > 0;
        for (const elevation of coupled.eta) assert.ok(Number.isFinite(elevation));
    }
}

assert.ok(greatestMassError < 1e-4, `Water/jet volume drift: ${greatestMassError}`);
assert.ok(sawOverturn, "The crest did not rise and extend forward");
assert.ok(sawSpray, "The plunging jet did not break on impact");
assert.ok(greatestSegments < 1200, "Breaking geometry exceeded its buffer");
assert.ok(breaking.diagnostics().breaks >= 15, "Breaking stopped during the long run");

console.log({
    durationSeconds: 60,
    breaks: breaking.diagnostics().breaks,
    greatestMassError,
    greatestSegments,
    overturn: sawOverturn,
    impactSpray: sawSpray,
});
