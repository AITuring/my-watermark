/**
 * Reference based colour matching for photographs.
 *
 * The matcher deliberately works on image statistics rather than pixel pairs:
 * photographs of the same object rarely have the same composition.  Matching
 * is performed in CIE Lab so the UI can expose sensible temperature, tint,
 * exposure, contrast and saturation controls.
 */

export interface ColorMatchOptions {
    /** Maximum number of pixels sampled from each image while analysing. */
    maxSamples?: number;
    /** Ignore transparent pixels and the most extreme luminance values. */
    trimExtremes?: boolean;
    /** Blend the generated correction with the source image (0..1). */
    strength?: number;
}

export interface ColorMatchStats {
    meanL: number;
    meanA: number;
    meanB: number;
    stdL: number;
    stdA: number;
    stdB: number;
    meanRed: number;
    meanGreen: number;
    meanBlue: number;
    sampleCount: number;
}

export interface ColorMatchAdjustment {
    /** Lab b-axis shift. Positive values are warmer/yellower. */
    temperature: number;
    /** Lab a-axis shift. Positive values are more magenta/red. */
    tint: number;
    /** Linear-light exposure shift in stops. */
    exposure: number;
    /** Luminance contrast multiplier around middle grey. */
    contrast: number;
    /** Chroma multiplier around neutral grey. */
    saturation: number;
    reference: ColorMatchStats;
    target: ColorMatchStats;
}

const DEFAULT_MAX_SAMPLES = 48_000;
const D65_X = 0.95047;
const D65_Y = 1;
const D65_Z = 1.08883;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function srgbToLinear(value: number): number {
    return value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value: number): number {
    const clamped = clamp(value, 0, 1);
    return clamped <= 0.0031308
        ? clamped * 12.92
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function pivotLab(value: number): number {
    const delta = 6 / 29;
    return value > delta * delta * delta
        ? Math.cbrt(value)
        : value / (3 * delta * delta) + 4 / 29;
}

function inversePivotLab(value: number): number {
    const delta = 6 / 29;
    return value > delta
        ? value * value * value
        : 3 * delta * delta * (value - 4 / 29);
}

function rgbToLab(red: number, green: number, blue: number): [number, number, number] {
    const r = srgbToLinear(red);
    const g = srgbToLinear(green);
    const b = srgbToLinear(blue);

    // sRGB -> XYZ (D65), then XYZ -> CIE Lab.
    const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / D65_X;
    const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / D65_Y;
    const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / D65_Z;
    const fx = pivotLab(x);
    const fy = pivotLab(y);
    const fz = pivotLab(z);

    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb(lightness: number, a: number, b: number): [number, number, number] {
    const fy = (lightness + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    const x = D65_X * inversePivotLab(fx);
    const y = D65_Y * inversePivotLab(fy);
    const z = D65_Z * inversePivotLab(fz);

    // XYZ (D65) -> linear sRGB.
    const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
    const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
    const blue = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

    return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(blue)];
}

function percentile(values: number[], fraction: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = (sorted.length - 1) * clamp(fraction, 0, 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function sampleStep(width: number, height: number, maxSamples: number): number {
    const total = Math.max(1, width * height);
    return Math.max(1, Math.ceil(Math.sqrt(total / Math.max(1, maxSamples))));
}

function trimmedMean(values: number[], trim: boolean): number {
    if (values.length === 0) return 0;
    if (!trim || values.length < 20) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    const low = percentile(values, 0.05);
    const high = percentile(values, 0.95);
    const accepted = values.filter((value) => value >= low && value <= high);
    return (accepted.length ? accepted : values).reduce((sum, value) => sum + value, 0) /
        (accepted.length || values.length);
}

/** Analyse an image using robust sampled colour statistics. */
export function analyzeColorImageData(
    imageData: ImageData,
    options: ColorMatchOptions = {}
): ColorMatchStats {
    const { data, width, height } = imageData;
    const step = sampleStep(width, height, options.maxSamples ?? DEFAULT_MAX_SAMPLES);
    const trim = options.trimExtremes ?? true;
    const lights: number[] = [];
    const as: number[] = [];
    const bs: number[] = [];
    const reds: number[] = [];
    const greens: number[] = [];
    const blues: number[] = [];

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const offset = (y * width + x) * 4;
            const alpha = data[offset + 3] / 255;
            if (alpha < 0.05) continue;

            const red = data[offset] / 255;
            const green = data[offset + 1] / 255;
            const blue = data[offset + 2] / 255;
            const [light, a, b] = rgbToLab(red, green, blue);
            lights.push(light);
            as.push(a);
            bs.push(b);
            reds.push(red);
            greens.push(green);
            blues.push(blue);
        }
    }

    if (lights.length === 0) {
        return {
            meanL: 50,
            meanA: 0,
            meanB: 0,
            stdL: 1,
            stdA: 1,
            stdB: 1,
            meanRed: 0.5,
            meanGreen: 0.5,
            meanBlue: 0.5,
            sampleCount: 0,
        };
    }

    const meanL = trimmedMean(lights, trim);
    const meanA = trimmedMean(as, trim);
    const meanB = trimmedMean(bs, trim);
    const variance = (values: number[], mean: number) =>
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);

    return {
        meanL,
        meanA,
        meanB,
        stdL: Math.sqrt(variance(lights, meanL)),
        stdA: Math.sqrt(variance(as, meanA)),
        stdB: Math.sqrt(variance(bs, meanB)),
        meanRed: trimmedMean(reds, trim),
        meanGreen: trimmedMean(greens, trim),
        meanBlue: trimmedMean(blues, trim),
        sampleCount: lights.length,
    };
}

/** Derive a global correction that moves the target distribution toward the reference. */
export function deriveColorMatch(
    referenceData: ImageData,
    targetData: ImageData,
    options: ColorMatchOptions = {}
): ColorMatchAdjustment {
    const reference = analyzeColorImageData(referenceData, options);
    const target = analyzeColorImageData(targetData, options);

    // Lab a/b are approximately green-red and blue-yellow axes. Keep shifts
    // bounded so a single saturated object cannot produce an unusable correction.
    const temperature = clamp((reference.meanB - target.meanB) * 0.9, -24, 24);
    const tint = clamp((reference.meanA - target.meanA) * 0.9, -24, 24);

    // Mean Lab L is perceptual, while exposure is applied in linear light.
    const exposure = clamp(Math.log2((reference.meanL + 8) / (target.meanL + 8)), -1.5, 1.5);
    const contrast = clamp(reference.stdL / Math.max(target.stdL, 3), 0.65, 1.55);
    const referenceChroma = Math.hypot(reference.stdA, reference.stdB);
    const targetChroma = Math.hypot(target.stdA, target.stdB);
    const saturation = clamp(referenceChroma / Math.max(targetChroma, 3), 0.65, 1.5);

    return { temperature, tint, exposure, contrast, saturation, reference, target };
}

/** Apply a correction to an ImageData object, preserving the source alpha channel. */
export function applyColorMatch(
    imageData: ImageData,
    adjustment: ColorMatchAdjustment,
    options: Pick<ColorMatchOptions, "strength"> = {}
): ImageData {
    const strength = clamp(options.strength ?? 1, 0, 1);
    const result = new ImageData(imageData.width, imageData.height);
    const input = imageData.data;
    const output = result.data;
    // Apply the full correction once, then blend the corrected pixel with the
    // source. This keeps the strength slider linear rather than applying it
    // twice (once in the transform and again in the blend).
    const exposureScale = Math.pow(2, adjustment.exposure);
    const contrast = adjustment.contrast;
    const saturation = adjustment.saturation;
    const temperature = adjustment.temperature;
    const tint = adjustment.tint;

    for (let offset = 0; offset < input.length; offset += 4) {
        const alpha = input[offset + 3];
        if (alpha === 0) {
            output[offset] = input[offset];
            output[offset + 1] = input[offset + 1];
            output[offset + 2] = input[offset + 2];
            output[offset + 3] = alpha;
            continue;
        }

        const originalRed = input[offset] / 255;
        const originalGreen = input[offset + 1] / 255;
        const originalBlue = input[offset + 2] / 255;
        const exposedRed = clamp(srgbToLinear(originalRed) * exposureScale, 0, 1);
        const exposedGreen = clamp(srgbToLinear(originalGreen) * exposureScale, 0, 1);
        const exposedBlue = clamp(srgbToLinear(originalBlue) * exposureScale, 0, 1);
        const [exposedSR, exposedSG, exposedSB] = [
            linearToSrgb(exposedRed),
            linearToSrgb(exposedGreen),
            linearToSrgb(exposedBlue),
        ];
        let [light, a, b] = rgbToLab(exposedSR, exposedSG, exposedSB);
        light = clamp(50 + (light - 50) * contrast, 0, 100);
        a = clamp(a * saturation + tint, -128, 127);
        b = clamp(b * saturation + temperature, -128, 127);
        const [matchedRed, matchedGreen, matchedBlue] = labToRgb(light, a, b);

        output[offset] = Math.round(clamp((originalRed + (matchedRed - originalRed) * strength) * 255, 0, 255));
        output[offset + 1] = Math.round(clamp((originalGreen + (matchedGreen - originalGreen) * strength) * 255, 0, 255));
        output[offset + 2] = Math.round(clamp((originalBlue + (matchedBlue - originalBlue) * strength) * 255, 0, 255));
        output[offset + 3] = alpha;
    }

    return result;
}

/** Convenience helper for callers that already have reference and target ImageData. */
export function matchColorImageData(
    referenceData: ImageData,
    targetData: ImageData,
    options: ColorMatchOptions = {}
): { adjustment: ColorMatchAdjustment; imageData: ImageData } {
    const adjustment = deriveColorMatch(referenceData, targetData, options);
    return {
        adjustment,
        imageData: applyColorMatch(targetData, adjustment, options),
    };
}

export const COLOR_MATCH_LIMITS = {
    maxSamples: DEFAULT_MAX_SAMPLES,
    maxTemperature: 24,
    maxTint: 24,
    maxExposure: 1.5,
};
