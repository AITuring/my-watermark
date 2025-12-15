interface ImageType {
    id: string;
    file: File;
    width: number;
    height: number;
}

interface WatermarkPosition {
    id: string;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
}


interface ImgWithPosition {
    id: string;
    file: File;
    position: WatermarkPosition;
}

interface MixedWatermarkConfig {
    enabled: boolean;
    icon: string; // URL of the icon
    textLine1: string;
    textLine2: string;
    color: string;
    fontSize: number;
    gap: number;
    layout?: 'horizontal' | 'vertical';
}

interface TextWatermarkConfig {
    enabled: boolean;
    content: string;
    color: string;
    fontSize: number;
    isVertical: boolean;
    opacity?: number;
    fontFamily?: string;
    gap?: number;
}

export type { ImageType, WatermarkPosition, ImgWithPosition, MixedWatermarkConfig, TextWatermarkConfig };
