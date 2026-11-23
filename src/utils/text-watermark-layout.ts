export interface LayoutShape {width:number;height:number}
export interface LayoutItem {role:'text'|'icon';x:number;y:number;width:number;height:number;index?:number}

export type CaptionRun = {text:string;field?:'textLine1'|'textLine2';fontScale?:number};

export type MultipleCaptionLinePlan = {
    first: CaptionRun[];
    second: CaptionRun[];
    promoted: boolean;
    firstText: string;
    secondText: string;
};

const ERA_NAMES = [
    '旧石器时代','新石器时代','春秋战国','三国','东晋','西晋','十六国','南北朝','北魏','东魏','西魏','北齐','北周',
    '五代十国','后梁','后唐','后晋','后汉','后周','南唐','北宋','南宋','宋元','明清','民国','近现代',
    '前秦','后秦','西汉','东汉','隋唐','唐宋','辽金','西夏','秦汉','唐','宋','元','明','清','汉','晋','秦','隋','辽','金','周','民国'
].sort((a,b)=>b.length-a.length);
const ERA_NUMBER = /^(?:约|大约)?\s*[0-9０-９一二三四五六七八九十百千万〇零]{1,6}\s*(?:[-－—–−~～至到]\s*[0-9０-９一二三四五六七八九十百千万〇零]{1,6}\s*)?(?:世纪|年代|年)/;
const ERA_MARKER = /(?:世纪|年代|时期|时代|文化|文明|帝国|王朝|年|代)$/;

function visualLength(value:string){
    return Array.from(value.trim()).reduce((total,character)=>total+(character.charCodeAt(0)<=127?.55:1),0);
}

function isEraToken(value:string){
    const token=value.trim();
    if(!token)return false;
    if(ERA_NUMBER.test(token)||ERA_MARKER.test(token))return true;
    return ERA_NAMES.some(name=>token===name || (token.startsWith(name) && ERA_MARKER.test(token.slice(name.length))));
}

/** Move a long caption's era into the larger first line for paired layouts. */
export function splitLongCaptionForMultiple(title:string,caption:string,enabled=true):MultipleCaptionLinePlan{
    const baseFirst=title.trim(),baseSecond=caption.trim();
    const unchanged={first:[{text:baseFirst,field:'textLine1' as const}],second:[{text:baseSecond,field:'textLine2' as const}],promoted:false,firstText:baseFirst,secondText:baseSecond};
    if(!enabled||!baseFirst||!baseSecond||visualLength(baseSecond)<24)return unchanged;
    const [metadata,...credits]=baseSecond.split(' / ');
    const parts=metadata.split('·').map(value=>value.trim()).filter(Boolean);
    if(parts.length<2||!isEraToken(parts[0]))return unchanged;
    const era=parts[0],restMetadata=parts.slice(1).join('·');
    const rest=[restMetadata,credits.join(' / ')].filter(Boolean).join(' / ');
    if(visualLength(rest)<14)return unchanged;
    const firstText=`${era} · ${baseFirst}`;
    return {
        // The promoted era is derived from textLine2 but is intentionally not
        // an editable region of its own; editing the full caption remains tied
        // to the second line below and avoids a duplicate textLine2 editor.
        first:[{text:era,fontScale:1.14},{text:' · ',fontScale:1.14},{text:baseFirst,field:'textLine1',fontScale:1.14}],
        second:[{text:rest,field:'textLine2'}],
        promoted:true,
        firstText,
        secondText:rest,
    };
}

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
    // Rotate punctuation that has a dedicated vertical-writing orientation.
    // In particular, full-width parentheses must become horizontal arcs in a
    // vertical column; leaving them upright makes the pair look like tall,
    // uneven side marks around the caption.
    return vertical&&'《》〈〉（）()-－—–−~～'.includes(character)?Math.PI/2:0;
}

/** Positions use visible ink bounds. Preview and export use this one geometry. */
export function arrangeWatermark(shapes:LayoutShape[],vertical:boolean,centered:boolean,fontSize:number,lineGap:number,iconRatio?:number,iconScale=1){
    const items:LayoutItem[]=[],gap=vertical?fontSize*.75:fontSize;
    let width=0,height=0;
    const add=(role:'text'|'icon',shape:LayoutShape,x:number,y:number,index?:number)=>{items.push({role,x,y,width:shape.width,height:shape.height,index});width=Math.max(width,x+shape.width);height=Math.max(height,y+shape.height);};
    const icon=(h:number)=>({width:h*(iconRatio||1)*iconScale,height:h*iconScale});
    if(!shapes.length){if(iconRatio)add('icon',icon(fontSize*2.2),0,0);}
    else if(shapes.length===1){
        const text=shapes[0],logo=icon(vertical?Math.min(fontSize*1.3,text.width*1.15):text.height*1.18);
        if(vertical){const w=Math.max(text.width,iconRatio?logo.width:0);if(iconRatio)add('icon',logo,(w-logo.width)/2,0);add('text',text,(w-text.width)/2,iconRatio?logo.height+gap:0,0);}
        else{if(iconRatio)add('icon',logo,0,0);add('text',text,iconRatio?logo.width+gap:0,0,0);}
    }else if(vertical){
        // Legacy paired configs collapse into one column for saved sessions.
        const [first,second]=shapes;
        const logo=icon(Math.min(fontSize*1.3,Math.max(first.width,second.width)*1.15));
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

/** Compact layouts keep the logo before the caption and signature. */
export function arrangeCompactWatermark(main:LayoutShape|undefined,author:LayoutShape|undefined,vertical:boolean,fontSize:number,iconRatio?:number,paired=true){
    const items:LayoutItem[]=[];
    const gap=fontSize*.65,authorGap=fontSize*1.1;
    // Size by visible width so tall, narrow logos still look slightly wider than a glyph.
    const sealWidth=fontSize*.85;
    const seal=iconRatio?{width:sealWidth,height:sealWidth/iconRatio}:undefined;
    const add=(role:'text'|'icon',shape:LayoutShape,x:number,y:number,index?:number)=>items.push({role,...shape,x,y,index});
    if(!paired){
        const width=Math.max(main?.width??0,author?.width??0,seal?.width??0);
        let cursor=0;
        const append=(role:'text'|'icon',shape:LayoutShape,index?:number)=>{
            add(role,shape,vertical?(width-shape.width)/2:cursor,vertical?cursor:0,index);
            cursor+=(vertical?shape.height:shape.width)+gap;
        };
        if(seal)append('icon',seal);
        if(main)append('text',main,0);
        if(author){if(main)cursor+=authorGap-gap;append('text',author,main?1:0);}
    }else if(vertical){
        const textWidth=(main?.width??0)+(main&&author?authorGap:0)+(author?.width??0);
        const width=Math.max(textWidth,seal?.width??0);
        const top=seal?seal.height+gap:0;
        const height=Math.max(main?.height??0,author?.height??0);
        const left=(width-textWidth)/2;
        if(seal)add('icon',seal,(width-seal.width)/2,0);
        if(main)add('text',main,left,top+height-main.height,0);
        if(author)add('text',author,left+(main?main.width+authorGap:0),top+height-author.height,main?1:0);
    }else{
        const x=seal?seal.width+gap:0;
        if(seal)add('icon',seal,0,0);
        if(main)add('text',main,x,0,0);
        if(author)add('text',author,x,main?main.height+authorGap:0,main?1:0);
    }
    return {items,width:Math.max(0,...items.map(item=>item.x+item.width)),height:Math.max(0,...items.map(item=>item.y+item.height))};
}
