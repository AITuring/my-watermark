import type {MixedWatermarkConfig} from '@/types';
import {getWatermarkPreset,HORIZONTAL_PRESETS,VERTICAL_PRESETS} from '../layout-presets';
import WatermarkDirectionSwitch from './WatermarkDirectionSwitch';

export default function WatermarkLayoutControl({config,onChange}:{config:MixedWatermarkConfig;onChange:(patch:Partial<MixedWatermarkConfig>)=>void}){
    const direction=config.layout||'horizontal',preset=getWatermarkPreset(config),options=config.compactMode?(direction==='vertical'?[{value:'single' as const,label:'单列',hint:'图案在最上方，作者与名称同字号并接在名称下方'},{value:'paired' as const,label:'双列',hint:'作者在名称旁侧，与名称底部对齐'}]:[{value:'single' as const,label:'单行',hint:'名称与作者依次排列'},{value:'paired' as const,label:'双行',hint:'作者位于名称下一行'}]):direction==='vertical'?VERTICAL_PRESETS:HORIZONTAL_PRESETS;
    return <div className="wm-layout-control">
        <span className="wm-label">排版方向</span>
        <WatermarkDirectionSwitch value={direction} onChange={layout=>onChange({layout})}/>
        <span className="wm-label">排版方案</span>
        <div className="wm-layout-options" role="group" aria-label={direction==='vertical'?'竖排方案':'横排方案'}>
            {options.map(option=><button type="button" key={option.value} aria-pressed={preset===option.value} onClick={()=>onChange(direction==='vertical'?{layout:direction,verticalPreset:option.value as 'single'|'paired'}:{layout:direction,horizontalPreset:option.value})}>{config.textOnly&&option.value==='centered'?'两行居中':option.label}</button>)}
        </div>
        <p className="wm-help">{config.textOnly?(preset==='single'?(direction==='vertical'?'单列文字':'单行文字'):preset==='centered'?'两行文字居中对齐':direction==='vertical'?'文字列顶端对齐':'同一字号，文字左对齐'):options.find(option=>option.value===preset)?.hint}</p>
    </div>;
}
