import { RawImage } from '../types';
import ExifReader from 'exifreader';

type LibRawImageData = {
  width?: number;
  height?: number;
  sizes?: { width?: number; height?: number };
  channels?: number;
  components?: number;
  outputBps?: number;
  bitsPerSample?: number;
  data?: Uint8Array | Uint16Array | ArrayLike<number>;
  pixels?: Uint8Array | Uint16Array | ArrayLike<number>;
} & Record<string, any>;

type DecodeAttemptResult = {
  meta: Record<string, any>;
  width: number;
  height: number;
  channels: number;
  bps: number;
  pixels: Uint8Array | Uint16Array;
};

export class RawDecoder {
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`RAW ${label} timeout`)), ms);
      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
    });
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
      const strategy = ((import.meta as any).env?.VITE_RAW_DECODE_STRATEGY as string | undefined) || 'backend-first';

      if (strategy === 'wasm-first') {
        try {
          return await this.decodeRawWithLibRaw(file, exifData);
        } catch (e) {
          console.warn('libraw-wasm decode failed, fallback to backend', e);
          return this.decodeRawWithBackend(file, exifData);
        }
      }

      try {
        return await this.decodeRawWithBackend(file, exifData);
      } catch (e) {
        console.warn('backend RAW decode failed, fallback to libraw-wasm', e);
        return this.decodeRawWithLibRaw(file, exifData);
      }
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

  private async decodeRawWithBackend(file: File, exifData: any): Promise<RawImage> {
    const apiBase = ((import.meta as any).env?.VITE_RAW_API_BASE_URL as string | undefined) || 'http://localhost:8000';
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 90000);
    const response = await fetch(`${apiBase}/api/raw/decode`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timer);
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `Backend RAW decode failed: ${response.status}`);
    }

    const payload = await response.json();
    const width = Number(payload?.width || 0);
    const height = Number(payload?.height || 0);
    const channels = Number(payload?.channels || 3);
    const bps = Number(payload?.bps || 16);
    const pixelsBase64 = payload?.pixels as string | undefined;

    if (!width || !height || !pixelsBase64) {
      throw new Error('Backend RAW decode returned invalid payload');
    }

    const binary = atob(pixelsBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const typed = bps === 16
      ? new Uint16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2))
      : bytes;

    const max = bps === 16 ? 65535 : 255;
    const pixelCount = width * height;
    const data = new Float32Array(pixelCount * 4);

    let peak = 0;
    const sampleStep = Math.max(1, Math.floor(pixelCount / 50000));
    for (let i = 0; i < pixelCount; i += sampleStep) {
      const src = i * channels;
      const r = (typed[src] ?? 0) / max;
      const g = (typed[src + 1] ?? r) / max;
      const b = (typed[src + 2] ?? g) / max;
      const p = Math.max(r, g, b);
      if (p > peak) peak = p;
    }
    const gain = peak > 0 ? Math.min(6, 0.9 / peak) : 1;

    for (let i = 0; i < pixelCount; i++) {
      const src = i * channels;
      const dst = i * 4;
      const r = Math.min(Math.max(((typed[src] ?? 0) / max) * gain, 0), 1);
      const g = Math.min(Math.max(((typed[src + 1] ?? typed[src] ?? 0) / max) * gain, 0), 1);
      const b = Math.min(Math.max(((typed[src + 2] ?? typed[src + 1] ?? typed[src] ?? 0) / max) * gain, 0), 1);
      data[dst] = r;
      data[dst + 1] = g;
      data[dst + 2] = b;
      data[dst + 3] = 1;
    }

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
          ...(payload?.metadata?.exif || {})
        }
      }
    };
  }

  private async decodeRawWithLibRaw(file: File, exifData: any): Promise<RawImage> {
    const { default: LibRaw } = await import('libraw-wasm');
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const openTimeoutMs = Math.max(45000, Math.ceil(file.size / (1024 * 1024)) * 1200);

    const decodeOnce = async (settings: Record<string, unknown>, timeoutMs: number): Promise<DecodeAttemptResult> => {
      const raw = new LibRaw();
      try {
        const inputBytes = sourceBytes.slice();
        await this.withTimeout(raw.open(inputBytes, settings), openTimeoutMs, 'open');

        const [metaRaw, decodedRaw] = await Promise.all([
          this.withTimeout<Record<string, any>>(raw.metadata(false) as Promise<Record<string, any>>, 8000, 'metadata').catch(() => ({})),
          this.withTimeout<unknown>(raw.imageData() as Promise<unknown>, timeoutMs, 'imageData')
        ]);

        const meta = metaRaw || {};
        const decoded = (decodedRaw || {}) as LibRawImageData;

        const width = decoded.width ?? decoded.sizes?.width ?? meta.sizes?.width;
        const height = decoded.height ?? decoded.sizes?.height ?? meta.sizes?.height;
        const channels = decoded.channels ?? decoded.components ?? 3;
        const bps = decoded.outputBps ?? decoded.bitsPerSample ?? 16;
        const source = decoded.data ?? decoded.pixels ?? (decoded as ArrayLike<number>);

        if (!source) {
          throw new Error('libraw-wasm decode succeeded but pixel buffer missing');
        }

        const view = source instanceof Uint16Array || source instanceof Uint8Array
          ? source
          : source?.buffer
            ? (bps === 16 ? new Uint16Array(source.buffer) : new Uint8Array(source.buffer))
            : (bps === 16 ? new Uint16Array(source) : new Uint8Array(source));

        const stablePixels = bps === 16 ? new Uint16Array(view.length) : new Uint8Array(view.length);
        stablePixels.set(view as any);

        return { meta, width, height, channels, bps, pixels: stablePixels };
      } finally {
        await raw.close?.();
      }
    };

    let result: DecodeAttemptResult;
    try {
      result = await decodeOnce({
        outputBps: 16,
        outputColor: 1,
        noAutoBright: true,
        useCameraWb: true,
        useAutoWb: false,
        userQual: 5,
        highlight: 2,
        fbddNoiserd: 1
      }, 45000);
    } catch {
      result = await decodeOnce({
        outputBps: 16,
        outputColor: 1,
        noAutoBright: true,
        useCameraWb: true,
        useAutoWb: false,
        userQual: 3,
        highlight: 1,
        fbddNoiserd: 0,
        halfSize: true
      }, 25000);
    }

    const { meta, width, height, channels, bps, pixels: typed } = result;

    if (!width || !height) {
      throw new Error('libraw-wasm decode succeeded but width/height missing');
    }

    const max = bps === 16 ? 65535 : 255;
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
