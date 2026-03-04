export interface ImageState {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  sharpness: number;
  curve: { x: number; y: number }[];
}

export const defaultImageState: ImageState = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 5500,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  sharpness: 0,
  curve: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
};

export interface RawMetadata {
  name: string;
  type: string;
  size: number;
  exif: {
    make?: string;
    model?: string;
    lens?: string;
    exposureTime?: string;
    fNumber?: string;
    iso?: string;
    dateTime?: string;
    [key: string]: any;
  };
}

export interface RawImage {
  width: number;
  height: number;
  data: Float32Array; // 32-bit float linear RGB, interleaved (R, G, B, A)
  metadata: RawMetadata;
}
