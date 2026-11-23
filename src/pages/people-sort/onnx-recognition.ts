type Result = { descriptor?: number[]; reason?: string; ready?: boolean };
let worker: Worker | undefined;
let nextId = 0;
let report: ((status: string) => void) | undefined;
const pending = new Map<number, { resolve: (result: Result) => void; reject: (error: Error) => void }>();
export function stopOnnxRecognition() {
    worker?.terminate(); worker=undefined;
    for(const request of pending.values()) request.reject(new Error('识别已停止'));
    pending.clear(); report=undefined;
}
function request(file?:File) {
    if(!worker){
        worker=new Worker(new URL('./onnx.worker.ts',import.meta.url),{type:'module'});
        worker.onmessage=({data})=>{
            if(data.event==='status'){report?.(data.status);return;}
            const task=pending.get(data.id);if(!task)return;
            pending.delete(data.id);
            if(data.error)task.reject(new Error(data.error));else task.resolve(data.result);
        };
        worker.onerror=()=>{
            for(const task of pending.values())task.reject(new Error('浏览器识别引擎运行失败，请更新浏览器并重新导入。'));
            pending.clear();worker?.terminate();worker=undefined;
        };
    }
    const id=++nextId;
    return new Promise<Result>((resolve,reject)=>{pending.set(id,{resolve,reject});worker!.postMessage({id,file});});
}
export async function loadOnnxRecognition(onProgress:(status:string)=>void) {
    if(!window.isSecureContext || !window.Worker || !window.OffscreenCanvas) throw new Error('此浏览器暂不支持本地识别，请使用新版 Chrome、Edge 或 Safari，并通过 HTTPS 或 localhost 打开。');
    report=onProgress;
    await request();
}
export function recognizeOnnx(file: File) {return request(file);}
