import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const source=await readFile(new URL('../src/pages/watermark/font-selection.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const api={};vm.runInNewContext(code,{exports:api,require:()=>({DEFAULT_FONT_ID:'fzxijinljw'})});
const catalog=JSON.parse(await readFile(new URL('../src/pages/watermark/fonts/catalog.json',import.meta.url),'utf8'));

test('known artists select actual bundled fonts, with different calligraphic styles where available',()=>{
    const cases=[['元-赵孟頫《鹊华秋色图》','fzzhaomfksjf'],['元-赵孟頫《秋声赋卷》','fzzhaomfxsjf'],
        ['唐-颜真卿《祭侄文稿》','fzyanzqxsj'],['唐-颜真卿多宝塔碑','fzyanzqksjf'],
        ['东晋-王羲之兰亭序','fzwangxzxsjf'],['北宋-米芾蜀素帖','fzmifxsjw'],['唐-孙过庭书谱','fzsungtcsfu']];
    for(const [name,id] of cases){assert.equal(api.suggestWatermarkFont(name),id);assert.ok(catalog.some(font=>font.id===id));}
});
test('paintings can use a generic calligraphic treatment; objects and unknown files use Song',()=>{
    for(const name of ['北宋-祁序《江山放牧图卷》-故宫博物院藏.jpg','唐-韩休墓北壁《山水图》.jpg'])assert.equal(api.suggestWatermarkFont(name),'fzzhaomfksjf');
    for(const name of ['明-何朝宗德化窑白釉观音.jpg','春秋-四虎蟠龙纹豆.jpg','西汉-玉熊.jpg','DSC01067.jpg'])assert.equal(api.suggestWatermarkFont(name),'fzxijinljw');
});
test('title and description share one font while manual choices win over automatic suggestions',()=>{
    const automatic=api.resolveWatermarkTypography('明-何朝宗观音.jpg',{});
    assert.equal(automatic.fontId,'fzxijinljw');assert.equal(automatic.captionFontId,automatic.fontId);
    const manual=api.resolveWatermarkTypography('北宋-祁序《江山放牧图卷》.jpg',{}, {fontId:'kesong',captionFontId:'legacy'});
    assert.equal(manual.fontId,'kesong');assert.equal(manual.captionFontId,'kesong');
    const disabled=api.resolveWatermarkTypography('元-赵孟頫《秋声赋卷》.jpg',{fontId:'kesong'},{},false);
    assert.equal(disabled.fontId,'kesong');assert.equal(disabled.captionFontId,'kesong');
});
