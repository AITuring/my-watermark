import {DEFAULT_FONT_ID, ensureWatermarkFont, fontFamily, fontName} from '/src/pages/watermark/fonts/registry';
import {getImageOpaqueBounds} from '/src/utils/watermark-editor';
import {analyzeWatermarkColor} from '/src/pages/watermark/adaptive-color';
import {getWatermarkLayoutMetrics} from '/src/pages/watermark/layout-metrics';

type Material={id:number;name:string;sourceWidth:number;sourceHeight:number;width:number;height:number;url:string};
type Rect={x:number;y:number;width:number;height:number};
type Result={url:string;diagnostics:Record<string,unknown>};
const paintings=new Set([1,5,10,11,12,13,14]); // visually checked against all 23 supplied full frames
const title='《江山放牧图卷》', caption='北宋·祁序·故宫博物院藏', signature='笑谈间气吐霓虹摄';
const materials:Material[]=await (await fetch('/.watermark-review.local/materials.json')).json();
const results=new Map<number,Result>(), references=new Map<number,number>([[1,72],[10,127],[11,120],[12,88]]);
// Review annotations for this supplied set, not a claim of automatic semantic
// segmentation. Coordinates are normalized to each COMPLETE source frame.
const safeAreas:Record<number,number[][]>={
 1:[[.58,.025,.27,.074]],2:[[.64,.095,.28,.10]],3:[[.055,.81,.30,.12]],
 4:[[.055,.075,.28,.12],[.73,.91,.22,.06]],5:[],
 6:[[.06,.58,.27,.13]],7:[[.075,.68,.28,.16]],8:[[.08,.18,.26,.13]],
 9:[[.06,.50,.28,.14]],10:[[.33,.39,.15,.13],[.66,.50,.16,.10]],
 11:[[.40,.055,.29,.16]],12:[[.31,.16,.29,.075]],13:[[.55,.22,.30,.15]],
 14:[[.33,.065,.30,.15]],15:[[.53,.22,.33,.15]],16:[[.045,.58,.26,.16]],
 17:[[.72,.06,.24,.14]],18:[[.045,.57,.27,.16]],19:[[.075,.14,.28,.16]],
 20:[[.035,.63,.28,.15]],21:[[.055,.40,.28,.14]],22:[[.065,.17,.32,.16]],
 23:[[.22,.24,.37,.15]],
};
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let current=10, ticket=0;
const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
const symbol=await load('/watermark-symbol.png'), fullLogo=await load('/logo.png');

function chooseRegion(photo:HTMLImageElement,width:number,height:number,id:number,avoid:Rect[]=[]):Rect|null {
 const sample=document.createElement('canvas');sample.width=240;sample.height=Math.max(1,Math.round(photo.height/photo.width*240));
 const ctx=sample.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(photo,0,0,sample.width,sample.height);
 const w=photo.width,h=photo.height;
 let best:Rect|null=null,score=Infinity;
 for(const [zx,zy,zw,zh] of safeAreas[id]||[]) for(const fy of [0,.5,1]) for(const fx of [0,.5,1]) {
  if(zw*w<width||zh*h<height)continue;
  const rect={x:zx*w+(zw*w-width)*fx,y:zy*h+(zh*h-height)*fy,width,height};
  if(avoid.some(other=>rect.x<other.x+other.width*1.15&&rect.x+rect.width*1.15>other.x&&rect.y<other.y+other.height*2&&rect.y+rect.height*2>other.y))continue;
  const x=Math.floor(rect.x/w*sample.width),y=Math.floor(rect.y/h*sample.height);
  const sw=Math.max(2,Math.min(sample.width-x,Math.ceil(width/w*sample.width))),sh=Math.max(2,Math.min(sample.height-y,Math.ceil(height/h*sample.height)));
  const {data}=ctx.getImageData(x,y,sw,sh);let detail=0;
  for(let p=0;p<data.length;p+=4)if(p>=4)detail+=Math.abs(data[p]-data[p-4]);
  const n=data.length/4;
  const candidateScore=detail/n/180+(1-analyzeWatermarkColor(data).coverage)*.6;
  if(candidateScore<score){best=rect;score=candidateScore;}
 }
 return best;
}

async function render(material:Material):Promise<Result> {
 const photo=await load(material.url),canvas=document.createElement('canvas');canvas.width=photo.naturalWidth;canvas.height=photo.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(photo,0,0);
 const fontId=paintings.has(material.id)?'fzzhaomfksjf':DEFAULT_FONT_ID;
 await ensureWatermarkFont(fontId,title+caption+signature);
 const base=getWatermarkLayoutMetrics(material.sourceWidth,material.sourceHeight,references.get(material.id));
 const viewScale=photo.width/material.sourceWidth,multiplier=Number(el<HTMLInputElement>('scale').value)||1;
 const size=base.title*viewScale*multiplier,small=base.caption*viewScale*multiplier,credit=base.signature*viewScale*multiplier;
 const face=fontFamily(fontId);ctx.textBaseline='top';ctx.font=`${size}px ${face}`;
 const titleWidth=ctx.measureText(title).width;ctx.font=`${small}px ${face}`;const captionWidth=ctx.measureText(caption).width;
 ctx.font=`${credit}px ${face}`;const signatureWidth=ctx.measureText(signature).width;
 const mode=el<HTMLSelectElement>('mode').value;
 const textHeight=size*1.3+small*1.4+credit*1.5;
 const bounds=getImageOpaqueBounds(mode==='image'?fullLogo:symbol);
 const iconH=mode==='image'?size*6:mode==='mixed'?textHeight:0,iconW=iconH*bounds.width/bounds.height;
 const groupWidth=mode==='image'?iconW:iconW+(iconW?size*.55:0)+Math.max(titleWidth,captionWidth,signatureWidth);
 const groupHeight=mode==='image'?iconH:textHeight;
 const group=chooseRegion(photo,groupWidth,groupHeight,material.id);
 if(!group)return {url:canvas.toDataURL('image/jpeg',.94),diagnostics:{id:material.id,name:material.name,fontId,fontName:fontName(fontId),original:[material.sourceWidth,material.sourceHeight],preview:[canvas.width,canvas.height],fullFrame:true,inBounds:true,needsManual:true,reason:'没有足够的已确认非主体区域，不强行覆盖主体',titlePx:Math.round(base.title*multiplier),captionPx:Math.round(base.caption*multiplier),basis:base.basis,fontUnified:true,mode,layout:el<HTMLSelectElement>('layout').value,regions:[]}};
 const imageData=ctx.getImageData(Math.floor(group.x),Math.floor(group.y),Math.max(1,Math.min(canvas.width-Math.ceil(group.x),Math.ceil(group.width))),Math.max(1,Math.min(canvas.height-Math.ceil(group.y),Math.ceil(group.height))));
 let color=analyzeWatermarkColor(imageData.data).color;
 if(paintings.has(material.id)){
  let luminance=0;
  for(let p=0;p<imageData.data.length;p+=4){const channels=[imageData.data[p],imageData.data[p+1],imageData.data[p+2]].map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});luminance+=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
  // On mid/light paper, use the same restrained ink direction as the original
  // inscriptions instead of choosing the brightest possible contrasting label.
  if(luminance/(imageData.data.length/4)>.12)color='#352f28';
 }
 const logoCanvas=document.createElement('canvas');logoCanvas.width=Math.max(1,Math.ceil(iconW));logoCanvas.height=Math.max(1,Math.ceil(iconH));
 if(iconW){const lctx=logoCanvas.getContext('2d')!;lctx.drawImage(mode==='image'?fullLogo:symbol,bounds.x,bounds.y,bounds.width,bounds.height,0,0,iconW,iconH);lctx.globalCompositeOperation='source-in';lctx.fillStyle=color;lctx.fillRect(0,0,iconW,iconH);ctx.globalAlpha=.65;ctx.drawImage(logoCanvas,group.x,group.y);}
 if(mode!=='image'){
  const x=group.x+iconW+(iconW?size*.55:0);let y=group.y;
  ctx.fillStyle=color;ctx.globalAlpha=.72;ctx.font=`${size}px ${face}`;ctx.fillText(title,x,y);y+=size*1.3;
  ctx.globalAlpha=.62;ctx.font=`${small}px ${face}`;ctx.fillText(caption,x,y);y+=small*1.4;
  ctx.globalAlpha=.62;ctx.font=`${credit}px ${face}`;ctx.fillText(signature,x,y);
 }
 const regions=[group];
 if(el<HTMLSelectElement>('layout').value==='distributed'){
  const extra=chooseRegion(photo,mode==='image'?iconW*.6:signatureWidth,mode==='image'?iconH*.6:credit*1.5,material.id,regions);
  if(extra){regions.push(extra);
  const data=ctx.getImageData(Math.floor(extra.x),Math.floor(extra.y),Math.max(1,Math.ceil(extra.width)),Math.max(1,Math.ceil(extra.height)));
  ctx.fillStyle=analyzeWatermarkColor(data.data).color;ctx.globalAlpha=.46;
  if(mode==='image')ctx.drawImage(logoCanvas,extra.x,extra.y,extra.width,extra.height);
  else {ctx.font=`${credit}px ${face}`;ctx.fillText(signature,extra.x,extra.y);}
  }
 }
 ctx.globalAlpha=1;
 const inBounds=regions.every(rect=>rect.x>=0&&rect.y>=0&&rect.x+rect.width<=canvas.width+1&&rect.y+rect.height<=canvas.height+1);
 return {url:canvas.toDataURL('image/jpeg',.94),diagnostics:{id:material.id,name:material.name,fontId,fontName:fontName(fontId),original:[material.sourceWidth,material.sourceHeight],preview:[canvas.width,canvas.height],fullFrame:true,inBounds,needsManual:false,placementBasis:'review-annotated-safe-region',basis:base.basis,referenceTextHeight:references.get(material.id)||null,titlePx:Math.round(base.title*multiplier),captionPx:Math.round(base.caption*multiplier),fontUnified:true,mode,layout:el<HTMLSelectElement>('layout').value,color,regions:regions.map(r=>({x:r.x/viewScale,y:r.y/viewScale,width:r.width/viewScale,height:r.height/viewScale}))}};
}

function select(id:number){
 current=id;const material=materials.find(item=>item.id===id)!,result=results.get(id);
 el<HTMLImageElement>('original').src=material.url;
 const image=el<HTMLImageElement>('result');image.hidden=!result;if(result)image.src=result.url;
 el<HTMLInputElement>('reference').value=references.has(id)?String(references.get(id)):'';
 el('facts').textContent=result?`${id} · ${material.name} ｜原图 ${material.sourceWidth}×${material.sourceHeight} ｜标题 ${result.diagnostics.titlePx}px / 说明 ${result.diagnostics.captionPx}px（原图尺度）｜${result.diagnostics.fontName}｜${result.diagnostics.basis==='reference-text'?'人工标定参考字高':'尺寸估算，未识别原画文字'}｜${result.diagnostics.needsManual?'需手动定位，未覆盖主体':'已标注非主体区域'}｜完整画面`:`${material.name} · 等待生成`;
 document.querySelectorAll<HTMLButtonElement>('.case').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.id)===id)));
}
async function run(){
 const request=++ticket;el<HTMLButtonElement>('run').disabled=true;el('errors').textContent='';results.clear();el('status').dataset.complete='false';el('status').textContent='正在生成 0/'+materials.length;
 for(const [index,material] of materials.entries()){
  try{const result=await render(material);if(request!==ticket)return;results.set(material.id,result);const card=document.querySelector<HTMLImageElement>(`.case[data-id="${material.id}"] img`)!;card.src=result.url;card.dataset.diagnostics=JSON.stringify(result.diagnostics);el('status').textContent=`已生成 ${index+1}/${materials.length}`;if(material.id===current)select(current);}
  catch(error){el('errors').textContent+=`${material.id}: ${String(error)}\n`;}
 }
 el<HTMLButtonElement>('run').disabled=false;el('status').dataset.complete=String(results.size===materials.length);select(current);
}
for(const material of materials){const button=document.createElement('button');button.className='case';button.dataset.id=String(material.id);button.setAttribute('aria-label',`查看素材 ${material.id}`);const image=document.createElement('img');image.src=material.url;image.alt=material.name;const title=document.createElement('strong');title.textContent=`${material.id} · ${material.name}`;button.append(image,title);button.onclick=()=>select(material.id);el('cases').append(button);}
el('run').onclick=()=>void run();
el('apply-reference').onclick=async()=>{const value=Number(el<HTMLInputElement>('reference').value);if(value>0)references.set(current,value);else references.delete(current);const result=await render(materials.find(item=>item.id===current)!);results.set(current,result);const image=document.querySelector<HTMLImageElement>(`.case[data-id="${current}"] img`)!;image.src=result.url;image.dataset.diagnostics=JSON.stringify(result.diagnostics);select(current);};
select(current);void run();
