export interface AdaptiveColorResult {color:string;coverage:number;lowerContrast:number;meanContrast:number;}
const linear=(value:number)=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;};
const luminance=(r:number,g:number,b:number)=>.2126*linear(r)+.7152*linear(g)+.0722*linear(b);

/** Evaluate the distribution, including mixed light/dark regions, rather than average brightness. */
export function analyzeWatermarkColor(pixels:ArrayLike<number>):AdaptiveColorResult {
    const samples:number[]=[];let warmth=0;
    for(let i=0;i<pixels.length;i+=4){
        if(pixels[i+3]<128)continue;
        samples.push(luminance(pixels[i],pixels[i+1],pixels[i+2]));warmth+=pixels[i]-pixels[i+2];
    }
    if(!samples.length)return {color:'#352f28',coverage:0,lowerContrast:1,meanContrast:1};
    const warm=warmth/samples.length>=8;
    // Ink and paper first; middle tones can remain readable across black-and-white patterns.
    const palette=warm?['#352f28','#4b3b2c','#eee1c7','#faf1df','#89745d']:['#30383b','#3d4548','#e1e8e7','#f3f5f1','#78858a'];
    const ordered=[...samples].sort((a,b)=>a-b);
    const mixed=ordered[Math.floor((ordered.length-1)*.8)]-ordered[Math.floor((ordered.length-1)*.2)]>.35;
    const ranked=palette.filter((_,index)=>index<4||mixed).map((color,index)=>{
        const parts=color.match(/\w\w/g)!.map(part=>parseInt(part,16));const lum=luminance(parts[0],parts[1],parts[2]);
        const contrasts=samples.map(background=>(Math.max(lum,background)+.05)/(Math.min(lum,background)+.05)).sort((a,b)=>a-b);
        const lowerContrast=contrasts[Math.floor((contrasts.length-1)*.2)];
        const coverage=contrasts.filter(value=>value>=3).length/contrasts.length;
        const meanContrast=Math.exp(contrasts.reduce((total,value)=>total+Math.log(value),0)/contrasts.length);
        // Avoid maximizing harshness after most of the footprint is legible.
        const score=coverage>=.8?100+coverage*4-Math.abs(lowerContrast-4)*.6-(index===3?.4:0):coverage*30+Math.min(lowerContrast,3)+Math.log(meanContrast);
        return {color,coverage,lowerContrast,meanContrast,score};
    });
    const {color,coverage,lowerContrast,meanContrast}=ranked.sort((a,b)=>b.score-a.score)[0];
    return {color,coverage,lowerContrast,meanContrast};
}
export function chooseWatermarkColor(pixels:ArrayLike<number>):string {return analyzeWatermarkColor(pixels).color;}
