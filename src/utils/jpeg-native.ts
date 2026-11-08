export interface JpegNativeRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const encodeBitmap = async (bitmap: ImageBitmap): Promise<Blob> => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建 JPEG 切片画布');
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('浏览器无法编码 JPEG 切片')), 'image/jpeg', 0.9);
    });
  } finally {
    bitmap.close();
  }
};

export const createJpegNativePreview = async (
  file: File,
  width: number,
  height: number,
  maxDimension = 2400
): Promise<Blob> => {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const bitmap = await createImageBitmap(file, 0, 0, width, height, {
    resizeWidth: Math.max(1, Math.round(width * scale)),
    resizeHeight: Math.max(1, Math.round(height * scale)),
    imageOrientation: 'none',
  });
  return encodeBitmap(bitmap);
};

export const cropJpegNatively = async (file: File, region: JpegNativeRegion): Promise<Blob> => {
  const bitmap = await createImageBitmap(file, region.x, region.y, region.width, region.height, {
    imageOrientation: 'none',
  });
  return encodeBitmap(bitmap);
};
