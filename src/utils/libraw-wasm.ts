interface WorkerResponseMessage {
    out?: unknown;
    error?: unknown;
}

function collectTransferables(args: unknown[]) {
    return args
        .map((value) => {
            if (value instanceof ArrayBuffer) {
                return value;
            }
            if (
                value instanceof Uint8Array ||
                value instanceof Int8Array ||
                value instanceof Uint16Array ||
                value instanceof Int16Array ||
                value instanceof Uint32Array ||
                value instanceof Int32Array ||
                value instanceof Float32Array ||
                value instanceof Float64Array
            ) {
                return value.buffer;
            }
            return null;
        })
        .filter((value): value is ArrayBuffer => value instanceof ArrayBuffer);
}

export default class LibRawWorkerClient {
    private worker: Worker;

    private pendingRequest:
        | {
              resolve: (value: unknown) => void;
              reject: (reason?: unknown) => void;
          }
        | null = null;

    constructor(workerUrl = "/libraw-wasm/worker.js") {
        this.worker = new Worker(workerUrl, { type: "module" });
        this.worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
            const { out, error } = event.data ?? {};
            if (!this.pendingRequest) {
                return;
            }
            const pending = this.pendingRequest;
            this.pendingRequest = null;
            if (error) {
                pending.reject(error);
                return;
            }
            pending.resolve(out);
        };
        this.worker.onerror = (event) => {
            const error = event.error ?? new Error(event.message || "RAW worker error");
            this.pendingRequest?.reject(error);
            this.pendingRequest = null;
        };
    }

    private runFn(fn: string, ...args: unknown[]) {
        const transferables = collectTransferables(args);
        return new Promise<unknown>((resolve, reject) => {
            if (this.pendingRequest) {
                reject(new Error("RAW worker is busy"));
                return;
            }
            this.pendingRequest = { resolve, reject };
            this.worker.postMessage({ fn, args }, transferables);
        });
    }

    async open(data: Uint8Array, settings: Record<string, unknown>) {
        await this.runFn("open", data, settings);
    }

    async metadata(fullOutput = false) {
        return this.runFn("metadata", fullOutput);
    }

    async imageData() {
        return this.runFn("imageData");
    }

    async close() {
        this.worker.terminate();
        this.pendingRequest?.reject(new Error("RAW worker closed"));
        this.pendingRequest = null;
    }
}
