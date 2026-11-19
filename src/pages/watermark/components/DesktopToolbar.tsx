import * as SettingsDialog from "@radix-ui/react-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, RotateCcw, X, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ImageUploader from "@/components/ImageUploader";
import type { MixedWatermarkConfig } from "@/types";
import WatermarkTextInput from "./WatermarkTextInput";
import WatermarkColorControl from "./WatermarkColorControl";
import WatermarkFontPicker from "./WatermarkFontPicker";
import WatermarkLayoutControl from "./WatermarkLayoutControl";
import WatermarkDirectionSwitch from "./WatermarkDirectionSwitch";
import CaptionReviewDialog, {type CaptionReviewItem} from './CaptionReviewDialog';
import WatermarkExportMenu from './WatermarkExportMenu';

interface DesktopToolbarProps {
    imageTint: string;
    suggestedColors: string[];
    onImageTintChange: (color:string) => void;
    settingsOpen: boolean;
    onSettingsOpenChange: (open:boolean) => void;
    editScope: "current" | "all";
    setEditScope: (scope:"current" | "all") => void;
    imageCount: number;
    currentFilename: string;
    maxScale: number;
    scale: number;
    onScaleChange: (scale:number) => void;
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
    transparentWatermarkEnabled: boolean;
    setTransparentWatermarkEnabled: (value: boolean) => void;
    transparentWatermarkOpacity: number;
    setTransparentWatermarkOpacity: (value: number) => void;
    transparentWatermarkScale: number;
    setTransparentWatermarkScale: (value: number) => void;
    transparentWatermarkColor: string;
    onTransparentWatermarkColorChange: (color: string) => void;
    copyrightStatement: string;
    setCopyrightStatement: (value: string) => void;
    onGenerate: () => void;
    onGenerateCurrent: () => void;
    onGenerateZip: () => void;
    loading: boolean;
    progress: number;
    captionReviewItems: CaptionReviewItem[];
    captionPendingCount: number;
    onSaveCaptionReview: (changes: Record<string, {textLine1:string;textLine2:string;time:string;place:string;collection:string}>) => void;
    onClearCaptionReview: (ids: string[]) => void;
}

export function WatermarkRange({label,value,min,max,step=0.01,onChange,display}: {
    label:string;value:number;min:number;max:number;step?:number;onChange:(value:number)=>void;display?:string;
}) {
    return <label className="wm-range-field"><span><span>{label}</span><output>{display ?? value}</output></span>
        <input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={event=>onChange(Number(event.target.value))}/>
    </label>;
}
export default function DesktopToolbar(props: DesktopToolbarProps) {
    const drawerOpen=props.settingsOpen;
    const setDrawerOpen=props.onSettingsOpenChange;
    const {watermarkMode:mode,mixedWatermarkConfig:config}=props;
    const update=props.onConfigPatch;
    const textMode=mode!=='image';
    const status=props.smartError || props.fontNotice || (props.smartPending?'正在更新预览…':'预览已就绪');
    return <>
        <section className="wm-inspector wm-compact-toolbar" aria-label="水印编辑工具" data-mode={mode}>
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
            {textMode && <div className="wm-bottom-review"><span className="wm-label" aria-hidden="true">&nbsp;</span><CaptionReviewDialog currentFilename={props.currentFilename} pendingCount={props.captionPendingCount} items={props.captionReviewItems} onSave={props.onSaveCaptionReview} onClear={props.onClearCaptionReview}/></div>}
            {textMode && <div className="wm-bottom-layout"><span className="wm-label">排版</span><WatermarkDirectionSwitch value={config.layout} onChange={layout=>update({layout})}/></div>}
            <div className="wm-bottom-protection"><div className="wm-bottom-blur"><label className="wm-label" htmlFor="wm-bottom-blur">背景模糊</label><div className="wm-bottom-switch-row"><Switch id="wm-bottom-blur" checked={props.watermarkBlur} onCheckedChange={props.setWatermarkBlur}/><span aria-hidden="true">{props.watermarkBlur?'开':'关'}</span></div></div><div className="wm-bottom-blur" title="居中叠加独立图片水印，可在设置中调节透明度"><label className="wm-label" htmlFor="wm-bottom-transparent">独立透明水印</label><div className="wm-bottom-switch-row"><Switch id="wm-bottom-transparent" checked={props.transparentWatermarkEnabled} onCheckedChange={props.setTransparentWatermarkEnabled}/><span aria-hidden="true">{props.transparentWatermarkEnabled?'开':'关'}</span></div></div></div>
            <div className="wm-bottom-actions"><div className="wm-action-field"><span className="wm-label">调整</span><button type="button" title={status} className="wm-unified-settings" aria-label="水印设置" aria-expanded={drawerOpen} onClick={()=>setDrawerOpen(!drawerOpen)}><SlidersHorizontal size={16}/><span>设置</span></button></div>
            <div className="wm-action-field wm-export-field"><span className="wm-label">导出图片</span>
                <WatermarkExportMenu
                    onExportCurrent={props.onGenerateCurrent}
                    onExportAll={props.onGenerate}
                    onExportZip={props.onGenerateZip}
                    loading={props.loading}
                    progress={props.progress}
                    imageCount={props.imageCount}
                    currentDisabled={!props.currentFilename}
                    disabled={props.smartPending || Boolean(props.smartError) || mode==='text' && !config.textLine1.trim() && !config.textLine2.trim()}
                />
            </div></div>
        </section>
        <SettingsDialog.Root modal={false} open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SettingsDialog.Portal>
                <SettingsDialog.Content className="wm-inspector wm-settings-drawer" onPointerDownOutside={event=>event.preventDefault()} onFocusOutside={event=>event.preventDefault()}>
                    <header className="wm-drawer-heading"><div><SettingsDialog.Title>水印设置</SettingsDialog.Title><SettingsDialog.Description>{props.editScope==='all'?'设置应用到全部图片':'设置仅应用到当前图片'}</SettingsDialog.Description></div><SettingsDialog.Close className="wm-drawer-close" aria-label="关闭设置"><X size={18}/></SettingsDialog.Close></header>
                    <div className="wm-drawer-body">
            {textMode && <section className="wm-settings-section wm-typography-grid" aria-label="排版">
                <div className="wm-settings-section-heading"><h3>排版</h3><div className="wm-auto-fit-row"><label><span>自动适配</span><Switch aria-label="智能适配" checked={props.smartEnabled} onCheckedChange={props.setSmartEnabled}/></label><button type="button" className="wm-settings-reset" aria-label="恢复自动设置" title="恢复自动大小、排版、位置与颜色" onClick={props.onResetSmart}><RotateCcw size={14}/></button></div></div>
                <WatermarkLayoutControl config={{...config,textOnly:mode==='text'}} onChange={update}/>
                <WatermarkFontPicker label="统一字体" value={config.fontId} text={[config.textLine1,config.textLine2].filter(Boolean).join(' · ')} onChange={fontId=>update({fontId,captionFontId:fontId})}/>

                <div className="wm-control-stack"><WatermarkRange label="字距" value={config.letterSpacing??0.1} min={0} max={0.6} step={0.05} display={`${Math.round((config.letterSpacing??0.1)*100)}%`} onChange={letterSpacing=>update({letterSpacing})}/><WatermarkRange label="行列间距" value={config.lineGap??0.55} min={0.1} max={1.2} step={0.05} display={`${Math.round((config.lineGap??0.55)*100)}%`} onChange={lineGap=>update({lineGap})}/></div>
            </section>}
            <section className="wm-settings-section" aria-label="外观与位置"><h3 className="wm-settings-section-title">外观与位置</h3><div className="wm-style-grid">
                {textMode?<WatermarkColorControl suggestions={props.suggestedColors} value={config.color} onAuto={props.onAutoColor} onChange={color=>update({color})}/>:<WatermarkColorControl label="图片水印颜色" autoLabel="原色" suggestions={props.suggestedColors} value={props.imageTint} onChange={props.onImageTintChange} onAuto={()=>props.onImageTintChange("transparent")}/>}
                <WatermarkColorControl label="独立水印颜色" autoLabel="原色" value={props.transparentWatermarkColor || '#ffffff'} onAuto={() => props.onTransparentWatermarkColorChange('transparent')} onChange={props.onTransparentWatermarkColorChange}/>
                <div className="wm-control-stack"><WatermarkRange label="独立水印大小" value={props.transparentWatermarkScale} min={2} max={8} step={0.01} display={`${Math.round(props.transparentWatermarkScale*100)}%`} onChange={props.setTransparentWatermarkScale}/><WatermarkRange label="独立水印透明度" value={props.transparentWatermarkOpacity} min={0} max={1} step={0.01} display={`${Math.round(props.transparentWatermarkOpacity*100)}%`} onChange={props.setTransparentWatermarkOpacity}/></div>
            </div></section>
            <section className="wm-settings-section wm-export-grid" aria-label="导出参数">
                <div className="wm-settings-section-heading"><h3>导出</h3><span className="wm-help" title="保留原图尺寸和文件类型，文件名添加 -mark">原图尺寸</span></div>
                <WatermarkRange label="导出质量" value={props.quality} min={0.1} max={1} display={`${Math.round(props.quality*100)}%`} onChange={props.setQuality}/>
                <label className="wm-copyright-field"><span className="wm-label">版权声明 · EXIF</span><input className="wm-text-input" value={props.copyrightStatement} maxLength={120} onChange={event=>props.setCopyrightStatement(event.target.value)} placeholder="作者或版权信息" /></label>
            </section>
                    </div>
                    <footer className="wm-drawer-footer"><span className={props.smartError?'wm-error':'wm-help'} role="status">{status}</span><span className="wm-help" title={props.currentFilename}>{props.currentFilename}</span></footer>
                </SettingsDialog.Content>
            </SettingsDialog.Portal>
        </SettingsDialog.Root>
    </>;
}
