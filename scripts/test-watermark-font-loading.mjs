import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('src/pages/watermark/fonts/catalog.json',root),'utf8'));
const sources=JSON.parse(await readFile(new URL('public/fonts/watermark/founder/sources.json',root),'utf8'));
const readCss=url=>readFile(new URL(`public${url}`,root),'utf8');
function faces(css){
    return [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([,body])=>{
        const codes=new Set();
        for(const part of (body.match(/unicode-range\s*:\s*([^;]+)/i)?.[1]||'').split(',')){
            const [first,last=first]=part.trim().replace(/^U\+/i,'').split('-');
            for(let code=parseInt(first.replaceAll('?','0'),16);code<=parseInt(last.replaceAll('?','F'),16);code++)codes.add(code);
        }
        return {codes,url:body.match(/url\("([^"]+)"/)[1]};
    });
}

test('all 70 optimized local fonts retain every original codepoint exactly once',async()=>{
    for(const source of sources){
        const font=catalog.find(font=>font.id===source.id);
        const original=faces(await readCss(`/fonts/watermark/founder/${source.id}-${source.sha256.slice(0,12)}.css`));
        const optimized=faces(await readCss(font.metadataUrl));
        const before=new Set(original.flatMap(face=>[...face.codes]));
        const after=new Set();
        for(const face of optimized)for(const code of face.codes){assert.ok(!after.has(code),`${font.id}: duplicate U+${code.toString(16)}`);after.add(code);}
        assert.deepEqual([...after].sort((a,b)=>a-b),[...before].sort((a,b)=>a-b),font.id);
        assert.equal(optimized.filter(face=>face.url.includes('-common-')).length,1,font.id);
    }
});

test('a real caption downloads fewer pieces and less than half the previous font bytes',async()=>{
    const text='《江山放牧图卷》·北宋·祁序·故宫博物院藏 / 笑谈间气吐霓虹摄';
    async function payload(css){
        const selected=faces(css).filter(face=>[...text].some(char=>face.codes.has(char.codePointAt(0))));
        let bytes=0;for(const face of selected)bytes+=(await stat(new URL(`public${face.url}`,root))).size;
        return {bytes,count:selected.length};
    }
    for(const id of ['fzxijinljw','fzzhaomfksjf','fzqinxiaozhuan']){
        const font=catalog.find(font=>font.id===id),source=sources.find(source=>source.id===id);
        const before=await payload(await readCss(`/fonts/watermark/founder/${id}-${source.sha256.slice(0,12)}.css`));
        const after=await payload(await readCss(font.metadataUrl));
        assert.ok(after.bytes<before.bytes*.5,`${id}: ${before.bytes} -> ${after.bytes}`);
        assert.ok(after.count<=3,`${id}: ${after.count} requests`);
    }
});

test('settled downloads release memory and subsequent requests use persistent cache',async()=>{
    const code=ts.transpileModule(await readFile(new URL('src/pages/watermark/fonts/resources.ts',root),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const api={},saved=new Map();let fetches=0,hits=0;
    vm.runInNewContext(code,{exports:api,Promise,Map,Set,AbortController,Error,setTimeout,clearTimeout,Response,
        caches:{async open(){return {async match(url){if(saved.has(url)){hits++;return saved.get(url).clone();}},async put(url,response){saved.set(url,response);}};}},
        async fetch(){fetches++;return new Response(new Uint8Array([1,2,3]));}
    });
    await api.loadFontResource(['/font-test.woff2']);
    await api.loadFontResource(['/font-test.woff2']);
    assert.equal(fetches,1);assert.equal(hits,1);
});
