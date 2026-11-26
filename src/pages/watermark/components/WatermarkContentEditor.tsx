import {useEffect,useId,useRef,useState} from 'react';
import {ChevronUp} from 'lucide-react';
import type { MixedWatermarkConfig } from '@/types';
import {applyWatermarkLines,getWatermarkLineModel} from '../watermark-lines';
import WatermarkTextInput from './WatermarkTextInput';

/** Use the renderer's text runs so the toolbar follows the visible inscription. */
export default function WatermarkContentEditor({config,onChange,collapsible=false}: {
    collapsible?:boolean;
    config:MixedWatermarkConfig;
    onChange:(patch:Partial<MixedWatermarkConfig>)=>void;
}) {
    const [open,setOpen]=useState(false);
    const root=useRef<HTMLDivElement>(null);
    const panelId=useId();
    useEffect(()=>{
        if(!open)return;
        const dismiss=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
        document.addEventListener('pointerdown',dismiss);
        return ()=>document.removeEventListener('pointerdown',dismiss);
    },[open]);
    const model=getWatermarkLineModel(config);
    const centered=model.seal==='row';
    const editor=<div className="wm-bottom-inputs wm-content-editor" data-layout={model.fields.length>1?'multiple':'single'} data-centered={centered||undefined} role="group" aria-label="水印文字编辑">
        {centered&&config.icon&&<div className="wm-content-icon-line"><img src={config.icon} alt="水印图标"/></div>}
        {model.fields.map((field,index)=><div className="wm-content-line" key={index}>
            <WatermarkTextInput className="wm-text-input wm-content-line-input" aria-label={field.label} placeholder={field.placeholder} maxLength={240} value={field.value} onValueChange={value=>{
                const values=model.fields.map(item=>item.value);
                values[index]=value;
                onChange(applyWatermarkLines(model,values));
            }}/>
        </div>)}
    </div>;
    const hasMultipleRows=model.fields.length>1||centered;
    if(!collapsible||!hasMultipleRows)return editor;
    const summary=model.fields.map(field=>field.value).filter(Boolean).join(' · ');
    return <div className="wm-bottom-inputs wm-content-disclosure" ref={root} onKeyDown={event=>{
        if(event.key==='Escape'){setOpen(false);root.current?.querySelector('button')?.focus();event.stopPropagation();}
    }} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
        <button className="wm-content-disclosure-trigger" type="button" aria-label={open?"收起水印文字编辑":"展开水印文字编辑"} aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(previous=>!previous)}>
            <span>{summary||'输入水印文字'}</span><ChevronUp size={16} style={{transform:open?'rotate(180deg)':undefined}}/>
        </button>
        {open&&<div id={panelId} className="wm-content-disclosure-panel" role="group" aria-label="水印文字编辑">{editor}</div>}
    </div>;
}
