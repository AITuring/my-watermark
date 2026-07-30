export type ZipInstance = {
  file: (name: string, data: Blob | File) => void;
  generateAsync: (options: { type: 'blob' }) => Promise<Blob>;
};

export type ZipConstructor = new () => ZipInstance;

export interface CompressedImage {
  id: string;
  originalFile: File;
  compressedFile: File | null;
  originalSize: number;
  compressedSize: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number | null;
  outputHeight: number | null;
  targetSizeMB: number;
  resizePercent: number;
  outputScalePercent: number | null;
  preview: string;
}

export interface CompressionConfig {
  targetSizeMB: number;
  resizePercent: number;
}

export type CompressionAction = 'normal' | 'force' | 'single' | null;

export type ImageConfigPatch = Partial<Pick<CompressedImage, 'targetSizeMB' | 'resizePercent'>>;

export type CompressionResult = {
  file: File;
  outputScalePercent: number;
  outputWidth: number;
  outputHeight: number;
};
