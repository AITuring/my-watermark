import {
    ImageType,
    ImgWithPosition,
    MixedWatermarkConfig,
    WatermarkPosition,
} from "@/types";

export const DEFAULT_WATERMARK_URL = "/logo.png";

export const DEFAULT_MIXED_WATERMARK_CONFIG: MixedWatermarkConfig = {
    enabled: true,
    icon: DEFAULT_WATERMARK_URL,
    textLine1: "第一行文字",
    textLine2: "第二行文字",
    color: "#000000",
    fontSize: 30,
    gap: 20,
    layout: "horizontal",
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
