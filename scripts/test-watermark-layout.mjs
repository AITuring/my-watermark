import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const source=await readFile(new URL('../src/pages/watermark/layout-metrics.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const api={};vm.runInNewContext(code,{exports:api});
const metrics=api.getWatermarkLayoutMetrics;

test('panorama and portrait use different ORIGINAL-pixel font sizes',()=>{
    const long=metrics(25365,4769),portrait=metrics(5098,8158);
    assert.ok(long.title<portrait.title);
    assert.equal(long.basis,'image-estimate');
    assert.equal(portrait.basis,'image-estimate');
    assert.ok(long.title<100&&portrait.title<110);
});

test('measured original inscription height overrides image-size estimates',()=>{
    assert.equal(metrics(25365,4769,112).title,112);
    assert.equal(metrics(5098,8158,156).title,156);
    assert.equal(metrics(25365,4769,112).basis,'reference-text');
});

test('resolution scaling preserves relative typography and does not depend on preview resolution',()=>{
    const first=metrics(5098,8158),second=metrics(10196,16316);
    for(const key of ['title','caption','signature','gap'])assert.ok(Math.abs(first[key]*2-second[key])<1e-8,key);
    assert.ok(Math.abs(first.title*1000/8158-second.title*1000/16316)<1e-8);
});

test('invalid dimensions fail; invalid and unreasonable text references remain bounded',()=>{
    for(const [w,h] of [[0,20],[-1,5],[Infinity,10]])assert.throws(()=>metrics(w,h));
    for(const ref of [undefined,0,-1,NaN,Infinity])assert.equal(metrics(5000,8000,ref).basis,'image-estimate');
    assert.equal(metrics(5000,8000,100000).title,225);
    assert.equal(metrics(5000,8000,1).title,30);
});

test('image mode and mixed mode keep separate default logo assets',async()=>{
    const helperCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/helpers.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const helpers={};vm.runInNewContext(helperCode,{exports:helpers});
    assert.equal(helpers.DEFAULT_WATERMARK_URL,'/logo.png');
    assert.equal(helpers.DEFAULT_MIXED_WATERMARK_CONFIG.icon,'/watermark-symbol.png');
    const {default:sharp}=await import('sharp');
    const symbol=await sharp(new URL('../public/watermark-symbol.png',import.meta.url).pathname).metadata();
    assert.equal(symbol.hasAlpha,true);
    assert.ok(symbol.height>symbol.width,'pure symbol has a different portrait aspect from the full signature logo');
});

test('font patches unify title and caption in both single-image and batch scopes',async()=>{
    const helperCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/helpers.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const helpers={};vm.runInNewContext(helperCode,{exports:helpers});
    const previous={a:{textLine1:'甲',fontId:'old'},b:{textLine1:'乙',fontId:'old'}};
    const next=helpers.applyWatermarkConfigPatch(previous,['a','b'],{fontId:'kesong'});
    assert.equal(next.a.captionFontId,'kesong');assert.equal(next.b.captionFontId,'kesong');
    assert.equal(next.a.textLine1,'甲');assert.equal(next.b.textLine1,'乙');assert.equal(previous.a.fontId,'old');
});

const presetCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/layout-presets.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const presetApi={};vm.runInNewContext(presetCode,{exports:presetApi});
const arrangementCode=ts.transpileModule(await readFile(new URL('../src/utils/text-watermark-layout.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const arrangement={};vm.runInNewContext(arrangementCode,{exports:arrangement});

test('directions retain independent choices and vertical never exposes a three-column variant',()=>{
    const config={layout:'horizontal',horizontalPreset:'centered',verticalPreset:'paired'};
    assert.equal(presetApi.getWatermarkPreset(config),'centered');
    assert.equal(presetApi.getWatermarkPreset({...config,layout:'vertical'}),'paired');
    assert.equal(presetApi.getWatermarkPreset({...config,layout:'horizontal'}),'centered');
    assert.equal(presetApi.VERTICAL_PRESETS.length,2);
});

test('approved arrangements enforce visible-ink alignment and never enlarge a vertical stamp',()=>{
    const a={width:300,height:80,x:999,y:999},b={width:410,height:88};
    const single=arrangement.arrangeWatermark([a],false,false,100,40,.6);
    assert.equal(single.items[0].height,single.items[1].height);assert.equal(single.items[1].y,0);
    const side=arrangement.arrangeWatermark([a,b],false,false,100,40,.6),[logo,first,second]=side.items;
    assert.equal(first.x,second.x);assert.equal(logo.height,second.y+second.height-first.y);
    const center=arrangement.arrangeWatermark([a,b],false,true,100,40,.6);
    for(const item of center.items)assert.ok(Math.abs(item.x+item.width/2-center.width/2)<1e-8);
    const vertical=arrangement.arrangeWatermark([{width:95,height:800},{width:90,height:1100}],true,false,100,55,.6);
    const seal=vertical.items.find(i=>i.role==='icon'),texts=vertical.items.filter(i=>i.role==='text');
    assert.ok(seal.height<=150);assert.ok(seal.y+seal.height<Math.min(...texts.map(t=>t.y)));
    assert.equal(texts[0].y,texts[1].y);assert.ok(texts[0].x>texts[1].x);
    assert.ok(Math.abs(seal.x+seal.width/2-vertical.width/2)<1e-8);
});

test('simplified font groups keep the full catalog reachable through four choices',async()=>{
    const code=ts.transpileModule(await readFile(new URL('../src/pages/watermark/fonts/groups.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const api={};vm.runInNewContext(code,{exports:api});
    assert.equal(api.FONT_GROUPS.length,4);
    const fonts=JSON.parse(await readFile(new URL('../src/pages/watermark/fonts/catalog.json',import.meta.url),'utf8'));
    for(const font of fonts)assert.ok(api.FONT_GROUPS.includes(api.fontGroup(font)),font.id);
    assert.equal(api.fontGroup(fonts.find(f=>f.id==='fzxijinljw')),'宋体');
    assert.equal(api.fontGroup(fonts.find(f=>f.id==='fzzhaomfksjf')),'书法');
});
