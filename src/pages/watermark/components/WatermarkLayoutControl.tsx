import type {MixedWatermarkConfig} from '@/types';
import {getWatermarkPreset,HORIZONTAL_PRESETS,VERTICAL_PRESETS} from '../layout-presets';
import WatermarkDirectionSwitch from './WatermarkDirectionSwitch';

export default function WatermarkLayoutControl({config,onChange}:{config:MixedWatermarkConfig;onChange:(patch:Partial<MixedWatermarkConfig>)=>void}){
    const direction=config.layout||'horizontal',preset=getWatermarkPreset(config),options=direction==='vertical'?VERTICAL_PRESETS:HORIZONTAL_PRESETS;
    return <div className="wm-layout-control">
        <span className="wm-label">排版方向</span>
        <WatermarkDirectionSwitch value={direction} onChange={layout=>onChange({layout})}/>
        <span className="wm-label">排版方案</span>
        <div className="wm-layout-options" role="group" aria-label={direction==='vertical'?'竖排方案':'横排方案'}>
            {options.map(option=><button type="button" key={option.value} aria-pressed={preset===option.value} onClick={()=>onChange(direction==='vertical'?{layout:direction,verticalPreset:option.value as 'single'|'paired'}:{layout:direction,horizontalPreset:option.value})}>{config.textOnly&&option.value==='centered'?'两行居中':option.label}</button>)}
        </div>
        <p className="wm-help">{config.textOnly?(preset==='centered'?'两行文字居中对齐':direction==='vertical'?'文字列顶端对齐':'同一字号，文字左对齐'):options.find(option=>option.value===preset)?.hint}</p>
    </div>;
}
