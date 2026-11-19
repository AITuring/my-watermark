export interface LayoutShape {width:number;height:number}
export interface LayoutItem {role:'text'|'icon';x:number;y:number;width:number;height:number;index?:number}

export type CaptionRun = {text:string;field?:'textLine1'|'textLine2'};

/** Keep only the first era segment for compact watermark output. */
export function getCompactWatermarkCaption(caption:string){
    return caption.split(' / ')[0].split('·')[0].trim();
}

/** Enlarge vertical glyphs while preserving the original character pitch. */
export function getFittedVerticalLetterSpacing(base:number,textScale:number){
    return (1+base)/Math.max(.1,textScale)-1;
}

/** The editorial order for a compact horizontal caption is era, title, collection. */
export function buildSingleLineCaptionRuns(title:string,caption:string,order:'title-first'|'era-first'='title-first',vertical=false):CaptionRun[]{
    const titleRun={text:title,field:'textLine1' as const};
    const separator={text:vertical?'·':' · '};
    if(!caption.trim())return title.trim()?[titleRun]:[];
    if(!title.trim())return [{text:caption,field:'textLine2'}];
    if(order!=='era-first')return [titleRun,separator,{text:caption,field:'textLine2'}];
    const [metadata,photographer]=caption.split(' / ');
    const parts=metadata.split('·').map(value=>value.trim()).filter(Boolean);
    if(parts.length===1)return [{text:parts[0],field:'textLine2'},separator,titleRun];
    if(parts.length<2)return [titleRun,separator,{text:caption,field:'textLine2'}];
    const era=parts.shift()!;
    const tail=[parts.join('·'),photographer].filter(Boolean).join(photographer?' / ':'');
    return [{text:era,field:'textLine2'},separator,titleRun,separator,{text:tail,field:'textLine2'}];
}

/** Keep digits upright; turn horizontal connecting strokes into vertical ones. */
export function getWatermarkGlyphRotation(character:string,vertical:boolean){
    return vertical&&'《》〈〉-－—–−~～'.includes(character)?Math.PI/2:0;
}

/** Positions use visible ink bounds. Preview and export use this one geometry. */
export function arrangeWatermark(shapes:LayoutShape[],vertical:boolean,centered:boolean,fontSize:number,lineGap:number,iconRatio?:number,iconScale=1){
    const items:LayoutItem[]=[],gap=vertical?fontSize*.5:fontSize;
    let width=0,height=0;
    const add=(role:'text'|'icon',shape:LayoutShape,x:number,y:number,index?:number)=>{items.push({role,x,y,width:shape.width,height:shape.height,index});width=Math.max(width,x+shape.width);height=Math.max(height,y+shape.height);};
    const icon=(h:number)=>({width:h*(iconRatio||1)*iconScale,height:h*iconScale});
    if(!shapes.length){if(iconRatio)add('icon',icon(fontSize*2.2),0,0);}
    else if(shapes.length===1){
        const text=shapes[0],logo=icon(vertical?Math.min(fontSize*1.7,text.width*1.5):text.height*1.18);
        if(vertical){const w=Math.max(text.width,iconRatio?logo.width:0);if(iconRatio)add('icon',logo,(w-logo.width)/2,0);add('text',text,(w-text.width)/2,iconRatio?logo.height+gap:0,0);}
        else{if(iconRatio)add('icon',logo,0,0);add('text',text,iconRatio?logo.width+gap:0,0,0);}
    }else if(vertical){
        // Legacy paired configs collapse into one column for saved sessions.
        const [first,second]=shapes;
        const logo=icon(Math.min(fontSize*1.7,Math.max(first.width,second.width)*1.5));
        const w=Math.max(first.width,second.width,iconRatio?logo.width:0),y=iconRatio?logo.height+gap:0;
        if(iconRatio)add('icon',logo,(w-logo.width)/2,0);
        add('text',first,(w-first.width)/2,y,0);add('text',second,(w-second.width)/2,y+first.height+lineGap,1);
    }else{
        const [first,second]=shapes,textHeight=first.height+lineGap+second.height;
        if(centered){
            const logo=icon(Math.max(first.height,second.height)*1.9),w=Math.max(first.width,second.width,iconRatio?logo.width:0),y=iconRatio?logo.height+gap:0;
            if(iconRatio)add('icon',logo,(w-logo.width)/2,0);
            add('text',first,(w-first.width)/2,y,0);add('text',second,(w-second.width)/2,y+first.height+lineGap,1);
        }else{
            const logo=icon(textHeight*1.15),x=iconRatio?logo.width+gap:0;
            if(iconRatio)add('icon',logo,0,0);add('text',first,x,0,0);add('text',second,x,first.height+lineGap,1);
        }
    }
    const logo=items.find(item=>item.role==='icon'),text=items.filter(item=>item.role==='text');
    if(vertical&&logo&&text.length){
        if(logo.y+logo.height>Math.min(...text.map(item=>item.y))-.01||logo.height>fontSize*1.7+.01)throw Error('竖排小印必须在文字上方，并保持固定小尺寸。');
    }
    return{width,height,items};
}
