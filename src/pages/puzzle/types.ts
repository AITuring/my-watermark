import type React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import type { Photo, RenderImageProps } from "react-photo-album";

export interface AspectRatio {
    width: number;
    height: number;
    label: string;
}

export interface SortablePhoto extends Photo {
    id: UniqueIdentifier;
}

export type SortablePhotoProps = {
    photo: SortablePhoto;
    imageProps: RenderImageProps;
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
};

export interface ImgProp {
    id: string;
    src: string;
    width: number;
    height: number;
}

export type PuzzleLayout = "rows" | "masonry" | "columns";
