import type {MixedWatermarkConfig} from '@/types';

export type WatermarkPreset = 'single' | 'paired' | 'centered';
/** Avoid a tiny name stranded beside a much longer metadata line/column. */
export function shouldJoinWatermarkLines(config:Partial<MixedWatermarkConfig>,direction=config.layout||'horizontal'){
    const length=(value:string)=>Array.from(value.trim()).reduce((total,character)=>
        total+(/\s/.test(character)?0:direction==='horizontal'&&character.charCodeAt(0)<=127?.55:1),0);
    const title=length(config.textLine1||''),caption=length(config.textLine2||'');
    return title>0&&title<=4&&caption>=10&&caption>=title*3;
}
export function getWatermarkPreset(config:Partial<MixedWatermarkConfig>, direction=config.layout||'horizontal'):WatermarkPreset {
    if(shouldJoinWatermarkLines(config,direction))return 'single';
    return direction==='vertical'?'single':config.horizontalPreset||'paired';
}
export const HORIZONTAL_PRESETS = [
    {value:'single',label:'单行横署',hint:'图案与单行文字齐平'},
    {value:'paired',label:'两行并置',hint:'文字左对齐，图案与两行等高'},
    {value:'centered',label:'三行居中',hint:'图案独占一行，三行共用中轴'},
] as const;
export const VERTICAL_PRESETS = [
    {value:'single',label:'单列',hint:'图案与文字列共轴'},
] as const;
