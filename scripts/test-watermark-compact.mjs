import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
const source=await readFile(new URL('../src/utils/text-watermark-layout.ts',import.meta.url),'utf8');
const api={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:api});
test('compact vertical logo stays above both bottom-aligned columns',()=>{
    const layout=api.arrangeCompactWatermark({width:100,height:900},{width:55,height:450},true,100,1);
    const [seal,main,author]=layout.items;
    assert.ok(author.x-(main.x+main.width)>=100);
    assert.ok(seal.y+seal.height<Math.min(main.y,author.y));
    assert.equal(author.y+author.height,main.y+main.height);
});
test('long signatures, horizontal text and text-only layouts remain inside bounds',()=>{
    for(const vertical of [false,true])for(const main of [undefined,{width:100,height:200}])for(const author of [undefined,{width:55,height:500}])for(const ratio of [undefined,.4,1,3]){
        const layout=api.arrangeCompactWatermark(main,author,vertical,100,ratio);
        for(const item of layout.items){assert.ok(item.x>=0&&item.y>=0);assert.ok(item.x+item.width<=layout.width);assert.ok(item.y+item.height<=layout.height);}
        if(!ratio)assert.ok(layout.items.every(item=>item.role!=='icon'));
    }
});

test('single vertical column keeps logo first and author directly after name',()=>{
    const layout=api.arrangeCompactWatermark({width:100,height:900},{width:55,height:450},true,100,1,false);
    const [seal,main,author]=layout.items;
    assert.ok(author.y-(main.y+main.height)>=100);
    assert.ok(seal.y+seal.height<Math.min(main.y,author.y));
    for(const item of layout.items)assert.equal(item.x+item.width/2,layout.width/2);
});


test('narrow logos remain slightly wider than a full-size glyph',()=>{
    for(const ratio of [.4,1,3]){
        const {items}=api.arrangeCompactWatermark({width:100,height:900},{width:100,height:450},true,100,ratio,false);
        const seal=items.find(item=>item.role==='icon');
        assert.ok(seal.width>100&&seal.width<120);
        assert.ok(Math.abs(seal.width/seal.height-ratio)<1e-8);
    }
});
