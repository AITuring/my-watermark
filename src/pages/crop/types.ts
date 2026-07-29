export type CropMode = "fixed" | "ratio" | "free";
export type DragMode = "new" | "move" | "nw" | "ne" | "sw" | "se";

export type CropBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};

export type CropImage = {
    id: string;
    name: string;
    url: string;
    previewUrl: string;
    previewWidth: number;
    previewHeight: number;
    width: number;
    height: number;
    crop: CropBox;
};

export type SavedCrop = {
    id: string;
    sourceImageId: string;
    sourceName: string;
    index: number;
    previewUrl: string;
    outputW: number;
    outputH: number;
    file: File;
};

export type SavedCropGroup = {
    sourceImageId: string;
    sourceName: string;
    items: SavedCrop[];
};

export type DragState = {
    active: boolean;
    mode: DragMode;
    startPoint: { x: number; y: number };
    startCrop: CropBox | null;
};

export type EditorPreview = {
    url: string;
    width: number;
    height: number;
};

export type CropPercent = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type ViewportRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type ViewportSize = {
    width: number;
    height: number;
};

export const ratioOptions = [
    { label: "1:1", value: 1 },
    { label: "15:8", value: 15 / 8 },
    { label: "4:3", value: 4 / 3 },
    { label: "3:4", value: 3 / 4 },
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "16:10", value: 16 / 10 },
    { label: "10:16", value: 10 / 16 },
    { label: "2:1", value: 2 },
    { label: "1:2", value: 0.5 },
    { label: "自定义", value: 1 },
] as const;
