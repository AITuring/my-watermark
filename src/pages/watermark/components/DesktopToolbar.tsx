import * as SettingsDialog from "@radix-ui/react-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Type, Palette, Download, SlidersHorizontal, Sparkles, RotateCcw, X, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ImageUploader from "@/components/ImageUploader";
import type { MixedWatermarkConfig } from "@/types";
import ProgressButton from "./ProgressButton";
import WatermarkTextInput from "./WatermarkTextInput";
import WatermarkColorControl from "./WatermarkColorControl";
import WatermarkFontPicker from "./WatermarkFontPicker";

interface DesktopToolbarProps {
    previewZoom: number;
    onPreviewZoomChange: (value:number) => void;
    imageTint: string;
    suggestedColors: string[];
    onImageTintChange: (color:string) => void;
    onSmartPosition: () => void;
    settingsOpen: boolean;
    onSettingsOpenChange: (open:boolean) => void;
    editScope: "current" | "all";
    setEditScope: (scope:"current" | "all") => void;
    imageCount: number;
    currentFilename: string;
    maxScale: number;
    scale: number;
    onScaleChange: (scale:number) => void;
    onPositionChange: (position:string) => void;
    onAutoColor: () => void;
    fontNotice: string;
    smartPending: boolean;
    smartError: string;
    smartEnabled: boolean;
    setSmartEnabled: (value: boolean) => void;
    onResetSmart: () => void;
    watermarkMode: "image" | "mixed" | "text";
    setWatermarkMode: (mode: "image" | "mixed" | "text") => void;
    storedImageWatermarkUrl: string;
    mixedWatermarkConfig: MixedWatermarkConfig;
    onConfigPatch: (patch:Partial<MixedWatermarkConfig>) => void;
    onWatermarkUpload: (files: File[]) => void;
    watermarkBlur: boolean;
    setWatermarkBlur: (value: boolean) => void;
    quality: number;
    setQuality: (value: number) => void;
    watermarkOpacity: number;
    setWatermarkOpacity: (value: number) => void;
    onGenerate: () => void;
    loading: boolean;
    progress: number;
}

export function WatermarkRange({label,value,min,max,step=0.01,onChange,display}: {
    label:string;value:number;min:number;max:number;step?:number;onChange:(value:number)=>void;display?:string;
}) {
    return <label className="wm-range-field"><span><span>{label}</span><output>{display ?? value}</output></span>
        <input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={event=>onChange(Number(event.target.value))}/>
    </label>;
}
const TABS=[{id:'content',label:'智能',icon:Sparkles},{id:'type',label:'字体',icon:SlidersHorizontal},{id:'style',label:'外观',icon:Palette},{id:'export',label:'导出',icon:Download}] as const;

export default function DesktopToolbar(props: DesktopToolbarProps) {
    const [tab,setTab]=useState<typeof TABS[number]['id']>('type');
    const drawerOpen=props.settingsOpen;
    const setDrawerOpen=props.onSettingsOpenChange;
    const {watermarkMode:mode,mixedWatermarkConfig:config}=props;
    const update=props.onConfigPatch;
    const textMode=mode!=='image';
    const status=props.smartError || props.fontNotice || (props.smartPending?'正在更新预览…':'预览已就绪');
    return <>
        <section className="wm-inspector wm-compact-toolbar" aria-label="水印编辑工具">
            <div className="wm-bottom-mode"><span className="wm-label">水印类型</span>
                <Select value={mode} onValueChange={value=>{if(value==='image'||value==='text'||value==='mixed')props.setWatermarkMode(value);}}>
                    <SelectTrigger aria-label="水印类型" className="wm-mode-dropdown"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="image">图片水印</SelectItem><SelectItem value="text">文字水印</SelectItem><SelectItem value="mixed">图文水印</SelectItem></SelectContent>
                </Select>
            </div>
            {mode!=='text'&&<div className={`wm-material-field ${mode==='image'?'is-image-mode':''}`}><span className="wm-label">{mode==='image'?'水印素材':'水印图标'}</span><ImageUploader onUpload={props.onWatermarkUpload} fileType={mode==='image'?'水印图片':'图标'} className="wm-bottom-logo"><span className="wm-logo-checker"><img src={mode==='image'?props.storedImageWatermarkUrl:config.icon} alt="水印素材缩略图"/></span><span>更换{mode==='image'?'图片':'图标'}</span><ChevronDown size={13}/></ImageUploader></div>}
            {textMode?<div className="wm-bottom-inputs">
                <label className="wm-bottom-title"><span className="wm-label">主标题</span><WatermarkTextInput className="wm-text-input" aria-label="主标题" maxLength={120} value={config.textLine1} placeholder="作品名称或署名" onValueChange={textLine1=>update({textLine1})}/></label>
                <label className="wm-bottom-caption"><span className="wm-label">说明文字 · 可选</span><WatermarkTextInput className="wm-text-input" aria-label="说明文字（可选）" maxLength={120} value={config.textLine2} placeholder="年代 · 馆藏 · 摄影者" onValueChange={textLine2=>update({textLine2})}/></label>
            </div>:<div className="wm-bottom-image-note">拖动水印可调整位置</div>}
            {textMode && <div className="wm-bottom-layout"><span className="wm-label">排版</span><div role="group" aria-label="排版方向" className="wm-segmented"><button type="button" aria-pressed={(config.layout||'horizontal')==='horizontal'} onClick={()=>update({layout:'horizontal'})}>横排</button><button type="button" aria-pressed={config.layout==='vertical'} onClick={()=>update({layout:'vertical'})}>竖排</button></div></div>}
            <div className="wm-bottom-actions"><div className="wm-action-field"><span className="wm-label">调整</span><button type="button" title={status} className="wm-unified-settings" aria-label="水印设置" aria-expanded={drawerOpen} onClick={()=>{if(!drawerOpen && mode==='image')setTab('style');setDrawerOpen(!drawerOpen);}}><SlidersHorizontal size={16}/><span>设置</span></button></div>
            <div className="wm-action-field"><span className="wm-label">编辑范围</span><div role="group" aria-label="编辑范围" className="wm-segmented wm-scope-selector"><button type="button" aria-pressed={props.editScope==='current'} onClick={()=>props.setEditScope('current')}>当前</button><button type="button" aria-pressed={props.editScope==='all'} onClick={()=>props.setEditScope('all')}>全部</button></div></div>
            <div className="wm-action-field wm-export-field"><span className="wm-label">导出图片</span><ProgressButton loading={props.loading} progress={props.progress} onClick={props.onGenerate}
                disabled={props.smartPending || Boolean(props.smartError) || !props.imageCount || mode==='text' && !config.textLine1.trim() && !config.textLine2.trim()}
                className="wm-export-button"><Download size={15} />导出 {props.imageCount} 张</ProgressButton></div></div>
        </section>
        <SettingsDialog.Root modal={false} open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SettingsDialog.Portal>
                <SettingsDialog.Content className="wm-inspector wm-settings-drawer" onPointerDownOutside={event=>event.preventDefault()} onFocusOutside={event=>event.preventDefault()}>
                    <header className="wm-drawer-heading"><div><SettingsDialog.Title>水印设置</SettingsDialog.Title><SettingsDialog.Description>{props.editScope==='all'?'设置应用到全部图片':'设置仅应用到当前图片'}</SettingsDialog.Description></div><SettingsDialog.Close className="wm-drawer-close" aria-label="关闭设置"><X size={18}/></SettingsDialog.Close></header>
                    <nav className="wm-drawer-nav" aria-label="设置分组">{TABS.map(({id,label,icon:Icon})=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)}><Icon size={14}/>{label}</button>)}</nav>
                    <div className="wm-drawer-body">
            {tab==='content' && <div className="wm-content-grid">
                <p className="wm-help">文字内容在底栏直接编辑。智能适配会逐张分析照片，手动调整优先保留。</p>
                <div className="wm-smart-card"><label><span><Sparkles size={15}/>智能适配</span><Switch aria-label="智能适配" checked={props.smartEnabled} onCheckedChange={props.setSmartEnabled} disabled={!textMode}/></label><p className="wm-help">逐张选择大小、横竖排、位置与颜色。</p><button type="button" className="wm-text-button" onClick={props.onResetSmart} disabled={!textMode}><RotateCcw size={12}/>恢复自动设置</button><span role="status" className={props.smartError?'wm-error':'wm-help'}>{props.smartError || (props.smartPending?'正在更新预览…':'手动调整会保留')}</span></div>
            </div>}
            {tab==='type' && (textMode?<div className="wm-typography-grid">
                <WatermarkFontPicker value={config.fontId} text={config.textLine1} onChange={fontId=>update({fontId})}/>
                <WatermarkFontPicker label="说明字体" value={config.captionFontId} text={config.textLine2} onChange={captionFontId=>update({captionFontId})}/>

                <div className="wm-control-stack"><WatermarkRange label="字距" value={config.letterSpacing??0} min={0} max={0.6} step={0.05} display={`${Math.round((config.letterSpacing??0)*100)}%`} onChange={letterSpacing=>update({letterSpacing})}/><WatermarkRange label="行列间距" value={config.lineGap??0.25} min={0.1} max={1.2} step={0.05} display={`${Math.round((config.lineGap??0.25)*100)}%`} onChange={lineGap=>update({lineGap})}/></div>
                {mode==='mixed' && <WatermarkRange label="图标比例" value={config.iconScale??1} min={0.4} max={2} step={0.05} display={`${Math.round((config.iconScale??1)*100)}%`} onChange={iconScale=>update({iconScale})}/>}
            </div>:<div className="wm-empty-state"><Type size={24}/><div><strong>在线字体用于文字和图文水印</strong><p>切换模式后即可选择篆、隶、楷、行、草等书体。</p></div><button type="button" className="wm-secondary-button" onClick={()=>props.setWatermarkMode('text')}>切换文字水印</button></div>)}
            {tab==='style' && <div className="wm-style-grid">
                {textMode?<WatermarkColorControl suggestions={props.suggestedColors} value={config.color} onAuto={props.onAutoColor} onChange={color=>update({color})}/>:<WatermarkColorControl label="图片水印颜色" autoLabel="原色" suggestions={props.suggestedColors} value={props.imageTint} onChange={props.onImageTintChange} onAuto={()=>props.onImageTintChange("transparent")}/>}
                <div className="wm-control-stack"><WatermarkRange label="水印大小" value={props.scale} min={0.01} max={Math.max(0.01,props.maxScale)} step={0.01} display={`${Math.round(props.scale*100)}%`} onChange={props.onScaleChange}/><WatermarkRange label="透明度" value={props.watermarkOpacity} min={0} max={1} display={`${Math.round(props.watermarkOpacity*100)}%`} onChange={props.setWatermarkOpacity}/></div>
                <div className="wm-control-stack"><label className="wm-toggle-row"><div><strong>背景模糊</strong><p className="wm-help">柔化水印下方背景。</p></div><Switch aria-label="背景模糊" checked={props.watermarkBlur} onCheckedChange={props.setWatermarkBlur}/></label></div>
                <div className="wm-position-control"><div className="wm-position-heading"><span className="wm-label">水印位置</span><button type="button" className="wm-text-button" onClick={props.onSmartPosition}><Sparkles size={12}/>智能位置</button></div><div className="wm-position-grid" role="group" aria-label="快速位置">{[['top-left','左上'],['top-mid','上中'],['top-right','右上'],['mid-left','左中'],['center','居中'],['mid-right','右中'],['bottom-left','左下'],['bottom-mid','下中'],['bottom-right','右下']].map(([id,label])=><button key={id} type="button" onClick={()=>props.onPositionChange(id)} aria-label={`水印放在${label}`}>{label}</button>)}</div></div>
            </div>}
            {tab==='style' && <div className="wm-preview-settings"><div><span className="wm-label">预览缩放</span></div><div className="wm-preview-zoom"><button type="button" aria-label="预览缩小" disabled={props.previewZoom<=1} onClick={()=>props.onPreviewZoomChange(Math.max(1,props.previewZoom/1.2))}>−</button><button type="button" aria-label="重置预览缩放" onClick={()=>props.onPreviewZoomChange(1)}>{Math.round(props.previewZoom*100)}%</button><button type="button" aria-label="预览放大" disabled={props.previewZoom>=5} onClick={()=>props.onPreviewZoomChange(Math.min(5,props.previewZoom*1.2))}>+</button></div></div>}
            {tab==='export' && <div className="wm-export-grid"><div><div className="wm-card-heading"><Download size={16}/>批量导出</div><strong className="wm-export-count">{props.imageCount}<span>张照片</span></strong><p className="wm-help">逐张渲染文字与字体，保持原图分辨率。</p></div><div className="wm-control-stack"><WatermarkRange label="导出质量" value={props.quality} min={0.1} max={1} display={`${Math.round(props.quality*100)}%`} onChange={props.setQuality}/><p className="wm-help">JPEG / WebP 按原文件类型导出，多张打包为 ZIP。</p></div><div className="wm-export-notes"><span className="wm-label">文件与处理</span><p>文件名保留原名，并添加 <code>-mark</code>。</p><p>照片在本机处理；多张打包为一个 ZIP 下载。</p></div></div>}
                    </div>
                    <footer className="wm-drawer-footer"><span className={props.smartError?'wm-error':'wm-help'} role="status">{status}</span><span className="wm-help" title={props.currentFilename}>{props.currentFilename}</span></footer>
                </SettingsDialog.Content>
            </SettingsDialog.Portal>
        </SettingsDialog.Root>
    </>;
}
