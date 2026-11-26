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
    // The previous 1.9% default made ordinary portrait previews unreadably
    // small (a 1020px short edge produced only ~19px glyphs). Use a stronger
    // editorial caption scale while keeping panoramas restrained.
    const estimate = short * (aspect >= 3 ? .021 : aspect >= 2 ? .026 : .03);
    const title = Math.max(short * .008, Math.min(short * .045, hasReference ? referenceTextHeight! : estimate));
    return {title, caption: title * .58, signature: title * .66, gap: title * .22,
        basis: hasReference ? 'reference-text' : 'image-estimate'};
}

/** Normalize block-relative scale to a fixed glyph height for every layout. */
export function getTextWatermarkScale(imageWidth:number,imageHeight:number,bounds:{width:number;height:number},baseWidth:number,generatedFontSize:number,textScale=1,referenceTextHeight?:number){
    const target=getWatermarkLayoutMetrics(imageWidth,imageHeight,referenceTextHeight).title*Math.max(.1,textScale)/generatedFontSize;
    const factor=Math.min(target,imageWidth*.95/bounds.width,imageHeight*.95/bounds.height);
    return bounds.width*factor/baseWidth;
}

/** Carry a manual resize across changes to the generated text block's footprint. */
export function rebaseTextWatermarkScale(savedScale:number,previousGeneratedScale:number|undefined,generatedScale:number){
    return previousGeneratedScale&&previousGeneratedScale>0
        ? savedScale/previousGeneratedScale*generatedScale
        : generatedScale;
}
