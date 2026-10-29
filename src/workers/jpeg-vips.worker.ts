type VipsImage = {
  width: number;
  height: number;
  crop: (left: number, top: number, width: number, height: number) => VipsImage;
  writeToBuffer: (format: string, options?: Record<string, unknown>) => Uint8Array;
  delete: () => void;
};

type VipsSource = {
  onRead: (length: number) => Blob | Uint8Array | undefined;
  onSeek: (offset: number, whence: number) => number;
  delete: () => void;
};

type VipsApi = {
  SourceCustom: new () => VipsSource;
  Image: {
    newFromSource: (
      source: VipsSource,
      options?: string,
      loadOptions?: Record<string, unknown>
    ) => VipsImage;
    thumbnailSource: (
      source: VipsSource,
      width: number,
      options?: Record<string, unknown>
    ) => VipsImage;
  };
};

type RequestMessage = {
  id: number;
  type: 'preview' | 'tile';
  file: File;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  maxDimension?: number;
};

type ResponseMessage =
  | { id: number; type: 'result'; buffer: ArrayBuffer; width: number; height: number }
  | { id: number; type: 'error'; message: string };

declare class FileReaderSync {
  readAsArrayBuffer(blob: Blob): ArrayBuffer;
}

let vipsPromise: Promise<VipsApi> | null = null;

// Keep browser-side reads bounded. libvips may ask for a very large read from
// a custom source; slicing the File in smaller chunks avoids a transient
// ArrayBuffer allocation proportional to the compressed JPEG size.
const MAX_SOURCE_READ_BYTES = 8 * 1024 * 1024;

const getVips = async (): Promise<VipsApi> => {
  if (!vipsPromise) {
    vipsPromise = (async () => {
      const moduleUrl = new URL('/wasm-vips/vips-es6.js', self.location.origin).href;
      const module = await import(/* @vite-ignore */ moduleUrl) as { default: (options?: Record<string, unknown>) => Promise<VipsApi> };
      return module.default({
        // JPEG support is built into the core module. Avoid fetching optional
        // HEIF/JXL plugins on first use; they are not needed by /split.
        dynamicLibraries: [],
        locateFile: (path: string) => new URL(`/wasm-vips/${path}`, self.location.origin).href,
      });
    })();
  }
  return vipsPromise;
};

const createSource = (vips: VipsApi, file: File): VipsSource => {
  let position = 0;
  const reader = new FileReaderSync();
  const source = new vips.SourceCustom();
  source.onRead = (length) => {
    if (position >= file.size) return undefined;
    const requested = Math.max(1, Math.min(MAX_SOURCE_READ_BYTES, length));
    const chunk = file.slice(position, Math.min(file.size, position + requested));
    position += chunk.size;
    return new Uint8Array(reader.readAsArrayBuffer(chunk));
  };
  source.onSeek = (offset, whence) => {
    const base = whence === 1 ? position : whence === 2 ? file.size : 0;
    const next = base + offset;
    if (!Number.isFinite(next) || next < 0 || next > file.size) return -1;
    position = next;
    return position;
  };
  return source;
};

const writeJpeg = (image: VipsImage) => {
  const bytes = image.writeToBuffer('.jpg', { Q: 90, strip: true });
  return new Uint8Array(bytes).slice().buffer as ArrayBuffer;
};

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  const request = event.data;
  try {
    if (!request?.file || !Number.isFinite(request.id)) throw new Error('WASM 请求参数无效');
    const vips = await getVips();
    const source = createSource(vips, request.file);
    let image: VipsImage | null = null;
    try {
      if (request.type === 'preview') {
        image = vips.Image.thumbnailSource(source, Math.max(320, request.maxDimension ?? 2400), {
          size: 'down',
          // Keep the JPEG's stored coordinate system aligned with the header
          // dimensions used by the split plan. EXIF autorotation would swap
          // crop axes without changing the plan coordinates.
          no_rotate: true,
        });
      } else {
        const width = Math.max(1, Math.floor(request.width ?? 0));
        const height = Math.max(1, Math.floor(request.height ?? 0));
        const x = Math.max(0, Math.floor(request.x ?? 0));
        const y = Math.max(0, Math.floor(request.y ?? 0));
        // JPEG is decoded top-to-bottom. Sequential access lets libvips keep
        // a bounded scanline cache instead of materialising a random-access
        // image for every tile, which is critical for 300–800MB files.
        const fullImage = vips.Image.newFromSource(source, '', { access: 'sequential' });
        try {
          image = fullImage.crop(x, y, width, height);
        } finally {
          fullImage.delete();
        }
      }
      const buffer = writeJpeg(image);
      const response: ResponseMessage = {
        id: request.id,
        type: 'result',
        buffer,
        width: image.width,
        height: image.height,
      };
      (self as unknown as { postMessage: (message: ResponseMessage, transfer?: Transferable[]) => void })
        .postMessage(response, [buffer]);
    } finally {
      image?.delete();
      source.delete();
    }
  } catch (error) {
    const response: ResponseMessage = {
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : 'WASM JPEG 解码失败',
    };
    self.postMessage(response);
  }
};

