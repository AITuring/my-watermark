import { analyzeWatermarkColor } from './adaptive-color';
import type { ImageType, MixedWatermarkConfig, WatermarkPosition } from '@/types';
import { createTextWatermark } from '@/utils/text-watermark';
import { getImageOpaqueBounds, getAdaptiveWatermarkRenderMetrics } from '@/utils/watermark-editor';
import { findSmartWatermarkPosition, loadPositionImage } from './smart-position';
import { getWatermarkLayoutMetrics } from './layout-metrics';

export interface SmartWatermarkResult {
    url: string;
    config: MixedWatermarkConfig;
    position: WatermarkPosition;
}

/** Compare actual watermark footprints rather than guessing orientation from photo aspect. */
export async function createSmartWatermark(
    image: ImageType,
    config: MixedWatermarkConfig,
    overrides: Partial<MixedWatermarkConfig> = {},
): Promise<SmartWatermarkResult> {
    if (!image.previewUrl) throw new Error('图片预览不存在');
    const photo = await loadPositionImage(image.previewUrl);
    const sample = document.createElement('canvas');
    const factor = 320 / Math.max(photo.naturalWidth, photo.naturalHeight);
    sample.width = Math.max(1, Math.round(photo.naturalWidth * factor));
    sample.height = Math.max(1, Math.round(photo.naturalHeight * factor));
    const context = sample.getContext('2d', {willReadFrequently: true});
    if (!context) throw new Error('无法分析图片');
    context.drawImage(photo, 0, 0, sample.width, sample.height);
    let best: (SmartWatermarkResult & {score: number}) | undefined;
    const chosenDirection=overrides.layout||(overrides.horizontalPreset?'horizontal':overrides.verticalPreset?'vertical':undefined);
    const layouts = chosenDirection ? [chosenDirection] : ['horizontal', 'vertical'] as const;
    for (const layout of layouts) {
        const candidateConfig = {...config, layout, color: '#ffffff'};
        const draft = await createTextWatermark(candidateConfig);
        if (!draft) return {url: '', config: candidateConfig, position: {id:image.id,x:0.04,y:0.04,scaleX:1,scaleY:1,rotation:0}};
        const logo = await loadPositionImage(draft);
        const bounds = getImageOpaqueBounds(logo);
        // Resolve ORIGINAL-pixel typography first, then fit the complete block.
        const titleSize = Math.max(24, config.fontSize * 4);
        const metrics=getWatermarkLayoutMetrics(image.width,image.height,config.referenceTextHeight);
        const renderFactor = Math.min(metrics.title / titleSize,
            image.width * 0.65 / bounds.width, image.height * 0.65 / bounds.height);
        const baseWidth = getAdaptiveWatermarkRenderMetrics(image.width, image.height, logo).width;
        const scale = bounds.width * renderFactor / baseWidth;
        const position = findSmartWatermarkPosition(photo, logo, image.id, scale, image.width, image.height, !overrides.color);
        const x = Math.min(sample.width - 1, Math.floor(position.x * sample.width));
        const y = Math.min(sample.height - 1, Math.floor(position.y * sample.height));
        const width = Math.max(1, Math.min(sample.width - x, Math.ceil(bounds.width * renderFactor * sample.width / image.width)));
        const height = Math.max(1, Math.min(sample.height - y, Math.ceil(bounds.height * renderFactor * sample.height / image.height)));
        const {data} = context.getImageData(x,y,width,height);
        let detail = 0;
        const values: number[] = [];
        for (let i=0;i<data.length;i+=4) {
            const rgb = [data[i],data[i+1],data[i+2]].map(v => { const s=v/255; return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4); });
            const lum = rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
            values.push(lum);
            const index=values.length-1;
            if (index%width) detail += Math.abs(lum-values[index-1]);
            if (index>=width) detail += Math.abs(lum-values[index-width]);
        }
        const colorAnalysis = analyzeWatermarkColor(data);
        const color = overrides.color || colorAnalysis.color;
        const centerPenalty = Math.max(0,1-Math.hypot(position.x+width/sample.width/2-0.5,position.y+height/sample.height/2-0.5)*1.4);
        const score = detail / values.length + centerPenalty * 0.06 + (overrides.color ? 0 : (1-colorAnalysis.coverage)*0.5);
        if (!best || score < best.score) {
            const finalConfig = {...candidateConfig,color};
            best = {url:await createTextWatermark(finalConfig),config:finalConfig,position,score};
        }
    }
    if (!best) throw new Error('无法生成智能水印');
    return best;
}
