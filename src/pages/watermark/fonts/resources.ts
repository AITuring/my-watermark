// Bound concurrent subset downloads across gallery previews and the selected font.
const MAX_DOWNLOADS = 4;
let active = 0;
const queue: Array<() => void> = [];
async function limited<T>(operation: () => Promise<T>): Promise<T> {
    if (active >= MAX_DOWNLOADS) await new Promise<void>(resolve=>queue.push(()=>{active++;resolve();}));
    else active++;
    try { return await operation(); }
    finally { active--;queue.shift()?.(); }
}
const pending = new Map<string,Promise<ArrayBuffer>>();

async function readResource(urls: string[]): Promise<ArrayBuffer> {
    let cache: Cache | undefined;
    try {
        if (typeof caches !== 'undefined') {
            cache=await caches.open('watermark-font-subsets-v1');
            const saved=await cache.match(urls[0]);
            if(saved)return saved.arrayBuffer();
        }
    } catch { /* Private browsing may disable persistent caches. */ }
    const controllers: AbortController[]=[];
    let finished=false;
    try {
        const bytes=await Promise.any(urls.map(async (url,index)=>{
            if(index)await new Promise(resolve=>setTimeout(resolve,180*index));
            if(finished)throw new Error('已有字体源完成');
            const controller=new AbortController();controllers.push(controller);
            const timer=setTimeout(()=>controller.abort(),8000);
            try {
                const response=await fetch(url,{signal:controller.signal,cache:'force-cache'});
                if(!response.ok)throw new Error(`字体文件返回 ${response.status}`);
                return await response.arrayBuffer();
            } finally {clearTimeout(timer);}
        }));
        if(cache)void cache.put(urls[0],new Response(bytes)).catch(()=>{});
        return bytes;
    } finally {finished=true;controllers.forEach(controller=>controller.abort());}
}

export function loadFontResource(urls: string[]) {
    const candidates=[...new Set(urls)];
    const key=candidates[0];
    let request=pending.get(key);
    if(!request) {
        request=limited(()=>readResource(candidates));pending.set(key,request);
        // Keep only in-flight bytes. Loaded FontFaces and Cache Storage own the result;
        // retaining every ArrayBuffer here would duplicate memory across font switches.
        const forget=()=>{if(pending.get(key)===request)pending.delete(key);};
        void request.then(forget,forget);
    }
    return request;
}
