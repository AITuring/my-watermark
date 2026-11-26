import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {createTypeScriptLoader} from './helpers/load-typescript.mjs';
const load = createTypeScriptLoader({'@/utils/lazy-deps': {loadJSZip: async () => JSZip, loadSaveAs: async () => () => assert.fail('unexpected downloader')}});
const {exportImages, uniqueExportName} = load('src/utils/image-export/index.ts');
const renderer = item => ({name: item.name, data: new Blob([item.content], {type:'image/png'})});

test('ZIP preserves every repeated filename, paths are flattened, and progress is monotonic', async () => {
    const files = [{name:'a/b.png',content:'one'},{name:'a/b.png',content:'two'},{name:'a_b (2).png',content:'three'}];
    const downloads=[], progress=[];
    await exportImages(files, renderer, {mode:'zip', archiveName:'test.zip', download:(data,name)=>downloads.push({data,name}), onProgress:p=>progress.push(p)});
    assert.equal(downloads.length,1); assert.equal(downloads[0].name,'test.zip');
    const zip=await JSZip.loadAsync(await downloads[0].data.arrayBuffer());
    assert.equal(await zip.file('a_b.png').async('string'),'one');
    assert.equal(await zip.file('a_b (2).png').async('string'),'two');
    assert.equal(await zip.file('a_b (2) (2).png').async('string'),'three');
    assert.equal(progress.at(-1),100); assert.ok(progress.every((p,i)=>i===0||p>=progress[i-1]));
});
test('current mode renders only the requested first image; files mode does not mutate source order', async () => {
    const files=[{name:'b.png',content:'b'},{name:'a.png',content:'a'}], calls=[], downloads=[];
    await exportImages(files, (item,index)=>{calls.push(index);return renderer(item)}, {mode:'current', download:(_,name)=>downloads.push(name)});
    assert.deepEqual(calls,[0]);assert.deepEqual(downloads,['b.png']);
    await exportImages(files,renderer,{mode:'files',intervalMs:0,download:(_,name)=>downloads.push(name)});
    assert.deepEqual(downloads,['b.png','b.png','a.png']);assert.equal(files[0].name,'b.png');
});
test('ZIP means ZIP even with one image unless a legacy caller opts out', async () => {
    const files=[{name:'one.png',content:'image'}], downloads=[];
    await exportImages(files,renderer,{mode:'zip',download:(data,name)=>downloads.push({data,name})});
    assert.ok((await JSZip.loadAsync(await downloads[0].data.arrayBuffer())).file('one.png'));
    await exportImages(files,renderer,{mode:'zip',singleFileAsFile:true,download:(_,name)=>downloads.push({name})});
    assert.equal(downloads[1].name,'one.png');
});
test('render failure rejects, emits no incomplete ZIP and never reports completion', async () => {
    const progress=[];
    await assert.rejects(exportImages([1,2],n=>{if(n===2)throw new Error('decode failed');return renderer({name:'one.png',content:'one'})}, {mode:'zip',download:()=>assert.fail(),onProgress:p=>progress.push(p)}), /decode failed/);
    assert.ok(progress.every(p=>p<100));
});
test('empty jobs do nothing; empty/path-only names receive a safe basename', async () => {
    await exportImages([],()=>assert.fail(),{mode:'zip',download:()=>assert.fail()});
    const used=new Set();assert.equal(uniqueExportName('..',used),'image');assert.equal(uniqueExportName('',used),'image (2)');
});

test('compress export failure keeps the existing user-facing error instead of an unhandled rejection', async () => {
    const notifications=[];
    const serviceLoad=createTypeScriptLoader({
        '@/utils/image-export': {downloadExportFiles: async () => {throw new Error('archive failed');}},
        '@/utils/lazy-deps': {}, '@/utils/large-image': {},
    }, {alert: message=>notifications.push(message), console:{...console,error:()=>{}}});
    const {exportCompressedImages}=serviceLoad('src/pages/compress/services.ts');
    await exportCompressedImages([{compressedFile:new File(['image'],'photo.jpg',{type:'image/jpeg'})}]);
    assert.deepEqual(notifications,['导出失败，请重试']);
});
