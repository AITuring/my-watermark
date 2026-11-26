import assert from 'node:assert/strict';
import test from 'node:test';
import {createTypeScriptLoader} from './helpers/load-typescript.mjs';

function fixture({failDecode=false, failCanvas=false}={}) {
    const created=[], revoked=[], decoded=[], draws=[];
    const source=new File(['retained original'],'photo.jpg',{type:'image/jpeg'});
    class Image {
        width=120; height=80; naturalWidth=0; complete=false;
        set src(value) {
            decoded.push(value);
            queueMicrotask(()=>{if(failDecode||value==='blob:expired')this.onerror?.();else{this.naturalWidth=120;this.complete=true;this.onload?.();}});
        }
    }
    const context={drawImage:(...args)=>draws.push(args),fillRect(){},translate(){},rotate(){}};
    const document={createElement:()=>({width:0,height:0,getContext:()=>failCanvas?null:context,toBlob:callback=>callback(new Blob(['output'],{type:'image/jpeg'}))})};
    const URL={createObjectURL:file=>{created.push(file);return `blob:fresh-${created.length}`},revokeObjectURL:url=>revoked.push(url)};
    const load=createTypeScriptLoader({'@/utils/large-image':{getLargeImageAsset:async()=>null}}, {Image,document,URL});
    return {api:load('src/pages/crop/image-utils.ts'),image:{file:source,url:'blob:expired',previewUrl:'blob:expired',name:'photo',width:120,height:80},source,created,revoked,decoded,draws};
}

test('crop decodes the retained file rather than an expired preview URL and keeps exact source/output bounds',async()=>{
    const f=fixture();const crop={x:10,y:20,w:30,h:40};
    const blob=await f.api.drawCropToBlob(f.image,crop,300,400);
    assert.equal(blob.type,'image/jpeg');assert.equal(f.created[0],f.source);
    assert.deepEqual(f.decoded,['blob:fresh-1']);assert.deepEqual(f.revoked,['blob:fresh-1']);
    assert.deepEqual(f.draws[0].slice(1),[10,20,30,40,0,0,300,400]);
});
test('temporary source URLs are released on decode and canvas failures',async()=>{
    const f=fixture({failDecode:true});
    await assert.rejects(f.api.drawCropToBlob(f.image,{x:0,y:0,w:10,h:10},10,10),/load-image-failed/);
    assert.deepEqual(f.revoked,['blob:fresh-1']);
    const g=fixture({failCanvas:true});
    assert.equal(await g.api.drawCropToBlob(g.image,{x:0,y:0,w:10,h:10},10,10),null);
    assert.deepEqual(g.revoked,['blob:fresh-1']);
});
test('rotation also survives expired session URLs and retains its generated file',async()=>{
    const f=fixture();const rotated=await f.api.transformImageAsset(f.image,90);
    assert.equal(rotated.file.type,'image/jpeg');assert.equal(rotated.url,'blob:fresh-2');
    assert.deepEqual(f.decoded,['blob:fresh-1']);assert.deepEqual(f.revoked,['blob:fresh-1']);
    assert.equal(f.created[0],f.source);
});
