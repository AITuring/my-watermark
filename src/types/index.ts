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

export type { ImageType,WatermarkPosition, ImgWithPosition }
