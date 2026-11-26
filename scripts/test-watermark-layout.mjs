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
    assert.ok(long.title<130&&portrait.title<180);
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
    assert.equal(metrics(5000,8000,1).title,40);
});

test('image mode and mixed mode keep separate default logo assets',async()=>{
    const helperCode=ts.transpileModule(await readFile(new URL('../src/pages/watermark/helpers.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const helpers={};vm.runInNewContext(helperCode,{exports:helpers});
    assert.equal(helpers.DEFAULT_WATERMARK_URL,'/logo.png');
    assert.equal(helpers.DEFAULT_TRANSPARENT_WATERMARK_URL,'/logo.png');
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

test('compact mode keeps only the era and places it before the title',()=>{
    assert.equal(arrangement.getCompactWatermarkCaption('明洪武时期·南京博物院藏 / 笑谈间气吐霓虹摄'),'明洪武时期');
    assert.equal(JSON.stringify(arrangement.buildSingleLineCaptionRuns('玉壶春瓶','明洪武时期','era-first').map(run=>run.text)),JSON.stringify(['明洪武时期',' · ','玉壶春瓶']));
});

test('long multi-line captions promote the era and enlarge the first line slightly',()=>{
    const plan=arrangement.splitLongCaptionForMultiple('羊形金饰件','东晋·南京中央门外郭家山温氏家族墓m9温峤墓出土·南京市博物馆藏 / 笑谈间气吐霓虹摄',true);
    assert.equal(plan.promoted,true);
    assert.equal(plan.firstText,'东晋 · 羊形金饰件');
    assert.equal(plan.secondText,'南京中央门外郭家山温氏家族墓m9温峤墓出土·南京市博物馆藏 / 笑谈间气吐霓虹摄');
    assert.equal(plan.first[0].fontScale,1.14);
    assert.equal(arrangement.splitLongCaptionForMultiple('羊形金饰件','明·南京博物院藏',true).promoted,false);
    assert.equal(arrangement.splitLongCaptionForMultiple('羊形金饰件','东晋·南京中央门外郭家山温氏家族墓m9温峤墓出土·南京市博物馆藏 / 笑谈间气吐霓虹摄',false).promoted,false);
});

test('directions retain independent choices and vertical never exposes a three-column variant',()=>{
    const config={layout:'horizontal',horizontalPreset:'centered',verticalPreset:'paired'};
    assert.equal(presetApi.getWatermarkPreset(config),'centered');
    assert.equal(presetApi.getWatermarkPreset({...config,layout:'vertical'}),'single');
    assert.equal(presetApi.getWatermarkPreset({...config,layout:'horizontal'}),'centered');
    assert.equal(presetApi.VERTICAL_PRESETS.length,1);
});

test('text field labels follow compact and visual layout semantics',()=>{
    assert.equal(JSON.stringify(presetApi.getWatermarkTextFieldLabels({compactMode:true})),JSON.stringify({textLine1:'名称',textLine2:'时代',textLine1Placeholder:'作品名称',textLine2Placeholder:'如 五代、南宋、18世纪'}));
    assert.equal(JSON.stringify(presetApi.getWatermarkTextFieldLabels({layout:'horizontal',horizontalPreset:'paired'})),JSON.stringify({textLine1:'第一行',textLine2:'第二行',textLine1Placeholder:'第一行文字',textLine2Placeholder:'第二行文字'}));
    for(const config of [{layout:'horizontal',horizontalPreset:'single'},{layout:'vertical',verticalPreset:'single'}]){
        assert.equal(JSON.stringify(presetApi.getWatermarkTextFieldLabels(config)),JSON.stringify({textLine1:'标题',textLine2:'说明',textLine1Placeholder:'作品名称',textLine2Placeholder:'年代 · 馆藏 · 摄影者'}));
    }
    // Centered: the seal is the first row, so the text fields sit on rows two and three.
    assert.equal(JSON.stringify(presetApi.getWatermarkTextFieldLabels({layout:'horizontal',horizontalPreset:'centered'})),JSON.stringify({textLine1:'第二行',textLine2:'第三行',textLine1Placeholder:'第二行文字',textLine2Placeholder:'第三行文字'}));
    // Text-only has no seal, so the same preset is two lines.
    assert.equal(JSON.stringify(presetApi.getWatermarkTextFieldLabels({layout:'horizontal',horizontalPreset:'centered',textOnly:true})),JSON.stringify({textLine1:'第一行',textLine2:'第二行',textLine1Placeholder:'第一行文字',textLine2Placeholder:'第二行文字'}));
});

test('short artifact names keep the automatic single-line default but respect explicit horizontal choices',()=>{
    for(const layout of ['horizontal','vertical'])for(const preset of ['paired','centered','single']){
        const config={layout,textLine1:'供盘',textLine2:'17—19世纪·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄',horizontalPreset:preset,verticalPreset:preset};
        assert.equal(presetApi.getWatermarkPreset(config),layout==='vertical'?'single':preset);
        assert.equal(presetApi.getWatermarkPreset({...config,textLine1:'青铜供盘'}),layout==='vertical'?'single':preset);
        const expected=layout==='vertical'?'single':preset;
        assert.equal(presetApi.getWatermarkPreset({...config,textLine1:'《江山放牧图卷》'}),expected);
        assert.equal(presetApi.getWatermarkPreset({...config,textLine2:'宋·故宫藏'}),expected);
        assert.equal(presetApi.getWatermarkPreset({...config,textLine1:''}),expected);
        assert.equal(presetApi.getWatermarkPreset({...config,textLine2:''}),expected);
    }
    const automatic={layout:'horizontal',textLine1:'供盘',textLine2:'17—19世纪·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄'};
    assert.equal(presetApi.getWatermarkPreset(automatic),'single');
});

test('explicit horizontal arrangements override the short-title fallback',()=>{
    const base={layout:'horizontal',textLine1:'供盘',textLine2:'宋·故宫博物院藏 / 摄'};
    assert.equal(presetApi.getWatermarkPreset({...base,horizontalPreset:'paired'}),'paired');
    assert.equal(presetApi.getWatermarkPreset({...base,horizontalPreset:'centered'}),'centered');
});

test('vertical date connectors rotate while numbers and horizontal captions stay upright',()=>{
    for(const character of '-－—–−~～《》〈〉（）()'){
        assert.equal(arrangement.getWatermarkGlyphRotation(character,true),Math.PI/2,character);
        assert.equal(arrangement.getWatermarkGlyphRotation(character,false),0,character);
    }
    for(const character of '1719世纪供盘·至到')assert.equal(arrangement.getWatermarkGlyphRotation(character,true),0,character);
});

test('single-line captions place era before title and keep collection/photographer after it',()=>{
    const eraFirst=arrangement.buildSingleLineCaptionRuns('朱漆戗金莲托八吉祥纹护经板','明永乐时期·南京博物院藏 / 笑谈间气吐霓虹摄','era-first');
    assert.equal(JSON.stringify(eraFirst.map(run=>run.text)),JSON.stringify(['明永乐时期',' · ','朱漆戗金莲托八吉祥纹护经板',' · ','南京博物院藏 · 笑谈间气吐霓虹摄']));
    assert.equal(eraFirst[0].field,'textLine2');assert.equal(eraFirst[2].field,'textLine1');assert.equal(eraFirst[4].field,'textLine2');
    assert.equal(JSON.stringify(arrangement.buildSingleLineCaptionRuns('供盘','17—19世纪·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄','title-first').map(run=>run.text)),JSON.stringify(['供盘',' · ','17—19世纪·大都会艺术博物馆藏 · 笑谈间气吐霓虹摄']));
    assert.equal(JSON.stringify(arrangement.buildSingleLineCaptionRuns('供盘','', 'era-first').map(run=>run.text)),JSON.stringify(['供盘']));
});

test('vertical text scaling enlarges glyphs without changing character pitch',()=>{
    const base=.1,scale=2,spacing=arrangement.getFittedVerticalLetterSpacing(base,scale);
    assert.ok(Math.abs((1+base)-scale*(1+spacing))<1e-8);
    assert.ok(spacing<0);
});

test('approved arrangements enforce visible-ink alignment and never enlarge a vertical stamp',()=>{
    const a={width:300,height:80,x:999,y:999},b={width:410,height:88};
    const single=arrangement.arrangeWatermark([a],false,false,100,40,.6);
    assert.ok(single.items[0].height>single.items[1].height);assert.equal(single.items[1].y,0);
    const side=arrangement.arrangeWatermark([a,b],false,false,100,40,.6),[logo,first,second]=side.items;
    assert.equal(first.x,second.x);assert.ok(logo.height>second.y+second.height-first.y);
    const center=arrangement.arrangeWatermark([a,b],false,true,100,40,.6);
    for(const item of center.items)assert.ok(Math.abs(item.x+item.width/2-center.width/2)<1e-8);
    const vertical=arrangement.arrangeWatermark([{width:95,height:800},{width:90,height:1100}],true,false,100,55,.6);
    const seal=vertical.items.find(i=>i.role==='icon'),texts=vertical.items.filter(i=>i.role==='text');
    assert.ok(seal.height<=150);assert.ok(seal.y+seal.height<Math.min(...texts.map(t=>t.y)));
    assert.ok(texts[0].y<texts[1].y);assert.ok(Math.abs((texts[0].x+texts[0].width/2)-(texts[1].x+texts[1].width/2))<1e-8);
    assert.ok(Math.abs(seal.x+seal.width/2-vertical.width/2)<1e-8);
});

test('vertical logos stay visually subordinate and leave a deliberate text gap',()=>{
    const layout=arrangement.arrangeWatermark([{width:95,height:800}],true,false,100,40,.6);
    const seal=layout.items.find(i=>i.role==='icon');
    const text=layout.items.find(i=>i.role==='text');
    assert.ok(seal&&text);
    assert.ok(seal.height<=125);
    assert.ok(text.y-(seal.y+seal.height)>=75);
});

test('compact vertical logos are smaller and separated from the caption',()=>{
    const layout=arrangement.arrangeCompactWatermark({width:40,height:100},{width:40,height:100},true,100,.6,true);
    const seal=layout.items.find(i=>i.role==='icon');
    const main=layout.items.find(i=>i.role==='text'&&i.index===0);
    assert.ok(seal&&main);
    assert.ok(seal.width<=85);
    assert.ok(main.y-(seal.y+seal.height)>=65);
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

test('layout footprint changes preserve glyph height in single, paired and centered text',()=>{
    const imageWidth=6000,imageHeight=8000,baseWidth=900;
    const desired=metrics(imageWidth,imageHeight).title;
    for(const bounds of [{width:120,height:2400},{width:300,height:1200},{width:2400,height:120},{width:1200,height:300}]){
        const scale=api.getTextWatermarkScale(imageWidth,imageHeight,bounds,baseWidth,120);
        const visibleGlyphHeight=120*baseWidth*scale/bounds.width;
        assert.ok(Math.abs(visibleGlyphHeight-desired)<1e-8);
    }
});
test('manual text size survives layout changes and oversized captions fit inside the photo',()=>{
    const baseWidth=900;
    for(const width of [120,300,1000]){
        const scale=api.getTextWatermarkScale(6000,8000,{width,height:1200},baseWidth,120,1.5);
        assert.ok(Math.abs(120*baseWidth*scale/width-metrics(6000,8000).title*1.5)<1e-8);
    }
    const bounds={width:12000,height:24000};
    const scale=api.getTextWatermarkScale(6000,8000,bounds,baseWidth,120,3);
    const factor=baseWidth*scale/bounds.width;
    assert.ok(bounds.width*factor<=6000*.95&&bounds.height*factor<=8000*.95);
});

test('direction changes preserve manual text sizing rather than the previous block width',()=>{
    const vertical=.2,horizontal=8;
    assert.equal(api.rebaseTextWatermarkScale(vertical,vertical,horizontal),horizontal);
    const resized=api.rebaseTextWatermarkScale(vertical*1.5,vertical,horizontal);
    assert.ok(Math.abs(resized-horizontal*1.5)<1e-9);
    assert.ok(Math.abs(api.rebaseTextWatermarkScale(resized,horizontal,vertical)-vertical*1.5)<1e-9);
    assert.equal(api.rebaseTextWatermarkScale(.01,undefined,horizontal),horizontal);
});
