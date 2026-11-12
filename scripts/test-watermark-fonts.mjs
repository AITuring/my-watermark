import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const catalog=JSON.parse(await readFile(new URL('../src/pages/watermark/fonts/catalog.json',import.meta.url),'utf8'));
const coverage=JSON.parse(await readFile(new URL('../src/pages/watermark/fonts/aoyagi-coverage.json',import.meta.url),'utf8'));
const code=ts.transpileModule(await readFile(new URL('../src/pages/watermark/fonts/registry.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function environment() {
    const faces=new Set(), calls=[], resourceCalls=[];
    const state={css:'@font-face {src:url(./part.woff2) format("woff2");unicode-range:U+4E00-9FFF;}',loads:0};
    class FontFace {constructor(family,source,descriptors){Object.assign(this,{family,source,descriptors});} async load(){return this;}}
    const exports={};
    vm.runInNewContext(code,{exports,require(path){return path.includes('resources')?{async loadFontResource(urls){resourceCalls.push(urls);return new ArrayBuffer(8);}}:path.includes('aoyagi')?coverage:catalog;},FontFace,URL,AbortController,Error,Map,Set,Promise,setTimeout,clearTimeout,
        window:{setTimeout,clearTimeout,location:{href:'http://localhost/watermark'}},document:{fonts:{add:face=>faces.add(face),delete:face=>faces.delete(face),async load(){state.loads++;return [...faces];}}},
        async fetch(url){calls.push(url);return {ok:true,async text(){return state.css;}};},
    });
    return {api:exports,calls,faces,state,resourceCalls};
}

test('catalog has distinct entries covering seal, clerical, regular, running and cursive scripts',()=>{
    const {api}=environment();
    assert.equal(new Set(api.WATERMARK_FONTS.map(font=>font.id)).size,api.WATERMARK_FONTS.length);
    for(const category of ['篆书','隶书','楷书','行书','草书']) assert.ok(api.WATERMARK_FONTS.some(font=>font.category===category&&(font.cssUrl||font.fontUrl)),category);
    assert.ok(catalog.every(font=>(font.cssUrl.startsWith('https://') || font.cssUrl===font.metadataUrl)&&!font.cssUrl.includes('@latest')));
});

test('system font works without network and concurrent requests share font metadata',async()=>{
    const {api,calls,faces,resourceCalls}=environment();
    await api.ensureWatermarkFont('system-song'); assert.equal(calls.length,0);
    await Promise.all([api.ensureWatermarkFont('yidianyan','秋声'),api.ensureWatermarkFont('yidianyan','赵孟頫')]);
    assert.equal(calls.length,1);assert.equal(faces.size,1);
    const face=[...faces][0];
    assert.ok(face.source instanceof ArrayBuffer);
    assert.equal(resourceCalls.length,1);
    assert.ok(calls[0].startsWith('/fonts/watermark/'));
    assert.ok(resourceCalls[0][0].includes('part.woff2'));
    assert.equal(api.missingFontCharacters('yidianyan','秋声'), '');
});

test('default Song uses the bundled Founder Xi Jinling font and loads its actual glyphs',async()=>{
    const {api,state,calls,resourceCalls}=environment();
    assert.equal(api.DEFAULT_FONT_ID,'fzxijinljw');
    const font=catalog.find(item=>item.id===api.DEFAULT_FONT_ID);
    assert.equal(font.name,'方正细金陵简体');assert.equal(font.category,'宋体');
    state.css=await readFile(new URL(`../public${font.metadataUrl}`,import.meta.url),'utf8');
    const family=await api.ensureWatermarkFont(undefined,'江山放牧图卷');
    assert.ok(family.includes('WM_fzxijinljw'));
    assert.equal(calls[0],font.metadataUrl);assert.ok(resourceCalls.length>0);
    assert.equal(api.missingFontCharacters(api.DEFAULT_FONT_ID,'江山放牧图卷'),'');
});

test('unicode coverage checks ranges, wildcard ranges and missing characters',async()=>{
    const {api,state}=environment();
    assert.equal(api.unicodeRangeIncludes('U+4E??','一'),true);
    assert.equal(api.unicodeRangeIncludes('U+4E00-4E10','秋'),false);
    state.css='@font-face {src:url(./a.woff2);unicode-range:U+79CB;}';
    await api.ensureWatermarkFont('ysbzt','秋声');
    assert.equal(api.missingFontCharacters('ysbzt','秋声声'),'声');
    assert.equal(api.missingFontCharacters('ysbzt','𠮷'),'𠮷');
});

test('failed font metadata can be retried, rather than caching a failed selection',async()=>{
    const {api,state,calls}=environment();state.css='invalid CSS';
    await assert.rejects(api.ensureWatermarkFont('jxzk','秋'),/在线字体加载失败/);
    assert.equal(calls.length,3);
    state.css='@font-face {src:url(./fixed.woff2);unicode-range:U+0-10FFFF;}';
    await api.ensureWatermarkFont('jxzk','秋');assert.equal(calls.length,4);
});

test('local font import rejects invalid files and registers valid session fonts',async()=>{
    const {api,calls}=environment();
    await assert.rejects(api.importWatermarkFont({name:'font.png',size:1}),/请选择/);
    await assert.rejects(api.importWatermarkFont({name:'font.ttf',size:51*1024*1024}),/50 MB/);
    const font=await api.importWatermarkFont({name:'褚遂良授权字体.ttf',size:10,async arrayBuffer(){return new ArrayBuffer(10);}});
    assert.equal(api.fontName(font.id),'褚遂良授权字体');
    await api.ensureWatermarkFont(font.id,'秋声赋');assert.equal(calls.length,0);
    assert.equal(api.getImportedFonts().length,1);
});

const rendererCode=ts.transpileModule(await readFile(new URL('../src/utils/text-watermark.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const presetCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/layout-presets.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const geometryLayoutCode=ts.transpileModule(await readFile(new URL('../src/utils/text-watermark-layout.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const presets={},layoutGeometry={};vm.runInNewContext(presetCode,{exports:presets});vm.runInNewContext(geometryLayoutCode,{exports:layoutGeometry});
function renderer() {
    const exports={},canvases=[],requested=[];
    const document={fonts:{load:async()=>[]},createElement(){
        const calls=[];
        const context={font:'',fillStyle:'',textAlign:'',scale(){},translate(){},rotate(){},save(){},restore(){},fillRect(){},drawImage(){},
            measureText(text){return {width:Array.from(text).length*40};},
            strokeText(){throw new Error('Text outlines must remain disabled');},
            fillText(text){calls.push({text,font:this.font,color:this.fillStyle});},
        };
        const canvas={width:0,height:0,calls,getContext:()=>context,toDataURL:()=>`data:image/png;${canvas.width}x${canvas.height}`};
        canvases.push(canvas);return canvas;
    }};
    class Image {naturalWidth=50;naturalHeight=100;set src(value){this.onload();}}
    vm.runInNewContext(rendererCode,{exports,document,Image,Error,Promise,require(path){return path.includes('registry')?{async ensureWatermarkFont(id,text){requested.push({id,text});return `"${id || 'song'}"`;}}:path.includes('layout-presets')?presets:path.includes('text-watermark-layout')?layoutGeometry:{getImageOpaqueBounds:()=>({x:5,y:10,width:40,height:80})};}});
    return {render:exports.createTextWatermark,canvases,requested};
}
const baseConfig={enabled:true,textOnly:true,icon:'logo.png',textLine1:'秋声赋',textLine2:'元',fontSize:30,color:'#cc2828',layout:'horizontal',gap:20};

test('title and caption use one loaded font, the same size and selected solid color',async()=>{
    const r=renderer();await r.render({...baseConfig,fontId:'title',captionFontId:'caption'});
    const calls=r.canvases[0].calls;
    assert.equal(calls.length,4);assert.ok(calls.every(call=>call.font.includes('"title"')));assert.equal(new Set(calls.map(call=>call.font)).size,1);
    assert.ok(calls.every(call=>call.color==='#cc2828'));
    assert.equal(r.requested[0].text,'秋声赋·元');assert.equal(r.requested.length,1);
});

test('inline edit regions match rendered title and caption in both directions',async()=>{
    for (const layout of ['horizontal','vertical']) {
        const r=renderer();let regions;
        await r.render({...baseConfig,layout},value=>{regions=value;});
        assert.equal(regions.length,2);
        assert.equal(regions[0].field,'textLine1');assert.equal(regions[1].field,'textLine2');
        assert.ok(regions.every(region=>region.width>0&&region.height>0&&region.fontSize>0));
        if(layout==='horizontal') assert.ok(regions[0].y+regions[0].height<regions[1].y);
        else assert.ok(regions[1].x+regions[1].width<regions[0].x);
        for(const region of regions) {
            assert.ok(region.x>=0&&region.y>=0);
            assert.ok(region.x+region.width<=r.canvases[0].width);
            assert.ok(region.y+region.height<=r.canvases[0].height);
        }
    }
});

test('inline edit regions preserve caption identity with no title and follow icon offsets and output scaling',async()=>{
    for (const layout of ['horizontal','vertical']) {
        const r=renderer();let regions;
        await r.render({...baseConfig,textOnly:false,layout,textLine1:'',textLine2:'秋'.repeat(150)},value=>{regions=value;});
        assert.equal(regions.length,1);assert.equal(regions[0].field,'textLine2');
        assert.ok(regions[0].x>0&&regions[0].y>0);
        assert.ok(regions[0].x+regions[0].width<=r.canvases[0].width);
        assert.ok(regions[0].y+regions[0].height<=r.canvases[0].height);
        assert.ok(Math.max(r.canvases[0].width,r.canvases[0].height)<=8192);
    }
});

test('spacing changes the watermark footprint; vertical text handles astral characters once',async()=>{
    const a=renderer(),b=renderer();await a.render(baseConfig);await b.render({...baseConfig,letterSpacing:0.3});
    assert.ok(b.canvases[0].width>a.canvases[0].width);
    const vertical=renderer();await vertical.render({...baseConfig,textLine1:'𠮷秋',textLine2:'',layout:'vertical'});
    assert.equal(vertical.canvases[0].calls.length,2);assert.equal(vertical.canvases[0].calls[0].text,'𠮷');
});

test('mixed mode can render an icon without text and its size control changes the footprint',async()=>{
    const a=renderer(),b=renderer();
    const config={...baseConfig,textOnly:false,textLine1:'',textLine2:''};
    assert.ok((await a.render(config)).startsWith('data:image/png'));
    await b.render({...config,iconScale:2});assert.ok(b.canvases[0].height>a.canvases[0].height);
    const empty=renderer();assert.equal(await empty.render({...config,textOnly:true}),'');
});

const helpersCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/helpers.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const helpers={};vm.runInNewContext(helpersCode,{exports:helpers});
test('editing scope applies explicit style patches while preserving each filename caption',()=>{
    const previous={a:{textLine1:'秋声赋卷',color:'#ffffff'},b:{textLine1:'青花瓷瓶',color:'#171717'}};
    const all=helpers.applyWatermarkConfigPatch(previous,['a','b'],{color:'#ffffff',fontId:'ma-shan-zheng'});
    assert.equal(all.b.color,'#ffffff');assert.equal(all.b.textLine1,'青花瓷瓶');assert.equal(all.a.fontId,'ma-shan-zheng');
    assert.equal(previous.b.color,'#171717');
    const one=helpers.applyWatermarkConfigPatch(previous,['a'],{textLine1:'手动标题'});
    assert.equal(one.a.textLine1,'手动标题');assert.equal(one.b,previous.b);
});

const geometryCode=ts.transpileModule(await readFile(new URL('../src/utils/watermark-editor.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const geometry={};
vm.runInNewContext(geometryCode,{exports:geometry,document:{createElement(){const canvas={width:0,height:0,getContext(){return {drawImage(){},getImageData(){return {width:canvas.width,height:canvas.height,data:new Uint8ClampedArray(canvas.width*canvas.height*4).fill(255)};}};}};return canvas;}}});
test('font and direction changes keep even enlarged watermarks inside the photo',()=>{
    const logo={width:100,height:1800};
    const position={id:'a',x:0.9,y:0.9,scaleX:3,scaleY:3,rotation:0};
    const fit=geometry.fitWatermarkPosition(800,500,logo,position);
    const metrics=geometry.getAdaptiveWatermarkRenderMetrics(800,500,logo,fit.scaleX);
    assert.ok(fit.scaleX<position.scaleX);
    assert.ok(fit.x>=0&&fit.y>=0);
    assert.ok(fit.x*800+metrics.width<=800.00001);
    assert.ok(fit.y*500+metrics.height<=500.00001);
    const normal={...position,x:0.2,y:0.25,scaleX:1,scaleY:1};
    const kept=geometry.fitWatermarkPosition(800,500,{width:100,height:60},normal);
    assert.equal(kept.x,normal.x);assert.equal(kept.y,normal.y);assert.equal(kept.scaleX,normal.scaleX);
});

const namesCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/export-names.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const names={};vm.runInNewContext(namesCode,{exports:names});
test('exports preserve dotted filenames and ZIP entries never overwrite duplicates',()=>{
    assert.equal(names.watermarkOutputName('作品.v2.detail.jpg','image/jpeg'),'作品.v2.detail-mark.jpg');
    assert.equal(names.watermarkOutputName('作品.webp','image/webp'),'作品-mark.webp');
    const used=new Set();
    assert.equal(names.uniqueArchiveName('作品-mark.jpg',used),'作品-mark.jpg');
    assert.equal(names.uniqueArchiveName('作品-mark.jpg',used),'作品-mark (2).jpg');
    assert.equal(names.uniqueArchiveName('作品-mark.jpg',used),'作品-mark (3).jpg');
});

const resourcesCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/fonts/resources.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
test('font subset downloads are deduplicated and concurrency remains bounded',async()=>{
    const exports={};let calls=0,active=0,max=0;
    vm.runInNewContext(resourcesCode,{exports,Promise,Map,Set,AbortController,Error,setTimeout,clearTimeout,
        async fetch(){calls++;active++;max=Math.max(active,max);await new Promise(resolve=>setTimeout(resolve,5));active--;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}});
    await Promise.all(Array.from({length:12},(_,index)=>exports.loadFontResource([`/font-${index%6}.woff2`])));
    assert.equal(calls,6);assert.ok(max<=4);
});
test('persistent cached font bytes avoid a new network request',async()=>{
    const exports={};let calls=0;
    vm.runInNewContext(resourcesCode,{exports,Promise,Map,Set,AbortController,Error,setTimeout,clearTimeout,
        caches:{async open(){return {async match(){return {arrayBuffer:async()=>new ArrayBuffer(8)};}};}},
        async fetch(){calls++;throw Error('network must not be used');}});
    await exports.loadFontResource(['https://fonts.example/cached.woff2']);assert.equal(calls,0);
});

test('a slow font CDN is hedged with a mirror instead of waiting for its timeout',async()=>{
    const exports={};const calls=[];
    vm.runInNewContext(resourcesCode,{exports,Promise,Map,Set,AbortController,Error,clearTimeout,
        setTimeout:(callback,delay)=>setTimeout(callback,delay<1000?5:100),
        async fetch(url,{signal}){
            calls.push(url);
            if(url.includes('slow'))return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled'))));
            return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
        }});
    await exports.loadFontResource(['https://slow.example/a.woff2','https://fast.example/a.woff2']);
    assert.equal(calls.length,2);
});

test('bundled font gallery metadata and preview subsets are present locally',async()=>{
    for(const font of catalog){
        assert.ok(font.metadataUrl?.startsWith('/fonts/watermark/'),font.id);
        const css=await readFile(new URL(`../public${font.metadataUrl}`,import.meta.url),'utf8');
        assert.ok(css.includes('@font-face'),font.id);
        const files=[...css.matchAll(/url\("(\/fonts\/watermark\/[^\"]+)"\)/g)].map(match=>match[1]);
        assert.ok(files.length>0,font.id);
        for(const file of files){const data=await readFile(new URL(`../public${file}`,import.meta.url));assert.ok(data.length>100);}
    }
});

test('every built-in font has an immediate real-glyph gallery image',async()=>{
    const ids=['system-song',...catalog.map(font=>font.id),'aoyagi-lishu'];
    const signatures=new Set();
    const {createHash}=await import('node:crypto');
    for(const id of ids){
        const image=await readFile(new URL(`../public/fonts/watermark/preview-${id}.png`,import.meta.url));
        assert.equal(image.readUInt32BE(16),360,id);assert.equal(image.readUInt32BE(20),110,id);
        signatures.add(createHash('sha256').update(image).digest('hex'));
    }
    assert.ok(signatures.size>=20,'gallery must not show the same fallback font for all entries');
});

test('downloaded fonts have distinct catalog entries, retained source metadata and real subset files',async()=>{
    const sources=JSON.parse(await readFile(new URL('../public/fonts/watermark/founder/sources.json',import.meta.url),'utf8'));
    assert.ok(sources.length>=38);
    assert.equal(new Set(sources.map(source=>source.sha256)).size,sources.length);
    assert.equal(new Set(sources.map(source=>source.postScriptName)).size,sources.length);
    for(const source of sources){
        const font=catalog.find(font=>font.id===source.id);
        assert.ok(font,source.id);assert.equal(font.name,source.name);
        assert.ok(font.tags.includes('本地字体'),source.id);
        assert.ok(source.copyright.length>0,source.id);
        assert.ok(source.previewText.length>0,source.id);
        assert.ok(source.subsetBytes<source.sourceBytes,source.id);
        for(const part of source.subsets){
            const bytes=await readFile(new URL(`../public/fonts/watermark/founder/${part}`,import.meta.url));
            assert.equal(bytes.subarray(0,4).toString(),'wOF2',part);
        }
    }
    const {api}=environment();
    for(const master of api.MASTER_FONTS)assert.ok(api.WATERMARK_FONTS.some(font=>font.id===master.id),master.name);
});

test('local Qin small seal loads only required glyph subsets and reports missing Han characters',async()=>{
    const {api,state,calls,resourceCalls}=environment();
    const font=catalog.find(font=>font.id==='fzqinxiaozhuan');
    state.css=await readFile(new URL(`../public${font.metadataUrl}`,import.meta.url),'utf8');
    await api.ensureWatermarkFont(font.id,'永和九年𠮷');
    assert.equal(calls.length,1);assert.equal(calls[0],font.metadataUrl);
    assert.ok(resourceCalls.length>0&&resourceCalls.length<23);
    assert.ok(resourceCalls.every(urls=>urls[0].includes('/fonts/watermark/founder/')));
    assert.equal(api.missingFontCharacters(font.id,'𠮷'),'𠮷');
});

const adaptiveCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/adaptive-color.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
test('adaptive colors use restrained warm/cool ink and remain deterministic',()=>{
 const exports={};vm.runInNewContext(adaptiveCode,{exports});const choose=exports.chooseWatermarkColor;
 const pixels=(rgb)=>Array.from({length:100},()=>[...rgb,255]).flat();
 const warm=choose(pixels([190,163,120])),dark=choose(pixels([22,25,28])),cool=choose(pixels([180,200,212]));
 assert.ok(['#352f28','#4b3b2c'].includes(warm));assert.ok(['#e1e8e7','#f3f5f1'].includes(dark));assert.ok(['#30383b','#3d4548'].includes(cool));assert.equal(choose(pixels([190,163,120])),warm);
});

test('adaptive color matrix covers flat, saturated, patterned and mixed backgrounds',async()=>{
 const {colorCases,casePixels}=await import('./fixtures/watermark-color-cases.js');
 const exports={};vm.runInNewContext(adaptiveCode,{exports});
 for(const item of colorCases){
  const result=exports.analyzeWatermarkColor(casePixels(item));
  assert.match(result.color,/^#[a-f0-9]{6}$/i,item.name);
  assert.ok(Number.isFinite(result.meanContrast),item.name);
  if(!['明暗渐变','彩色花纹','透明区域','天空云层','冷暖拼接','纸上墨纹'].includes(item.name))assert.ok(result.coverage>=.8,`${item.name}: ${result.coverage}`);
 }
 const checker=exports.analyzeWatermarkColor(casePixels(colorCases.find(item=>item.name==='黑白棋盘')));
 assert.ok(checker.coverage>=.95,'middle tone should cover both light and dark squares');
});
