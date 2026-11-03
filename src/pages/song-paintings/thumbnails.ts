import rawThumbnails from "./thumbnails.json";

export interface ArtworkThumbnailData {
    id: string;
    src: string;
    previewSrc: string;
    width: number;
    height: number;
    previewPartial: boolean;
}

const thumbnailsByArtwork = new Map<string, ArtworkThumbnailData>(rawThumbnails.items.map((item) => [item.id, item]));

export function getArtworkThumbnail(artworkId: string): ArtworkThumbnailData | undefined {
    return thumbnailsByArtwork.get(artworkId);
}
