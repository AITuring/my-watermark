import type { UniqueIdentifier } from "@dnd-kit/core";
import type { Photo, RenderImageProps } from "react-photo-album";
import type React from "react";

export interface AspectRatio {
    width: number | null;
    height: number | null;
    label: string;
}

export interface SortablePhoto extends Photo {
    id: UniqueIdentifier;
}

export type GalleryImageProps = RenderImageProps;

export type SortablePhotoProps = {
    photo: SortablePhoto;
    imageProps: GalleryImageProps;
    index?: number;
    onPreview?: (index: number) => void;
    wrapperStyle?: React.CSSProperties;
};

export type PhotoFrameProps = SortablePhotoProps & {
    overlay?: boolean;
    active?: boolean;
    insertPosition?: "before" | "after";
    attributes?: Partial<React.HTMLAttributes<HTMLDivElement>>;
    listeners?: Partial<React.HTMLAttributes<HTMLDivElement>>;
    onDelete?: (id: UniqueIdentifier) => void;
    margin?: number;
    radius?: number;
    frameColor?: string;
    frameThickness?: number;
    hasMat?: boolean;
    matColor?: string;
    matSize?: number;
    frameOpacity?: number;
};

export interface ImgProp extends Photo {
    id: string;
    src: string;
    width: number;
    height: number;
    frameColor?: string;
}

export type GalleryLayout = "rows" | "masonry" | "columns";
