export interface LayoutShape {width:number;height:number}
export interface LayoutItem {role:'text'|'icon';x:number;y:number;width:number;height:number;index?:number}

/** Positions use visible ink bounds. Preview and export use this one geometry. */
export function arrangeWatermark(shapes:LayoutShape[],vertical:boolean,centered:boolean,fontSize:number,lineGap:number,iconRatio?:number){
    const items:LayoutItem[]=[],gap=fontSize*.8;
    let width=0,height=0;
    const add=(role:'text'|'icon',shape:LayoutShape,x:number,y:number,index?:number)=>{items.push({role,x,y,width:shape.width,height:shape.height,index});width=Math.max(width,x+shape.width);height=Math.max(height,y+shape.height);};
    const icon=(h:number)=>({width:h*(iconRatio||1),height:h});
    if(!shapes.length){if(iconRatio)add('icon',icon(fontSize*2.2),0,0);}
    else if(shapes.length===1){
        const text=shapes[0],logo=icon(vertical?Math.min(fontSize*1.5,text.width*1.35):text.height);
        if(vertical){const w=Math.max(text.width,iconRatio?logo.width:0);if(iconRatio)add('icon',logo,(w-logo.width)/2,0);add('text',text,(w-text.width)/2,iconRatio?logo.height+gap:0,0);}
        else{if(iconRatio)add('icon',logo,0,0);add('text',text,iconRatio?logo.width+gap:0,0,0);}
    }else if(vertical){
        const [first,second]=shapes,blockWidth=first.width+lineGap+second.width;
        const logo=icon(Math.min(fontSize*1.5,Math.max(first.width,second.width)*1.35));
        const w=Math.max(blockWidth,iconRatio?logo.width:0),x=(w-blockWidth)/2,y=iconRatio?logo.height+gap:0;
        if(iconRatio)add('icon',logo,(w-logo.width)/2,0);
        add('text',first,x+second.width+lineGap,y,0);add('text',second,x,y,1);
    }else{
        const [first,second]=shapes,textHeight=first.height+lineGap+second.height;
        if(centered){
            const logo=icon(Math.max(first.height,second.height)*1.75),w=Math.max(first.width,second.width,iconRatio?logo.width:0),y=iconRatio?logo.height+gap:0;
            if(iconRatio)add('icon',logo,(w-logo.width)/2,0);
            add('text',first,(w-first.width)/2,y,0);add('text',second,(w-second.width)/2,y+first.height+lineGap,1);
        }else{
            const logo=icon(textHeight),x=iconRatio?logo.width+gap:0;
            if(iconRatio)add('icon',logo,0,0);add('text',first,x,0,0);add('text',second,x,first.height+lineGap,1);
        }
    }
    const logo=items.find(item=>item.role==='icon'),text=items.filter(item=>item.role==='text');
    if(vertical&&logo&&text.length){
        if(logo.y+logo.height>Math.min(...text.map(item=>item.y))-.01||logo.height>fontSize*1.5+.01)throw Error('竖排小印必须在文字上方，并保持固定小尺寸。');
    }
    return{width,height,items};
}
