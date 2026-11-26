interface ImageType {
    id: string;
    file: File;
    previewUrl?: string;
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
    textOnly?: boolean;
    fontId?: string;
    captionFontId?: string;
    letterSpacing?: number;
    lineGap?: number;
    iconScale?: number;
    referenceTextHeight?: number;
    icon: string; // URL of the icon
    textLine1: string;
    textLine2: string;
    color: string;
    /** Optional independent icon/logo color; text continues to use color. */
    iconColor?: string;
    fontSize: number;
    gap: number;
    layout?: 'horizontal' | 'vertical';
    horizontalPreset?: 'single' | 'paired' | 'centered';
    verticalPreset?: 'single' | 'paired';
    singleLineOrder?: 'title-first' | 'era-first';
    /** One-line layouts: the exact line to draw. When defined it replaces title and caption. */
    singleLineText?: string;
    /** false keeps hand-edited lines as typed instead of moving a long caption's era into the first line. */
    promoteEra?: boolean;
    textScale?: number;
    textHorizontalScale?: number;
    compactMode?: boolean;
    compactAuthor?: string;
    authorFontId?: string;
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
