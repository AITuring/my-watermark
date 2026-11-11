import jpegVipsWorkerUrl from '../workers/jpeg-vips.worker?worker&url';

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
let workerPromise: Promise<Worker> | null = null;
let requestId = 0;
const pending = new Map<number, PendingRequest>();

const getWorker = async (): Promise<Worker> => {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('当前浏览器不支持 WASM Worker');
  }
  if (worker) return worker;
  if (workerPromise) return workerPromise;

  // Vite compiles the TypeScript worker to a same-origin classic script.
  workerPromise = (async () => {
    const response = await fetch(jpegVipsWorkerUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`WASM JPEG Worker 加载失败：HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!/javascript|ecmascript/i.test(contentType)) {
      throw new Error(`WASM JPEG Worker 加载失败：返回了 ${contentType || '未知类型'}，预期 JavaScript`);
    }
    await response.body?.cancel();
    const nextWorker = new Worker(jpegVipsWorkerUrl);
    nextWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
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
    nextWorker.onerror = (event) => {
      const detail = event.message || (event.filename ? `${event.filename}:${event.lineno || 0}` : '浏览器未提供脚本错误详情');
      const error = new Error(`WASM JPEG Worker 加载失败（${jpegVipsWorkerUrl}）：${detail}`);
      pending.forEach(({ reject }) => reject(error));
      pending.clear();
      nextWorker.terminate();
      worker = null;
      workerPromise = null;
    };
    worker = nextWorker;
    return nextWorker;
  })().catch((error) => {
    worker = null;
    workerPromise = null;
    throw error instanceof Error ? error : new Error('WASM JPEG Worker 加载失败');
  });
  return workerPromise;
};

const request = (message: WorkerRequest) => new Promise<JpegWasmResult>((resolve, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve, reject });
  void getWorker().then((activeWorker) => {
    try {
      activeWorker.postMessage({ ...message, id });
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error('WASM JPEG 请求失败'));
    }
  }).catch((error) => {
    pending.delete(id);
    reject(error instanceof Error ? error : new Error('WASM JPEG 请求失败'));
  });
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

