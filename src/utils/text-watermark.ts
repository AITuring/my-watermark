import {ensureWatermarkFont} from '@/pages/watermark/fonts/registry';
import {getWatermarkPreset} from '@/pages/watermark/layout-presets';
import {getImageOpaqueBounds} from '@/utils/watermark-editor';
import {arrangeWatermark} from './text-watermark-layout';
import type {MixedWatermarkConfig} from '@/types';

type Field='textLine1'|'textLine2';
type Rect={x:number;y:number;width:number;height:number};
export interface WatermarkTextRegion extends Rect{
    field:Field;fontSize:number;fontFamily:string;letterSpacing:number;
    inputOffsetX?:number;inputOffsetY?:number;lineHeight?:number;
}
type Glyph={text:string;x:number;y:number;angle:number;field?:Field;ink:Rect};
type TextShape=Rect&{glyphs:Glyph[]};

function measureShape(ctx:CanvasRenderingContext2D,runs:{text:string;field?:Field}[],vertical:boolean,size:number,spacing:number):TextShape{
    const glyphs:Glyph[]=[];let cursor=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const run of runs)for(const text of Array.from(run.text)){
        const m=ctx.measureText(text),box={left:-(m.actualBoundingBoxLeft??0),right:m.actualBoundingBoxRight??m.width,top:-(m.actualBoundingBoxAscent??size*.85),bottom:m.actualBoundingBoxDescent??size*.15};
        if(text===' '){cursor+=vertical?size*.65:m.width+spacing;continue;}
        let x=cursor,y=0,angle=0,ink:Rect;
        if(vertical){
            angle=text==='《'||text==='》'?Math.PI/2:0;
            const b=angle?{left:-box.bottom,right:-box.top,top:box.left,bottom:box.right}:box;
            const w=b.right-b.left,h=b.bottom-b.top;
            x=-w/2-b.left;y=cursor+(size-h)/2-b.top;
            ink={x:-w/2,y:cursor+(size-h)/2,width:w,height:h};cursor+=size+spacing;
        }else{ink={x:cursor+box.left,y:box.top,width:box.right-box.left,height:box.bottom-box.top};cursor+=m.width+spacing;}
        glyphs.push({text,x,y,angle,field:run.field,ink});left=Math.min(left,ink.x);top=Math.min(top,ink.y);right=Math.max(right,ink.x+ink.width);bottom=Math.max(bottom,ink.y+ink.height);
    }
    if(!glyphs.length)return{x:0,y:0,width:0,height:0,glyphs:[]};
    return{x:0,y:0,width:right-left,height:bottom-top,glyphs:glyphs.map(g=>({...g,x:g.x-left,y:g.y-top,ink:{...g.ink,x:g.ink.x-left,y:g.ink.y-top}}))};
}

/** Original pixels are preserved by the caller; the same PNG is used for preview and export. */
export async function createTextWatermark(config:MixedWatermarkConfig,onLayout?:(regions:WatermarkTextRegion[])=>void):Promise<string>{
    const runs=([['textLine1',config.textLine1],['textLine2',config.textLine2]] as const).map(([field,text])=>({field,text:text.trim()})).filter(run=>run.text);
    if(!runs.length&&(config.textOnly||!config.icon)){onLayout?.([]);return '';}
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建文字水印');
    const family=await ensureWatermarkFont(config.fontId||config.captionFontId,runs.map(run=>run.text).join('·'));
    const size=Math.max(24,config.fontSize*4),spacing=size*(config.letterSpacing??.1),vertical=config.layout==='vertical';
    await document.fonts.load(`${size}px ${family}`,runs.map(run=>run.text).join('')||'秋');ctx.font=`${size}px ${family}`;
    const preset=getWatermarkPreset(config),single=preset==='single'||runs.length<2;
    const joined=runs.flatMap((run,index)=>index?[{text:' · '},run]:[run]);
    const shapes=single&&runs.length?[measureShape(ctx,joined,vertical,size,spacing)]:runs.map(run=>measureShape(ctx,[run],vertical,size,spacing));
    let icon:HTMLImageElement|undefined;
    if(!config.textOnly&&config.icon)icon=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('水印图标加载失败'));image.src=config.icon;});
    const iconBounds=icon?getImageOpaqueBounds(icon):undefined;
    const geometry=arrangeWatermark(shapes,vertical,preset==='centered',size,size*(config.lineGap??.55),iconBounds?iconBounds.width/iconBounds.height:undefined);
    // Icon-only mode retains the existing size control; text layouts lock icon proportions.
    if(!shapes.length&&config.iconScale){for(const item of geometry.items){item.width*=config.iconScale;item.height*=config.iconScale;}geometry.width*=config.iconScale;geometry.height*=config.iconScale;}
    const padding=size*.3,scale=Math.min(1,8192/Math.max(geometry.width+padding*2,geometry.height+padding*2));
    canvas.width=Math.max(1,Math.ceil((geometry.width+padding*2)*scale));canvas.height=Math.max(1,Math.ceil((geometry.height+padding*2)*scale));
    ctx.scale(scale,scale);ctx.font=`${size}px ${family}`;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=config.color;
    const regions:WatermarkTextRegion[]=[];
    for(const item of geometry.items){
        const x=padding+item.x,y=padding+item.y;
        if(item.role==='icon'&&icon&&iconBounds){
            const tint=document.createElement('canvas');tint.width=Math.max(1,Math.ceil(item.width*3));tint.height=Math.max(1,Math.ceil(item.height*3));const c=tint.getContext('2d');if(!c)throw Error('无法绘制水印图标');
            c.drawImage(icon,iconBounds.x,iconBounds.y,iconBounds.width,iconBounds.height,0,0,tint.width,tint.height);c.globalCompositeOperation='source-in';c.fillStyle=config.color;c.fillRect(0,0,tint.width,tint.height);ctx.drawImage(tint,x,y,item.width,item.height);continue;
        }
        const shape=shapes[item.index!];
        for(const glyph of shape.glyphs){ctx.save();ctx.translate(x+glyph.x,y+glyph.y);if(glyph.angle)ctx.rotate(glyph.angle);ctx.fillText(glyph.text,0,0);ctx.restore();}
        for(const field of ['textLine1','textLine2'] as const){
            const glyphs=shape.glyphs.filter(g=>g.field===field);if(!glyphs.length)continue;
            const left=Math.min(...glyphs.map(g=>g.ink.x)),top=Math.min(...glyphs.map(g=>g.ink.y)),right=Math.max(...glyphs.map(g=>g.ink.x+g.ink.width)),bottom=Math.max(...glyphs.map(g=>g.ink.y+g.ink.height));
            const first=glyphs[0],metrics=ctx.measureText(first.text),asc=metrics.fontBoundingBoxAscent??size*.85,desc=metrics.fontBoundingBoxDescent??size*.15;
            const inputX=vertical?left+(right-left-size)/2:first.x;
            const inputY=vertical?first.ink.y+(first.ink.height-size)/2:first.y-(asc+(size-asc-desc)/2);
            const bleed=1;
            regions.push({field,x:(x+left-bleed)*scale,y:(y+top-bleed)*scale,width:(right-left+bleed*2)*scale,height:(bottom-top+bleed*2)*scale,fontSize:size*scale,fontFamily:family,letterSpacing:spacing*scale,
                inputOffsetX:(inputX-left+bleed)*scale,inputOffsetY:(inputY-top+bleed)*scale,lineHeight:1});
        }
    }
    onLayout?.(regions);return canvas.toDataURL('image/png');
}
