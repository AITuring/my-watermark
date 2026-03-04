import { RawImage } from '../types';
import ExifReader from 'exifreader';

export class RawDecoder {
  /**
   * Decodes an image file (RAW or standard) into a 32-bit floating point linear RGB buffer.
   */
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

    // Check if it's a RAW file by extension (simplified)
    const isRaw = /\.(cr2|nef|arw|dng|orf|rw2)$/i.test(file.name);

    if (isRaw) {
        // TODO: Integrate libraw.wasm here.
        // For now, we'll try to use a placeholder or fail gracefully if we can't decode.
        // Since we can't easily include the WASM binary in this text-based response,
        // we will fall back to standard image loading but warn the user.
        console.warn("RAW decoding requires libraw.wasm. Falling back to browser decoding if possible.");
        // Many browsers can't decode RAW natively, so this might fail or show a preview.
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
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }
}
