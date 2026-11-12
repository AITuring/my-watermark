import type {MixedWatermarkConfig} from '@/types';
import {DEFAULT_FONT_ID} from './fonts/registry';

const MATCHED_FONTS: [string,string][] = [
    ['王羲之','fzwangxzxsjf'],['王献之','fzwangxzxkjw'],['欧阳询','fzouyxksjf'],
    ['褚遂良','fzchuslksjw'],['柳公权','fzliugqksjw'],['米芾','fzmifxsjw'],
    ['孙过庭','fzsungtcsfu'],['孫過庭','fzsungtcsfu'],['苏轼','fzsusxsjf'],
    ['黄庭坚','fzhuangtjxsjf'],['文徵明','fzwenzmxkjw'],['文征明','fzwenzmxkjw'],
    ['王铎','fzwangdxcjw'],['李邕','fzliyxsjw'],['杨凝式','fzyangnsxsjw'],
    ['赵佶','fzzhaojsjsjf'],['智永','fzzhiyksjw'],['钟繇','fzzhongyxkj'],
];

export function suggestWatermarkFont(filename:string):string {
    if(filename.includes('赵孟頫'))return /行书|帖|赋/.test(filename)?'fzzhaomfxsjf':'fzzhaomfksjf';
    if(filename.includes('颜真卿'))return /行书|文稿|祭侄/.test(filename)?'fzyanzqxsj':'fzyanzqksjf';
    const matched=MATCHED_FONTS.find(([name])=>filename.includes(name));
    if(matched)return matched[1];
    const artwork=/《[^》]*(?:图|卷|帖|赋|书|诗|经)[^》]*》|书法|碑拓|墨迹|山水|花鸟|壁画/.test(filename);
    // Generic calligraphic treatment for artwork is a fallback, not an asserted
    // attribution/style match. Objects and unknown camera files stay in Song.
    return artwork?'fzzhaomfksjf':DEFAULT_FONT_ID;
}

export function resolveWatermarkTypography(filename:string,base:Partial<MixedWatermarkConfig>,manual:Partial<MixedWatermarkConfig>={},automatic=true) {
    const fontId=manual.fontId||manual.captionFontId||(automatic?suggestWatermarkFont(filename):base.fontId||base.captionFontId)||DEFAULT_FONT_ID;
    return {fontId,captionFontId:fontId};
}
