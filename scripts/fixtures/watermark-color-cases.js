export const colorCases=[
 {name:'宣纸',rgb:()=>[239,226,200]}, {name:'旧纸',rgb:()=>[178,145,102]},
 {name:'纯白',rgb:()=>[255,255,255]}, {name:'纯黑',rgb:()=>[0,0,0]},
 {name:'冷灰',rgb:()=>[166,183,194]}, {name:'中灰',rgb:()=>[128,128,128]},
 {name:'朱红',rgb:()=>[175,34,30]}, {name:'橙金',rgb:()=>[234,158,25]},
 {name:'翠绿',rgb:()=>[24,136,78]}, {name:'靛蓝',rgb:()=>[27,58,139]},
 {name:'紫色',rgb:()=>[121,37,151]}, {name:'青色',rgb:()=>[24,190,193]},
 {name:'黑白棋盘',rgb:(x,y)=>((x>>3)+(y>>3))%2?[246,246,246]:[12,12,12]},
 {name:'冷暖拼接',rgb:x=>x<48?[28,57,113]:[227,170,97]},
 {name:'明暗渐变',rgb:x=>[x*255/95,x*255/95,x*255/95]},
 {name:'纸上墨纹',rgb:(x,y)=>Math.sin(x*.31+y*.13)>.45?[37,31,27]:[210,185,145]},
 {name:'彩色花纹',rgb:(x,y)=>[125+110*Math.sin(x*.15),125+110*Math.sin(y*.21),125+110*Math.sin((x+y)*.12)]},
 {name:'天空云层',rgb:(x,y)=>y<24?[223,232,240]:[57+x*.7,124+x*.7,179+x*.5]},
 {name:'暗色织物',rgb:(x,y)=>[30+12*Math.sin(x),27+10*Math.cos(y),24]},
 {name:'透明区域',rgb:()=>[0,0,0,0]},
];
export function casePixels(item,width=96,height=64){return Uint8ClampedArray.from(Array.from({length:width*height},(_,i)=>{const value=item.rgb(i%width,Math.floor(i/width));return [...value.slice(0,3),value[3]??255];}).flat());}
