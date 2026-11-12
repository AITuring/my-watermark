export interface WatermarkLayoutMetrics {
    title: number;
    caption: number;
    signature: number;
    gap: number;
    basis: 'reference-text' | 'image-estimate';
}

/** All returned lengths are ORIGINAL image pixels, never CSS/preview pixels. */
export function getWatermarkLayoutMetrics(width: number, height: number, referenceTextHeight?: number): WatermarkLayoutMetrics {
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) {
        throw new Error('图片尺寸无效');
    }
    const short = Math.min(width, height);
    const aspect = Math.max(width, height) / short;
    const hasReference = Number.isFinite(referenceTextHeight) && referenceTextHeight! > 0;
    // Panoramas use their visible picture height as the limiting dimension.
    // Matching a measured inscription takes precedence over geometric guesses.
    const estimate = short * (aspect >= 3 ? .015 : aspect >= 2 ? .017 : .019);
    const title = Math.max(short * .006, Math.min(short * .045, hasReference ? referenceTextHeight! : estimate));
    return {title, caption: title * .58, signature: title * .66, gap: title * .22,
        basis: hasReference ? 'reference-text' : 'image-estimate'};
}
