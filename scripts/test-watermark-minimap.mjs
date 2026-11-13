import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

async function module(path){
    const source=await readFile(new URL(path,import.meta.url),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const api={};vm.runInNewContext(code,{exports:api});return api;
}
const api=await module('../src/pages/watermark/preview-minimap.ts');
const camera=await module('../src/pages/watermark/preview-zoom.ts');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('minimap rectangle matches the actual visible source region for panorama, portrait and mural',()=>{
    for(const [w,h] of [[25365,4769],[5098,8158],[11789,9920]])for(const zoom of [1.5,3.45,5])for(const center of [{x:.5,y:.5},{x:.1,y:.8},{x:1,y:0}]){
        const image=camera.fitPreviewImage(w,h,1200,800);
        const position=camera.previewPositionForCenter(center,zoom,1200,800,image.width,image.height);
        const left=position.x+(1200-image.width)/2*zoom,top=position.y+(800-image.height)/2*zoom;
        const view=api.getMinimapViewport(center,zoom,1200,800,image.width,image.height);
        close(view.x,Math.max(0,-left/(image.width*zoom)));
        close(view.y,Math.max(0,-top/(image.height*zoom)));
        close(view.x+view.width,Math.min(1,(1200-left)/(image.width*zoom)));
        close(view.y+view.height,Math.min(1,(800-top)/(image.height*zoom)));
    }
});

test('letterboxed dimensions show the complete image, without a rectangle outside the thumbnail',()=>{
    const view=api.getMinimapViewport({x:.5,y:.5},2,1200,800,1176,221);
    assert.equal(view.y,0);assert.equal(view.height,1);
    close(view.width,1200/2352);
});

test('clicking any thumbnail point centers that source point in the large viewport',()=>{
    const center=api.minimapPointToCenter({x:.23,y:.81});
    const position=camera.previewPositionForCenter(center,3,1200,800,600,776);
    close(position.x+(300+center.x*600)*3,600);
    close(position.y+(12+center.y*776)*3,400);
});

test('dragging preserves the grabbed offset instead of snapping the rectangle to the pointer',()=>{
    const old={x:.5,y:.5},grab={x:.58,y:.54};
    const offset={x:grab.x-old.x,y:grab.y-old.y};
    const unchanged=api.minimapPointToCenter(grab,offset);
    close(unchanged.x,old.x);close(unchanged.y,old.y);
    const moved=api.minimapPointToCenter({x:.78,y:.44},offset);
    close(moved.x,.7);close(moved.y,.4);
});

test('dragging outside the miniature image remains bounded, including cancelled or invalid input',()=>{
    const center=api.minimapPointToCenter({x:-10,y:10});
    assert.equal(center.x,0);assert.equal(center.y,1);
    const invalid=api.minimapPointToCenter({x:NaN,y:Infinity});
    assert.equal(invalid.x,.5);assert.equal(invalid.y,.5);
    const empty=api.getMinimapViewport({x:.5,y:.5},3,1200,800,0,0);
    assert.equal(empty.width,1);assert.equal(empty.height,1);
});

test('a new zoom or resized viewport updates the navigation footprint at the same source center',()=>{
    const center={x:.6,y:.4},image=camera.fitPreviewImage(5098,8158,1200,800);
    const low=api.getMinimapViewport(center,2,1200,800,image.width,image.height);
    const high=api.getMinimapViewport(center,4,1200,800,image.width,image.height);
    assert.ok(high.width<low.width);assert.ok(high.height<low.height);
    close(high.x+high.width/2,center.x);close(high.y+high.height/2,center.y);
    const resizedImage=camera.fitPreviewImage(5098,8158,900,800);
    const resized=api.getMinimapViewport(center,4,900,800,resizedImage.width,resizedImage.height);
    assert.ok(resized.width<high.width);close(resized.x+resized.width/2,center.x);
});
