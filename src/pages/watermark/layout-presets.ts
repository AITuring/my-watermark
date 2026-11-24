import type {MixedWatermarkConfig} from '@/types';

export type WatermarkPreset = 'single' | 'paired' | 'centered';
export type WatermarkTextFieldLabels = {
    textLine1:string;
    textLine2:string;
    textLine1Placeholder:string;
    textLine2Placeholder:string;
};
/** Avoid a tiny name stranded beside a much longer metadata line/column. */
export function shouldJoinWatermarkLines(config:Partial<MixedWatermarkConfig>,direction=config.layout||'horizontal'){
    const length=(value:string)=>Array.from(value.trim()).reduce((total,character)=>
        total+(/\s/.test(character)?0:direction==='horizontal'&&character.charCodeAt(0)<=127?.55:1),0);
    const title=length(config.textLine1||''),caption=length(config.textLine2||'');
    return title>0&&title<=4&&caption>=10&&caption>=title*3;
}
export function getWatermarkPreset(config:Partial<MixedWatermarkConfig>, direction=config.layout||'horizontal'):WatermarkPreset {
    if (config.compactMode) return direction==='vertical'?config.verticalPreset||'single':config.horizontalPreset==='paired'?'paired':'single';
    if(direction==='vertical')return 'single';
    // An explicitly chosen horizontal preset must remain selectable even when
    // the automatic short-title heuristic would otherwise join the lines.
    // Configs without a preset still get the compact single-line fallback.
    return config.horizontalPreset || (shouldJoinWatermarkLines(config,direction)?'single':'paired');
}

/** Labels describe the editable content fields, which are not always visual lines. */
export function getWatermarkTextFieldLabels(config:Partial<MixedWatermarkConfig>):WatermarkTextFieldLabels {
    if(config.compactMode)return {
        textLine1:'名称',textLine2:'时代',
        textLine1Placeholder:'作品名称',textLine2Placeholder:'如 五代、南宋、18世纪',
    };
    const direction=config.layout||'horizontal';
    return direction==='horizontal'&&getWatermarkPreset(config,direction)==='paired'
        ? {textLine1:'第一行',textLine2:'第二行',textLine1Placeholder:'第一行文字',textLine2Placeholder:'第二行文字'}
        : {textLine1:'标题',textLine2:'说明',textLine1Placeholder:'作品名称',textLine2Placeholder:'年代 · 馆藏 · 摄影者'};
}

export const HORIZONTAL_PRESETS = [
    {value:'single',label:'单行横署',hint:'图案与单行文字齐平'},
    {value:'paired',label:'两行并置',hint:'文字左对齐，图案与两行等高'},
    {value:'centered',label:'三行居中',hint:'图案独占一行，三行共用中轴'},
] as const;
export const VERTICAL_PRESETS = [
    {value:'single',label:'单列',hint:'图案与文字列共轴'},
] as const;
