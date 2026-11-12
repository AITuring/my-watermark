import type {MixedWatermarkConfig} from '@/types';

export type WatermarkPreset = 'single' | 'paired' | 'centered';
export function getWatermarkPreset(config:Partial<MixedWatermarkConfig>, direction=config.layout||'horizontal'):WatermarkPreset {
    return direction==='vertical'?config.verticalPreset||'paired':config.horizontalPreset||'paired';
}
export const HORIZONTAL_PRESETS = [
    {value:'single',label:'单行横署',hint:'图案与单行文字齐平'},
    {value:'paired',label:'两行并置',hint:'文字左对齐，图案与两行等高'},
    {value:'centered',label:'三行居中',hint:'图案独占一行，三行共用中轴'},
] as const;
export const VERTICAL_PRESETS = [
    {value:'single',label:'单列',hint:'图案与文字列共轴'},
    {value:'paired',label:'双列',hint:'双列顶端对齐'},
] as const;
