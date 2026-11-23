import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/pages/puzzle/fixed-ratio.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {recommendColumns,fixedRatioPlacements,exactRatioSize}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
for(const count of [1,2,7,50,115]) {
 const photos=Array.from({length:count},(_,i)=>i%2?{width:600,height:900}:{width:1200,height:800});
 for(const [rw,rh] of [[3,2],[2,3],[1,1],[16,9]]) {
  const width=1231,height=width*rh/rw,columns=recommendColumns(photos,rw/rh);
  for(const gap of [0,8,50]) {
   const positions=fixedRatioPlacements(photos,width,height,columns,gap);
   assert.equal(positions.length,count);
   positions.forEach((p,i)=>{assert.ok(p.width>0&&p.height>0);assert.ok(p.x>=0&&p.y>=0);assert.ok(p.x+p.width<=width+1e-8);assert.ok(p.y+p.height<=height+1e-8);assert.ok(Math.abs(p.width/p.height-photos[i].width/photos[i].height)<1e-10);});
  }
  const size=exactRatioSize(1231*6,rw,rh);
  assert.equal(size.width*rh,size.height*rw);
  assert.ok(size.width<=16384&&size.height<=16384&&size.width*size.height<=32000000);
 }
}
console.log('Fixed ratio: exact dimensions, complete photos, and bounds checks passed');
