import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import mjsUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import { decodeYuNet, suppress, similarity, planarRGB, normalizeFeature, type OnnxFace } from './onnx-math';

ort.env.wasm.numThreads = 1; // No cross-origin isolation or SharedArrayBuffer requirement.
ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.origin).href, mjs: new URL(mjsUrl, self.location.origin).href };
ort.env.wasm.proxy = false;
let detector: ort.InferenceSession;
let recognizer: ort.InferenceSession;
let initialized: Promise<void> | undefined;
const progress = (status: string) => self.postMessage({ event: 'status', status });
const MODEL_FILES = [
    ['yunet.onnx', '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4'],
    ['sface.onnx', '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79'],
];
async function modelBytes(filename: string, hash: string) {
    const url = new URL(`${import.meta.env.BASE_URL}models/people-sort/onnx/${filename}`, self.location.origin).href;
    const cache = typeof caches === 'undefined' ? undefined : await caches.open('people-sort-onnx-v1').catch(() => undefined);
    const cached = await cache?.match(url).catch(() => undefined);
    const response = cached || await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw new Error(`模型下载失败：${filename}（${response.status}）`);
    const bytes = await response.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
    if (digest !== hash) {
        await cache?.delete(url).catch(() => undefined);
        throw new Error(`模型校验失败：${filename}，请重新加载后重试`);
    }
    if (!cached) await cache?.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })).catch(() => undefined);
    return bytes;
}
async function initialize() {
    if (!initialized) initialized = (async () => {
        progress('正在下载或读取缓存的人脸模型（约 37 MB）…');
        const weights = await Promise.all(MODEL_FILES.map(([file, hash]) => modelBytes(file, hash)));
        progress('正在初始化浏览器识别引擎…');
        detector = await ort.InferenceSession.create(weights[0], { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
        try { recognizer = await ort.InferenceSession.create(weights[1], { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); }
        catch (error) { await detector.release(); throw error; }
    })().catch(error => { initialized = undefined; throw error; });
    await initialized;
}
function canvas(width: number, height: number) { return new OffscreenCanvas(width, height); }
const detectorCanvas = canvas(640,640);
async function detect(source: ImageBitmap | OffscreenCanvas, x = 0, y = 0, width = source.width, height = source.height): Promise<OnnxFace[]> {
    const context = detectorCanvas.getContext('2d', { willReadFrequently: true })!;
    const scale = Math.min(640 / width, 640 / height);
    const drawWidth = Math.max(1, Math.round(width * scale)), drawHeight = Math.max(1, Math.round(height * scale));
    context.fillStyle = '#000'; context.fillRect(0,0,640,640);
    context.drawImage(source,x,y,width,height,0,0,drawWidth,drawHeight);
    const input = new ort.Tensor('float32', planarRGB(context.getImageData(0,0,640,640).data, true), [1,3,640,640]);
    let outputs: ort.InferenceSession.OnnxValueMapType;
    try { outputs = await detector.run({ [detector.inputNames[0]]: input }); }
    finally { input.dispose(); }
    try {
        return decodeYuNet(Object.fromEntries(Object.entries(outputs).map(([name,value])=>[name,{data:value.data as Float32Array}]))).filter(face => face.x + face.width/2 < drawWidth && face.y + face.height/2 < drawHeight).map(face => ({
            ...face, x:face.x/scale+x, y:face.y/scale+y, width:face.width/scale, height:face.height/scale,
            points:face.points.map((v,i)=>v/scale+(i%2?y:x)),
        }));
    } finally { Object.values(outputs).forEach(value => value.dispose()); }
}
function positions(length: number, tile: number) {
    if (length <= tile) return [0];
    const count = Math.ceil((length-tile)/(tile*0.8));
    return Array.from({length:count+1},(_,i)=>Math.round((length-tile)*i/count));
}
async function recognize(file: File) {
    if (file.size > 64 * 1024 * 1024) return { reason:'单张照片超过 64 MB，请缩小后重试' };
    const bitmap = await createImageBitmap(file, { imageOrientation:'from-image' });
    try {
        if(bitmap.width*bitmap.height>90_000_000) return { reason:'照片超过 9000 万像素，请缩小后重试' };
        let faces = await detect(bitmap);
        if (!faces.length) {
            const tile = Math.min(Math.max(bitmap.width,bitmap.height)/3, Math.min(bitmap.width,bitmap.height));
            const tw=Math.min(bitmap.width,tile),th=Math.min(bitmap.height,tile);
            const found: OnnxFace[]=[];
            for(const x of positions(bitmap.width,tw)) for(const y of positions(bitmap.height,th)) found.push(...await detect(bitmap,x,y,tw,th));
            faces=suppress(found);
        }
        faces.sort((a,b)=>b.width*b.height-a.width*a.height);
        if(!faces.length) return { reason:'YuNet 未检出人脸（背影、遮挡或细节不足）' };
        let face=faces[0];
        if(faces[1] && face.width*face.height<4*faces[1].width*faces[1].height) return { reason:'多张相近大小的人脸，无法确定主体' };
        if(Math.min(face.width,face.height)<24) return { reason:'原图人脸细节不足（小于 24 像素）' };
        const padding=Math.max(face.width,face.height)*0.5;
        const x=Math.max(0,Math.floor(face.x-padding)),y=Math.max(0,Math.floor(face.y-padding));
        const w=Math.min(bitmap.width,Math.ceil(face.x+face.width+padding))-x,h=Math.min(bitmap.height,Math.ceil(face.y+face.height+padding))-y;
        if(w<=0||h<=0) return {reason:'主体人脸区域无效'};
        const refined=await detect(bitmap,x,y,w,h);
        const centerX=face.x+face.width/2,centerY=face.y+face.height/2;
        const delta=(item:OnnxFace)=>Math.hypot(item.x+item.width/2-centerX,item.y+item.height/2-centerY);
        refined.sort((a,b)=>delta(a)-delta(b));
        if(refined[0] && delta(refined[0])<=Math.max(face.width,face.height)*0.35) face=refined[0];
        const aligned=canvas(112,112),context=aligned.getContext('2d',{willReadFrequently:true})!;
        const {a,b,tx,ty}=similarity(face.points);
        context.fillStyle='#000';context.fillRect(0,0,112,112);
        context.setTransform(a,b,-b,a,tx,ty); context.drawImage(bitmap,0,0); context.resetTransform();
        // The SFace ONNX graph includes its own normalization; input is raw RGB 0..255.
        const tensor=new ort.Tensor('float32',planarRGB(context.getImageData(0,0,112,112).data),[1,3,112,112]);
        let output:ort.InferenceSession.OnnxValueMapType;
        try { output=await recognizer.run({[recognizer.inputNames[0]]:tensor}); }
        finally {tensor.dispose();aligned.width=0;aligned.height=0;}
        try {return {descriptor:normalizeFeature(output[recognizer.outputNames[0]].data as Float32Array)};}
        finally {Object.values(output).forEach(value=>value.dispose());}
    } finally { bitmap.close(); }
}
let queue=Promise.resolve();
self.onmessage=(event:MessageEvent<{id:number;file?:File}>)=>{
    const {id,file}=event.data;
    queue=queue.then(async()=>{
        try {await initialize();const result=file?await recognize(file):{ready:true};self.postMessage({id,result});}
        catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
    });
};
