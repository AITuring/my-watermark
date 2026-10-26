import { toast } from 'sonner';

const MAX_BROWSER_PIXELS = 80_000_000;
const MAX_BROWSER_SIDE = 16_384;

export type LargeImageAsset = { id: string; width: number; height: number; previewUrl: string };
const pending = new WeakMap<File, Promise<LargeImageAsset | null>>();
const activeIds = new Set<string>();
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const id of activeIds) {
      void fetch(`/__local_split/item/${id}`, { method: 'DELETE', keepalive: true });
    }
    activeIds.clear();
  });
}

async function jpegDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!/\.jpe?g$/i.test(file.name) && file.type !== 'image/jpeg') return null;
  const view = new DataView(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > view.byteLength) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    }
    offset += length;
  }
  return null;
}

export async function isLargeJpeg(file: File): Promise<boolean> {
  const size = await jpegDimensions(file);
  return Boolean(size && (size.width * size.height > MAX_BROWSER_PIXELS ||
    Math.max(size.width, size.height) > MAX_BROWSER_SIDE));
}

export async function getLargeImageAsset(file: File): Promise<LargeImageAsset | null> {
  let task = pending.get(file);
  if (!task) {
    task = (async () => {
      if (!await isLargeJpeg(file)) return null;
      const toastId = `large-image-${Date.now()}-${Math.random()}`;
      toast.loading(`正在传入大图：${file.name}`, { id: toastId });
      try {
        const data = await new Promise<LargeImageAsset>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open('POST', '/__local_split/import');
          request.setRequestHeader('Content-Type', 'image/jpeg');
          request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              toast.loading(`正在传入大图：${file.name} · ${Math.round(event.loaded / event.total * 100)}%`, { id: toastId });
            }
          };
          request.upload.onload = () => toast.loading(`正在生成大图预览：${file.name}`, { id: toastId });
          request.onerror = () => reject(new Error('本地大图服务不可用。请通过本机开发服务打开应用。'));
          request.onload = () => {
            let payload: Partial<LargeImageAsset> & { error?: string } = {};
            try { payload = JSON.parse(request.responseText); } catch { /* handled below */ }
            if (request.status < 200 || request.status >= 300 || !payload.id ||
              !payload.width || !payload.height || !payload.previewUrl) {
              reject(new Error(payload.error || '本地大图服务不可用。请通过本机开发服务打开应用。'));
              return;
            }
            resolve(payload as LargeImageAsset);
          };
          request.send(file);
        });
        activeIds.add(data.id);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : '本地大图导入失败';
        toast.error(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        toast.dismiss(toastId);
      }
    })();
    pending.set(file, task);
    task.catch(() => pending.delete(file));
  }
  return task;
}

export async function processLargeImage(
  file: File,
  options: { crop?: { x: number; y: number; width: number; height: number };
    rotate?: number; width?: number; height?: number; quality?: number; format?: 'jpeg' | 'png' | 'webp';
    mosaic?: Array<{ x: number; y: number; width: number; height: number; blockSize: number }> }
): Promise<Blob | null> {
  const asset = await getLargeImageAsset(file);
  if (!asset) return null;
  const response = await fetch(`/__local_split/process/${asset.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || '大图处理失败');
  }
  return response.blob();
}

export async function compositeLargeImage(
  file: File, overlay: Blob,
  options: { x: number; y: number; quality: number; blur: boolean }
): Promise<Blob | null> {
  const asset = await getLargeImageAsset(file);
  if (!asset) return null;
  const query = new URLSearchParams({ x: String(options.x), y: String(options.y),
    quality: String(options.quality), blur: options.blur ? '1' : '0' });
  const response = await fetch(`/__local_split/composite/${asset.id}?${query}`, {
    method: 'POST', headers: { 'Content-Type': 'image/png' }, body: overlay,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || '大图水印处理失败');
  }
  return response.blob();
}

export async function releaseLargeImage(file: File): Promise<void> {
  const task = pending.get(file);
  pending.delete(file);
  const asset = await task?.catch(() => null);
  if (asset) {
    activeIds.delete(asset.id);
    await fetch(`/__local_split/item/${asset.id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
