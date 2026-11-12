import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const source = await readFile(new URL('../src/pages/watermark/preview-zoom.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
const api = {}; vm.runInNewContext(code, {exports: api});

test('zoom keeps the same image point in the viewport center, including after panning', () => {
    const before = {x: -120, y: 60}, width = 800, height = 500;
    const after = api.zoomAroundCenter(before, 1.5, 3, width, height);
    assert.equal((width / 2 - before.x) / 1.5, (width / 2 - after.x) / 3);
    assert.equal((height / 2 - before.y) / 1.5, (height / 2 - after.y) / 3);
    const reset = api.zoomAroundCenter(after, 3, 1, width, height);
    assert.equal(reset.x, 0); assert.equal(reset.y, 0);
});

test('initial fit uses the full viewport with a small inset and preserves complete image proportions', () => {
    for (const [width,height] of [[25365,4769],[5098,8158],[1457,1226]]) {
        const fit = api.fitPreviewImage(width,height,1200,800);
        assert.ok(fit.width<=1176+1e-8 && fit.height<=776+1e-8);
        assert.ok(Math.abs(fit.width-1176)<1e-8 || Math.abs(fit.height-776)<1e-8);
        assert.ok(Math.abs(fit.width/fit.height-width/height)<1e-8);
    }
});

test('zoom expands across the surrounding viewport instead of clipping at the fitted image edges', () => {
    const viewport={width:1200,height:800},image=api.fitPreviewImage(1457,1226,1200,800);
    const camera=api.previewPositionForCenter({x:.5,y:.5},2,viewport.width,viewport.height,image.width,image.height);
    const left=camera.x+(viewport.width-image.width)/2*2;
    const right=left+image.width*2;
    assert.ok(left<0);assert.ok(right>viewport.width);
    // The image crosses its old narrow fitted bounds; the canvas keeps all 1200 pixels.
    assert.ok(Math.min(viewport.width,right)-Math.max(0,left)>image.width);
});

test('pan and zoom preserve the same image point at the viewport center', () => {
    const viewport={width:1200,height:800},image=api.fitPreviewImage(25365,4769,1200,800);
    const camera=api.previewPositionForCenter({x:.5,y:.5},2,1200,800,image.width,image.height);
    const dragged={x:camera.x-180,y:camera.y+30};
    const center=api.previewCenterForPosition(dragged,2,1200,800,image.width,image.height);
    assert.ok(center.x>.5);assert.ok(center.y<.5);
    for (const zoom of [2,3,5]) {
        const next=api.previewPositionForCenter(center,zoom,viewport.width,viewport.height,image.width,image.height);
        assert.ok(Math.abs(next.x+((viewport.width-image.width)/2+center.x*image.width)*zoom-viewport.width/2)<1e-8);
        assert.ok(Math.abs(next.y+((viewport.height-image.height)/2+center.y*image.height)*zoom-viewport.height/2)<1e-8);
    }
});

test('resizing the preview keeps the selected image point centered; fit resets panning', () => {
    for (const [width,height] of [[1600,900],[900,700],[1200,800]]) {
        const image=api.fitPreviewImage(5098,8158,width,height),center={x:.7,y:.3};
        const position=api.previewPositionForCenter(center,3,width,height,image.width,image.height);
        const restored=api.previewCenterForPosition(position,3,width,height,image.width,image.height);
        assert.ok(Math.abs(restored.x-center.x)<1e-8);assert.ok(Math.abs(restored.y-center.y)<1e-8);
        const fit=api.previewPositionForCenter(center,1,width,height,image.width,image.height);
        assert.equal(fit.x,0);assert.equal(fit.y,0);
    }
});

test('panning cannot lose the image completely and invalid image dimensions are safe', () => {
    const center=api.previewCenterForPosition({x:1e8,y:-1e8},5,1200,800,1000,600);
    assert.equal(center.x,0);assert.equal(center.y,1);
    const fit=api.fitPreviewImage(0,0,1200,800);
    assert.equal(fit.width,0);assert.equal(fit.height,0);
});
