import type {MixedWatermarkConfig} from '@/types';
import {getSingleLineCaptionText,splitLongCaptionForMultiple} from '@/utils/text-watermark-layout';
import {getWatermarkPreset,getWatermarkSingleLineField,getWatermarkTextFieldLabels} from './layout-presets';

export type WatermarkLineField = {label:string;value:string;placeholder:string};
export type WatermarkLineModel = {
    kind:'single'|'lines'|'compact';
    /** 'row': the seal is the first row; 'beside': drawn next to the text; 'none': text only. */
    seal:'row'|'beside'|'none';
    /** The caption's era was moved up into the first line. */
    promoted:boolean;
    layoutLabel:string;
    fields:WatermarkLineField[];
};

/** The text exactly as the watermark draws it: one field per visual line (compact mode keeps its two fields). */
export function getWatermarkLineModel(config:Partial<MixedWatermarkConfig>,textOnly=Boolean(config.textOnly)):WatermarkLineModel{
    const title=config.textLine1||'',caption=config.textLine2||'';
    const direction=config.layout||'horizontal';
    const preset=getWatermarkPreset(config,direction);
    const seal=textOnly?'none':direction==='horizontal'&&preset==='centered'&&!config.compactMode?'row':'beside';
    if(config.compactMode){
        const labels=getWatermarkTextFieldLabels(config);
        return {kind:'compact',seal,promoted:false,layoutLabel:'精简模式',fields:[
            {label:labels.textLine1,value:title,placeholder:labels.textLine1Placeholder},
            {label:labels.textLine2,value:caption,placeholder:labels.textLine2Placeholder},
        ]};
    }
    const single=getWatermarkSingleLineField(config);
    if(single)return {kind:'single',seal,promoted:false,layoutLabel:single.vertical?'竖排单列':'单行',fields:[{
        label:single.label,placeholder:single.placeholder,
        value:config.singleLineText??getSingleLineCaptionText(title,caption,config.singleLineOrder,single.vertical),
    }]};
    const plan=splitLongCaptionForMultiple(title,caption,config.promoteEra!==false);
    const labels=getWatermarkTextFieldLabels({...config,textOnly});
    return {kind:'lines',seal,promoted:plan.promoted,
        layoutLabel:preset==='centered'?(seal==='row'?'三行居中':'两行居中'):'两行并置',
        fields:[
            {label:labels.textLine1,value:plan.firstText,placeholder:labels.textLine1Placeholder},
            {label:labels.textLine2,value:plan.secondText,placeholder:labels.textLine2Placeholder},
        ]};
}

/** Turns edited line texts back into the fields that draw exactly those lines. */
export function applyWatermarkLines(model:WatermarkLineModel,values:string[]):Partial<MixedWatermarkConfig>{
    if(model.kind==='single')return {singleLineText:values[0]??''};
    const patch:Partial<MixedWatermarkConfig>={textLine1:values[0]??'',textLine2:values[1]??''};
    // Edited lines are kept as typed; the era must not be moved between them again.
    if(model.promoted)patch.promoteEra=false;
    return patch;
}
