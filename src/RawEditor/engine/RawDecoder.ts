import { RawImage } from '../types';
import ExifReader from 'exifreader';
import LibRaw from 'libraw-wasm';

export class RawDecoder {
  private static rawEngine: any | null = null;

  private static async getRawEngine() {
    if (!RawDecoder.rawEngine) {
      RawDecoder.rawEngine = new LibRaw();
    }
    return RawDecoder.rawEngine;
  }

  async decode(file: File): Promise<RawImage> {
    // Extract EXIF data
    let exifData: any = {};
    try {
        const tags = await ExifReader.load(file);
        exifData = {
            make: tags['Make']?.description,
            model: tags['Model']?.description,
            lens: tags['LensModel']?.description || tags['Lens']?.description,
            exposureTime: tags['ExposureTime']?.description,
            fNumber: tags['FNumber']?.description,
            iso: tags['ISOSpeedRatings']?.description || tags['ISO']?.description,
            dateTime: tags['DateTimeOriginal']?.description,
        };
    } catch (e) {
        console.warn("Failed to extract EXIF", e);
    }

    // Note: A production implementation would use libraw.wasm or similar to decode RAW files.
    // For this demonstration, we'll implement a fallback that handles standard images
    // and converts them to the linear float32 format expected by our pipeline.

    const isRaw = /\.(cr2|cr3|nef|nrw|arw|sr2|srf|dng|raf|orf|rw2|pef|iiq|3fr|srw)$/i.test(file.name);

    if (isRaw) {
      return this.decodeRawWithLibRaw(file, exifData);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get 2d context'));
            return;
          }

          // Draw image to canvas to get pixel data
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const pixelCount = img.width * img.height;
          const data = new Float32Array(pixelCount * 4); // RGBA

          // Convert sRGB (8-bit) to Linear RGB (Float32)
          for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            const r = imageData.data[idx] / 255.0;
            const g = imageData.data[idx + 1] / 255.0;
            const b = imageData.data[idx + 2] / 255.0;
            const a = imageData.data[idx + 3] / 255.0;

            // Simple Inverse Gamma Correction (approximate sRGB to Linear)
            // Using a simplified gamma of 2.2 for performance in this demo
            data[idx] = Math.pow(r, 2.2);
            data[idx + 1] = Math.pow(g, 2.2);
            data[idx + 2] = Math.pow(b, 2.2);
            data[idx + 3] = a; // Alpha is usually linear
          }

          resolve({
            width: img.width,
            height: img.height,
            data: data,
            metadata: {
                name: file.name,
                type: file.type,
                size: file.size,
                width: img.width,
                height: img.height,
                exif: exifData
            }
          });
        };
        img.onerror = () => reject(new Error("Failed to load image data"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private async decodeRawWithLibRaw(file: File, exifData: any): Promise<RawImage> {
    const buffer = await file.arrayBuffer();
    const raw = await RawDecoder.getRawEngine();

    await raw.open(new Uint8Array(buffer), {
      outputBps: 16,
      outputColor: 1,
      noAutoBright: true,
      useCameraWb: true,
      useAutoWb: false,
      userQual: 11,
      highlight: 2,
      fbddNoiserd: 1
    });

    const [meta, decoded] = await Promise.all([
      raw.metadata(false),
      raw.imageData()
    ]);

    const width = decoded?.width ?? decoded?.sizes?.width ?? meta?.sizes?.width;
    const height = decoded?.height ?? decoded?.sizes?.height ?? meta?.sizes?.height;

    if (!width || !height) {
      throw new Error('libraw-wasm decode succeeded but width/height missing');
    }

    const source = decoded?.data ?? decoded?.pixels ?? decoded;
    if (!source) {
      throw new Error('libraw-wasm decode succeeded but pixel buffer missing');
    }

    const channels = decoded?.channels ?? decoded?.components ?? 3;
    const typed = source instanceof Uint16Array || source instanceof Uint8Array
      ? source
      : source?.buffer
        ? new Uint8Array(source.buffer)
        : new Uint8Array(source);

    const is16Bit = typed instanceof Uint16Array || decoded?.outputBps === 16 || decoded?.bitsPerSample === 16 || typed.BYTES_PER_ELEMENT === 2;
    const max = is16Bit ? 65535 : 255;
    const pixelCount = width * height;
    const data = new Float32Array(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const src = i * channels;
      const dst = i * 4;

      const r = (typed[src] ?? 0) / max;
      const g = (typed[src + 1] ?? r) / max;
      const b = (typed[src + 2] ?? g) / max;

      data[dst] = Math.pow(Math.min(Math.max(r, 0), 1), 2.2);
      data[dst + 1] = Math.pow(Math.min(Math.max(g, 0), 1), 2.2);
      data[dst + 2] = Math.pow(Math.min(Math.max(b, 0), 1), 2.2);
      data[dst + 3] = 1;
    }

    await raw.close?.();

    return {
      width,
      height,
      data,
      metadata: {
        name: file.name,
        type: file.type || 'image/x-raw',
        size: file.size,
        width,
        height,
        exif: {
          ...exifData,
          ...meta
        }
      }
    };
  }
}
