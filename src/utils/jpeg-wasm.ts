export interface JpegWasmRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface JpegWasmResult {
  blob: Blob;
  width: number;
  height: number;
}

type WorkerResponse =
  | { id: number; type: 'result'; buffer: ArrayBuffer; width: number; height: number }
  | { id: number; type: 'error'; message: string };

type PendingRequest = {
  resolve: (result: JpegWasmResult) => void;
  reject: (error: Error) => void;
};

type WorkerRequest = {
  type: 'preview' | 'tile';
  file: File;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  maxDimension?: number;
};

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, PendingRequest>();

const getWorker = () => {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('当前浏览器不支持 WASM Worker');
  }
  if (worker) return worker;
  // Vite emits this worker as a self-contained IIFE. Keep it a classic
  // worker so browsers do not reject the generated asset when the CDN serves
  // it without the module-worker MIME metadata. The worker loads vips-es6.js
  // itself with a fully qualified dynamic import.
  worker = new Worker(new URL('../workers/jpeg-vips.worker.ts', import.meta.url));
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.type === 'error') {
      request.reject(new Error(message.message));
      return;
    }
    request.resolve({
      blob: new Blob([message.buffer], { type: 'image/jpeg' }),
      width: message.width,
      height: message.height,
    });
  };
  worker.onerror = (event) => {
    const detail = event.message || (event.filename ? `${event.filename}:${event.lineno || 0}` : '');
    const error = new Error(detail ? `WASM JPEG Worker 加载失败：${detail}` : 'WASM JPEG Worker 加载失败');
    pending.forEach(({ reject }) => reject(error));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
};

const request = (message: WorkerRequest) => new Promise<JpegWasmResult>((resolve, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve, reject });
  try {
    getWorker().postMessage({ ...message, id });
  } catch (error) {
    pending.delete(id);
    reject(error instanceof Error ? error : new Error('WASM JPEG 请求失败'));
  }
});

export const createJpegWasmPreview = (file: File, maxDimension = 2400) => request({
  type: 'preview',
  file,
  maxDimension,
});

export const cropJpegWithWasm = (file: File, region: JpegWasmRegion) => request({
  type: 'tile',
  file,
  ...region,
});

