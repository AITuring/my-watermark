import type {WatermarkFont} from './registry';

export const FONT_GROUPS=['全部','书法','宋体','其他'] as const;
export function fontGroup(font:WatermarkFont):typeof FONT_GROUPS[number]{
    if(font.category==='宋体'||font.category==='古籍刻本')return '宋体';
    if(['篆书','隶书','楷书','行书','草书'].includes(font.category))return '书法';
    return '其他';
}
