import {ensureWatermarkFont} from '@/pages/watermark/fonts/registry';
import {getWatermarkPreset} from '@/pages/watermark/layout-presets';
import {getImageOpaqueBounds} from '@/utils/watermark-editor';
import {arrangeCompactWatermark,arrangeWatermark,buildSingleLineCaptionRuns,getCompactWatermarkCaption,getFittedVerticalLetterSpacing,getWatermarkGlyphRotation,splitLongCaptionForMultiple} from './text-watermark-layout';
import type {MixedWatermarkConfig} from '@/types';

type Field='textLine1'|'textLine2';
type Rect={x:number;y:number;width:number;height:number};
export interface WatermarkTextRegion extends Rect{
    field:Field;fontSize:number;fontFamily:string;letterSpacing:number;
    inputOffsetX?:number;inputOffsetY?:number;lineHeight?:number;
}
type Glyph={text:string;x:number;y:number;angle:number;field?:Field;fontSize:number;fontFamily:string;ink:Rect};
type TextShape=Rect&{glyphs:Glyph[]};

function measureShape(ctx:CanvasRenderingContext2D,runs:{text:string;field?:Field;fontScale?:number}[],vertical:boolean,size:number,spacing:number,family:string):TextShape{
    const glyphs:Glyph[]=[];let cursor=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const run of runs){
        const fontSize=size*Math.max(.1,run.fontScale??1);
        ctx.font=`${fontSize}px ${family}`;
        for(const text of Array.from(run.text)){
            const m=ctx.measureText(text),box={left:-(m.actualBoundingBoxLeft??0),right:m.actualBoundingBoxRight??m.width,top:-(m.actualBoundingBoxAscent??fontSize*.85),bottom:m.actualBoundingBoxDescent??fontSize*.15};
            if(text===' '){cursor+=vertical?fontSize*.65:m.width+spacing;continue;}
            let x=cursor,y=0,angle=0,ink:Rect;
            if(vertical){
                angle=getWatermarkGlyphRotation(text,vertical);
                const b=angle?{left:-box.bottom,right:-box.top,top:box.left,bottom:box.right}:box;
                const w=b.right-b.left,h=b.bottom-b.top;
                x=-w/2-b.left;y=cursor+(fontSize-h)/2-b.top;
                ink={x:-w/2,y:cursor+(fontSize-h)/2,width:w,height:h};cursor+=fontSize+spacing;
            }else{ink={x:cursor+box.left,y:box.top,width:box.right-box.left,height:box.bottom-box.top};cursor+=m.width+spacing;}
            glyphs.push({text,x,y,angle,field:run.field,fontSize,fontFamily:family,ink});left=Math.min(left,ink.x);top=Math.min(top,ink.y);right=Math.max(right,ink.x+ink.width);bottom=Math.max(bottom,ink.y+ink.height);
        }
    }
    if(!glyphs.length)return{x:0,y:0,width:0,height:0,glyphs:[]};
    return{x:0,y:0,width:right-left,height:bottom-top,glyphs:glyphs.map(g=>({...g,x:g.x-left,y:g.y-top,ink:{...g.ink,x:g.ink.x-left,y:g.ink.y-top}}))};
}

/** Original pixels are preserved by the caller; the same PNG is used for preview and export. */
export async function createTextWatermark(config:MixedWatermarkConfig,onLayout?:(regions:WatermarkTextRegion[])=>void):Promise<string>{
    const compactCaption=config.compactMode?getCompactWatermarkCaption(config.textLine2):config.textLine2;
    const runs=([['textLine1',config.textLine1],['textLine2',compactCaption]] as const).map(([field,text])=>({field,text:text.trim()})).filter(run=>run.text);
    const author=config.compactMode?(config.compactAuthor??'笑谈间气吐霓虹').trim():'';
    if(!author&&!runs.length&&(config.textOnly||!config.icon)){onLayout?.([]);return '';}
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建文字水印');
    const [family,authorFamily]=await Promise.all([
        ensureWatermarkFont(config.fontId||config.captionFontId,runs.map(run=>run.text).join('·')),
        author?ensureWatermarkFont(config.authorFontId||config.fontId||config.captionFontId,author):Promise.resolve(''),
    ]);
    const size=Math.max(24,config.fontSize*4),vertical=config.layout==='vertical',textScale=Math.max(.1,config.textScale??1);
    const baseLetterSpacing=config.letterSpacing??.1;
    const letterSpacing=vertical?getFittedVerticalLetterSpacing(baseLetterSpacing-.08,textScale):baseLetterSpacing;
    const spacing=size*letterSpacing;
    await Promise.all([document.fonts.load(`${size}px ${family}`,runs.map(run=>run.text).join('')||'秋'),...(author?[document.fonts.load(`${size}px ${authorFamily}`,author)]:[])]);ctx.font=`${size}px ${family}`;
    const preset=getWatermarkPreset(config),single=preset==='single'||runs.length<2;
    const joined=buildSingleLineCaptionRuns(runs[0]?.text||'',runs[1]?.text||'',config.compactMode?'era-first':config.singleLineOrder,vertical);
    const multiplePlan=!single&&!vertical
        ? splitLongCaptionForMultiple(runs[0]?.text||'',runs[1]?.text||'')
        : undefined;
    const shapes=config.compactMode
        ? (runs.length?[measureShape(ctx,joined,vertical,size,spacing,family)]:[])
        : single&&runs.length
        ? [measureShape(ctx,joined,vertical,size,spacing,family)]
        : multiplePlan
            ? [measureShape(ctx,multiplePlan.first,vertical,size,spacing,family),measureShape(ctx,multiplePlan.second,vertical,size,spacing,family)]
            : runs.map(run=>measureShape(ctx,[run],vertical,size,spacing,family));
    const compactMain=config.compactMode?shapes[0]:undefined;
    const authorShape=author?measureShape(ctx,[{text:author}],vertical,size,spacing,authorFamily):undefined;
    if(authorShape)shapes.push(authorShape);
    let icon:HTMLImageElement|undefined;
    if(!config.textOnly&&config.icon)icon=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('水印图标加载失败'));image.src=config.icon;});
    const iconBounds=icon?getImageOpaqueBounds(icon):undefined;
    const geometry=config.compactMode?arrangeCompactWatermark(compactMain,authorShape,vertical,size,iconBounds?iconBounds.width/iconBounds.height:undefined,preset!=='single'):arrangeWatermark(shapes,vertical,preset==='centered',size,size*(config.lineGap??.55),iconBounds?iconBounds.width/iconBounds.height:undefined,vertical?1/Math.max(1,textScale):1);
    // Icon-only mode retains the existing size control; text layouts lock icon proportions.
    if(!shapes.length&&config.iconScale){for(const item of geometry.items){item.width*=config.iconScale;item.height*=config.iconScale;}geometry.width*=config.iconScale;geometry.height*=config.iconScale;}
    const padding=size*.3,horizontalScale=Math.max(.1,Math.min(1,config.textHorizontalScale??1));
    const scale=Math.min(1,8192/Math.max((geometry.width+padding*2)*horizontalScale,geometry.height+padding*2));
    const xScale=scale*horizontalScale;
    canvas.width=Math.max(1,Math.ceil((geometry.width+padding*2)*xScale));canvas.height=Math.max(1,Math.ceil((geometry.height+padding*2)*scale));
    ctx.scale(xScale,scale);ctx.font=`${size}px ${family}`;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=config.color;
    const regions:WatermarkTextRegion[]=[];
    for(const item of geometry.items){
        const x=padding+item.x,y=padding+item.y;
        if(item.role==='icon'&&icon&&iconBounds){
            const tint=document.createElement('canvas');tint.width=Math.max(1,Math.ceil(item.width*3));tint.height=Math.max(1,Math.ceil(item.height*3));const c=tint.getContext('2d');if(!c)throw Error('无法绘制水印图标');
            c.drawImage(icon,iconBounds.x,iconBounds.y,iconBounds.width,iconBounds.height,0,0,tint.width,tint.height);c.globalCompositeOperation='source-in';c.fillStyle=config.iconColor||config.color;c.fillRect(0,0,tint.width,tint.height);ctx.drawImage(tint,x,y,item.width,item.height);continue;
        }
        const shape=shapes[item.index!];
        for(const glyph of shape.glyphs){ctx.save();ctx.font=`${glyph.fontSize}px ${glyph.fontFamily}`;ctx.translate(x+glyph.x,y+glyph.y);if(glyph.angle)ctx.rotate(glyph.angle);ctx.fillText(glyph.text,0,0);ctx.restore();}
        for(const field of ['textLine1','textLine2'] as const){
            const glyphs=shape.glyphs.filter(g=>g.field===field);if(!glyphs.length)continue;
            const left=Math.min(...glyphs.map(g=>g.ink.x)),top=Math.min(...glyphs.map(g=>g.ink.y)),right=Math.max(...glyphs.map(g=>g.ink.x+g.ink.width)),bottom=Math.max(...glyphs.map(g=>g.ink.y+g.ink.height));
            const first=glyphs[0];ctx.font=`${first.fontSize}px ${family}`;const metrics=ctx.measureText(first.text),asc=metrics.fontBoundingBoxAscent??first.fontSize*.85,desc=metrics.fontBoundingBoxDescent??first.fontSize*.15;
            const inputX=vertical?left+(right-left-first.fontSize)/2:first.x;
            const inputY=vertical?first.ink.y+(first.ink.height-first.fontSize)/2:first.y-(asc+(first.fontSize-asc-desc)/2);
            const bleed=1;
            regions.push({field,x:(x+left-bleed)*xScale,y:(y+top-bleed)*scale,width:(right-left+bleed*2)*xScale,height:(bottom-top+bleed*2)*scale,fontSize:first.fontSize*scale,fontFamily:family,letterSpacing:spacing*xScale,
                inputOffsetX:(inputX-left+bleed)*xScale,inputOffsetY:(inputY-top+bleed)*scale,lineHeight:1});
        }
    }
    onLayout?.(regions);return canvas.toDataURL('image/png');
}
