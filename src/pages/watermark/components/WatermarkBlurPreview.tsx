import { useMemo } from 'react';
import { Image } from 'react-konva';
import { createBlurredWatermarkBackground, createWatermarkBlurPatch, WATERMARK_BLUR_RADIUS } from '@/utils/watermark-blur';
import { getAdaptiveWatermarkRenderMetrics } from '@/utils/watermark-editor';
import type { WatermarkPosition } from '@/types';

export default function WatermarkBlurPreview({photo, watermark, width, height, position, originalWidth}: {
    photo: HTMLImageElement;
    watermark: HTMLImageElement;
    width: number;
    height: number;
    position: WatermarkPosition;
    originalWidth: number;
}) {
    const blurred = useMemo(() => {
        // Blur once per photo; moving the watermark only rebuilds its small mask.
        const factor = Math.min(1, 1536 / Math.max(photo.naturalWidth, photo.naturalHeight));
        return createBlurredWatermarkBackground(photo, photo.naturalWidth * factor, photo.naturalHeight * factor,
            WATERMARK_BLUR_RADIUS * photo.naturalWidth * factor / (originalWidth || photo.naturalWidth));
    }, [photo, originalWidth]);
    const patch = useMemo(() => {
        const metrics = getAdaptiveWatermarkRenderMetrics(photo.naturalWidth, photo.naturalHeight, watermark, position.scaleX);
        return createWatermarkBlurPatch(blurred, {
            x: position.x * blurred.width, y: position.y * blurred.height,
            width: metrics.width * blurred.width / photo.naturalWidth,
            height: metrics.height * blurred.height / photo.naturalHeight,
        });
    }, [blurred, photo, watermark, position.x, position.y, position.scaleX]);
    return <Image image={patch.canvas} listening={false}
        x={patch.x * width / blurred.width} y={patch.y * height / blurred.height}
        width={patch.width * width / blurred.width} height={patch.height * height / blurred.height} />;
}
