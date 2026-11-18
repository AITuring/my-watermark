import {
    ImageType,
    ImgWithPosition,
    MixedWatermarkConfig,
    WatermarkPosition,
} from "@/types";

export const DEFAULT_WATERMARK_URL = "/logo.png";
export const DEFAULT_SYMBOL_URL = "/watermark-symbol.png";
// The anti-theft layer uses the full image watermark (symbol plus caption),
// while keeping its own opacity, size and color controls.
export const DEFAULT_TRANSPARENT_WATERMARK_URL = DEFAULT_WATERMARK_URL;
export const DEFAULT_COPYRIGHT_STATEMENT = "笑谈间气吐霓虹";

export const DEFAULT_MIXED_WATERMARK_CONFIG: MixedWatermarkConfig = {
    enabled: true,
    icon: DEFAULT_SYMBOL_URL,
    textLine1: "",
    textLine2: "",
    color: "#000000",
    fontSize: 30,
    gap: 20,
    layout: "horizontal",
    horizontalPreset: "single",
    verticalPreset: "single",
    letterSpacing: 0.1,
    lineGap: 0.55,
};

export const createDefaultWatermarkPosition = (
    id: string
): WatermarkPosition => ({
    id,
    x: 0.5,
    y: 0.5,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
});

export const buildWatermarkPositions = (
    images: ImageType[]
): WatermarkPosition[] =>
    images.map((img) => createDefaultWatermarkPosition(img.id));

export const buildWatermarkColorMap = (
    images: ImageType[]
): Record<string, string> =>
    Object.fromEntries(images.map((img) => [img.id, ""]));

export const buildImagesWithPositions = (
    images: ImageType[],
    watermarkPositions: WatermarkPosition[]
): ImgWithPosition[] =>
    images.map((img) => ({
        id: img.id,
        file: img.file,
        position:
            watermarkPositions.find((pos) => pos.id === img.id) ||
            createDefaultWatermarkPosition(img.id),
    }));

export const getTopStackPreviews = (images: ImageType[]) =>
    images
        .slice(0, 3)
        .filter((img) => img.previewUrl)
        .map((img) => ({
            id: img.id,
            url: img.previewUrl!,
        }));

export function applyWatermarkConfigPatch(
    previous: Record<string, Partial<MixedWatermarkConfig>>,
    imageIds: string[],
    patch: Partial<MixedWatermarkConfig>,
): Record<string, Partial<MixedWatermarkConfig>> {
    const next = {...previous};
    const unifiedPatch=unifyWatermarkFontPatch(patch);
    imageIds.forEach(id => { next[id] = {...previous[id], ...unifiedPatch}; });
    return next;
}

export function unifyWatermarkFontPatch(patch:Partial<MixedWatermarkConfig>):Partial<MixedWatermarkConfig> {
    const fontId=patch.fontId??patch.captionFontId;
    return fontId===undefined?patch:{...patch,fontId,captionFontId:fontId};
}
