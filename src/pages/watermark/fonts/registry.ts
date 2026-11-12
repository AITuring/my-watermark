import { loadFontResource } from "./resources";
import catalog from './catalog.json';
import aoyagiCoverage from './aoyagi-coverage.json';

export interface WatermarkFont {
    id: string;
    name: string;
    category: string;
    cssUrl?: string;
    metadataUrl?: string;
    fontUrl?: string;
    localSource?: string;
    source: string;
    tags: string;
}
export const DEFAULT_FONT_ID = 'fzxijinljw';
export const FONT_CATEGORIES = ['全部', '古籍刻本', '篆书', '隶书', '楷书', '行书', '草书', '宋体', '黑体', '手写', '名家', '已导入'];
export const WATERMARK_FONTS: WatermarkFont[] = [
    {id:'system-song',name:'系统宋体',category:'宋体',source:'',tags:'系统'},
    ...catalog,
    {id:'aoyagi-lishu',name:'青柳隶书',category:'隶书',fontUrl:'/fonts/aoyagi-lishu/aoyagi-lishu.ttf',source:'https://opentype.jp/aoyagireisho.htm',tags:'隶书 青柳衡山 SIMO'},
    {id:'local-lisu',name:'系统隶书',category:'隶书',localSource:'local("LiSu"), local("隶书"), local("STLiti")',source:'',tags:'本机字体'},
];
export const MASTER_FONTS = [
    {name:'颜真卿',description:'方正颜真卿楷书 · 另有行书',id:'fzyanzqksjf'},
    {name:'褚遂良',description:'方正褚遂良楷书',id:'fzchuslksjw'},
    {name:'欧阳询',description:'方正欧阳询楷书',id:'fzouyxksjf'},
    {name:'柳公权',description:'方正柳公权楷书',id:'fzliugqksjw'},
    {name:'王羲之',description:'方正王羲之行书',id:'fzwangxzxsjf'},
    {name:'赵孟頫',description:'方正赵孟頫楷书 · 另有行书',id:'fzzhaomfksjf'},
    {name:'米芾',description:'方正米芾行书',id:'fzmifxsjw'},
    {name:'孙过庭',description:'方正孙过庭草书 · 繁体',id:'fzsungtcsfu'},
];
let importedFonts: WatermarkFont[] = [];
const registered = new Map<string, Promise<FontFace[]>>();
const ranges = new Map<string, string[]>();
const definitions = new WeakMap<FontFace,{urls:string[];unicodeRange?:string}>();
const faceLoads = new WeakMap<FontFace,Promise<FontFace>>();
export const FONT_PREVIEW_TEXT = '永和九年';
async function loadFace(face:FontFace) {
    const definition=definitions.get(face);
    if(!definition)return face;
    let pending=faceLoads.get(face);
    if(!pending) {
        pending=(async()=>{
            const data=await loadFontResource(definition.urls);
            const loaded=new FontFace(face.family,data,{style:'normal',weight:'400',...(definition.unicodeRange?{unicodeRange:definition.unicodeRange}:{})});
            await loaded.load();document.fonts.add(loaded);return loaded;
        })();
        faceLoads.set(face,pending);pending.catch(()=>faceLoads.delete(face));
    }
    return pending;
}
const listeners = new Set<() => void>();
export const subscribeFonts = (listener: () => void) => { listeners.add(listener); return () => {listeners.delete(listener);}; };
export const getImportedFonts = () => importedFonts;
export const fontFamily = (id = DEFAULT_FONT_ID) => id === 'system-song'
    ? '"Songti SC", "SimSun", serif' : `"WM_${id}", "Songti SC", serif`;
export const fontName = (id = DEFAULT_FONT_ID) => [...WATERMARK_FONTS,...importedFonts].find(font => font.id === id)?.name || '系统宋体';

export function unicodeRangeIncludes(range: string, character: string) {
    const code = character.codePointAt(0)!;
    return range.split(',').some(part => {
        const value = part.trim().replace(/^U\+/i,'');
        const bounds = value.includes('?') ? [value.replaceAll('?','0'),value.replaceAll('?','F')] : value.split('-');
        const low = parseInt(bounds[0],16), high = parseInt(bounds[1] || bounds[0],16);
        return code >= low && code <= high;
    });
}

/** Register faces without downloading every CJK subset. FontFaceSet loads only the needed characters. */
async function registerFont(font: WatermarkFont): Promise<FontFace[]> {
    if (font.fontUrl) {
        const face = new FontFace(`WM_${font.id}`,`url("${font.fontUrl}")`);
        await face.load();
        document.fonts.add(face);
        ranges.set(font.id,[aoyagiCoverage]);
        return [face];
    }
    if (font.localSource) {
        const face = new FontFace(`WM_${font.id}`,font.localSource);
        await face.load().catch(() => {throw new Error('本机未安装该字体，可导入 TTF / OTF 字体文件。');});
        document.fonts.add(face);
        return [face];
    }
    if (!font.cssUrl) throw new Error('字体未加载，请重新导入。');
    let lastError: unknown;
    // Mirror fallback is only used after the primary CDN fails.
    const urls = [...new Set([font.metadataUrl,font.cssUrl,font.cssUrl.replace('https://cdn.jsdelivr.net/npm/','https://unpkg.com/')].filter((value):value is string=>Boolean(value)))];
    for (const url of urls) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(),font.metadataUrl===url?2000:5000);
        try {
            const response = await fetch(url,{signal:controller.signal,cache:'force-cache'});
            if (!response.ok) throw new Error(`字体服务器返回 ${response.status}`);
            const css = await response.text();
            const faces: FontFace[] = [];
            const coverage: string[] = [];
            for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
                const body=match[1];
                const src=body.match(/src\s*:\s*([^;]+);/i)?.[1];
                if (!src) continue;
                const absolute=src.replace(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g,(_all,path:string) => `url("${new URL(path,new URL(url,window.location.href)).href}")`);
                const unicodeRange=body.match(/unicode-range\s*:\s*([^;]+);/i)?.[1];
                const face=new FontFace(`WM_${font.id}`,absolute + ', ' + absolute.replaceAll('https://cdn.jsdelivr.net/npm/','https://unpkg.com/'),{style:'normal',weight:'400', ...(unicodeRange?{unicodeRange}:{})});
                const primary=[...absolute.matchAll(/url\("([^"]+)"\)/g)].map(match=>match[1]);
                const candidates=[primary[0],primary[0]?.replace('https://cdn.jsdelivr.net/npm/','https://unpkg.com/'),...primary.slice(1)].filter((value):value is string=>Boolean(value));
                definitions.set(face,{urls:candidates,unicodeRange});
                faces.push(face);
                coverage.push(unicodeRange || 'U+0-10FFFF');
            }
            if (!faces.length) throw new Error('字体文件格式无效');
            ranges.set(font.id,coverage);
            return faces;
        } catch(error) { lastError=error; }
        finally { window.clearTimeout(timer); }
    }
    throw new Error(`在线字体加载失败，请重试或选择其他字体。${lastError instanceof Error ? lastError.message : ''}`);
}

export async function ensureWatermarkFont(id = DEFAULT_FONT_ID, text = '秋声赋卷') {
    if (id === 'system-song') return fontFamily(id);
    let pending=registered.get(id);
    if (!pending) {
        const font=[...WATERMARK_FONTS,...importedFonts].find(item=>item.id===id);
        if (!font) throw new Error('所选字体不存在，请重新选择');
        pending=registerFont(font);
        registered.set(id,pending);
        pending.catch(()=>registered.delete(id));
    }
    const faces = await pending;
    const characters=Array.from(text || '秋');
    await Promise.all(faces.filter(face=>{
        const range=definitions.get(face)?.unicodeRange;
        return !range || characters.some(character=>unicodeRangeIncludes(range,character));
    }).map(loadFace));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const loaded = await Promise.race([
            document.fonts.load(`32px "WM_${id}"`,text || '秋'),
            new Promise<FontFace[]>((_resolve,reject)=>{ timer=setTimeout(()=>reject(new Error('字体下载超时，请重试。')),20000); }),
        ]);
        if (!loaded.length) throw new Error('这款字体没有所输入的文字，请换一种字体。');
    } finally { if(timer) clearTimeout(timer); }
    return fontFamily(id);
}

export function missingFontCharacters(id: string, text: string) {
    const coverage=ranges.get(id);
    if (!coverage) return '';
    return [...new Set(Array.from(text).filter(character=> /\p{Script=Han}/u.test(character)
        && !coverage.some(range=>unicodeRangeIncludes(range,character))))].join('');
}

export async function importWatermarkFont(file: File) {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error('请选择 TTF、OTF、WOFF 或 WOFF2 字体');
    if (file.size > 50*1024*1024) throw new Error('字体文件请小于 50 MB');
    const id=`imported-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const face=new FontFace(`WM_${id}`,await file.arrayBuffer());
    await face.load().catch(()=>{throw new Error('字体文件无法读取，请检查格式');});
    document.fonts.add(face);
    registered.set(id,Promise.resolve([face]));
    const font={id,name:file.name.replace(/\.[^.]+$/,''),category:'已导入',source:'',tags:'本地导入 本次会话'};
    importedFonts = [...importedFonts,font];
    listeners.forEach(listener=>listener());
    return font;
}

/** Gallery samples are bundled on the site and do not wait for the full caption. */
export function prepareFontPreview(id:string) {
    return ensureWatermarkFont(id,FONT_PREVIEW_TEXT);
}
