// Cold font payload budget from the exact metadata used by the browser.
import {readFile, stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const catalog=JSON.parse(await readFile(new URL('../src/pages/watermark/fonts/catalog.json',import.meta.url),'utf8'));
const text=process.argv[2] || '《江山放牧图卷》·北宋·祁序·故宫博物院藏 / 笑谈间气吐霓虹摄';
const includes=(range,character)=>range.split(',').some(value=>{
    const code=character.codePointAt(0),part=value.trim().replace(/^U\+/i,'');
    const [low,high=low]=part.includes('?')?[part.replaceAll('?','0'),part.replaceAll('?','F')]:part.split('-');
    return code>=parseInt(low,16)&&code<=parseInt(high,16);
});
let metadataBytes=0,metadataGzipBytes=0;
const samples=[];
for(const font of catalog){
    const css=await readFile(new URL(`../public${font.metadataUrl}`,import.meta.url),'utf8');
    metadataBytes+=Buffer.byteLength(css);metadataGzipBytes+=gzipSync(css).length;
    if(!['fzxijinljw','fzzhaomfksjf','fzqinxiaozhuan'].includes(font.id))continue;
    const urls=new Set();
    for(const [,body]of css.matchAll(/@font-face\s*\{([^}]+)\}/g)){
        const range=body.match(/unicode-range\s*:\s*([^;]+)/i)?.[1];
        if(!range||[...text].some(character=>includes(range,character))) urls.add(body.match(/url\("([^"]+)"/)[1]);
    }
    let subsetBytes=0;
    for(const url of urls)subsetBytes+=(await stat(new URL(`../public${url}`,import.meta.url))).size;
    samples.push({id:font.id,metadataBytes:Buffer.byteLength(css),metadataGzipBytes:gzipSync(css).length,subsetRequests:urls.size,subsetBytes});
}
console.log(JSON.stringify({fonts:catalog.length,text,metadataBytes,metadataGzipBytes,samples},null,2));
