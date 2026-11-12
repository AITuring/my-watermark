import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, ChevronDown, Loader2, Search, Upload, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_FONT_ID, FONT_CATEGORIES, MASTER_FONTS, WATERMARK_FONTS, ensureWatermarkFont, fontFamily, fontName, getImportedFonts, importWatermarkFont, missingFontCharacters, subscribeFonts, prepareFontPreview, FONT_PREVIEW_TEXT } from '../fonts/registry';

function DynamicFontSample({id,loaded,localOnly}: {id:string;loaded:boolean;localOnly:boolean}) {
    const [ready,setReady]=useState(loaded || id===DEFAULT_FONT_ID);
    const element=useRef<HTMLSpanElement>(null);
    useEffect(()=>{
        if(loaded){setReady(true);return;}
        if(localOnly || !element.current)return;
        let cancelled=false;
        const observer=new IntersectionObserver(entries=>{
            if(!entries.some(entry=>entry.isIntersecting))return;
            observer.disconnect();
            void prepareFontPreview(id).then(()=>{if(!cancelled)setReady(true);}).catch(()=>{});
        },{rootMargin:'80px'});
        observer.observe(element.current);
        return()=>{cancelled=true;observer.disconnect();};
    },[id,loaded,localOnly]);
    return <span ref={element} className={`wm-font-sample ${ready?'':'is-loading'}`}
        style={{fontFamily:ready?fontFamily(id):undefined}} aria-label={ready?'字体真实字形预览':'字体预览准备中'}>
        {ready?FONT_PREVIEW_TEXT:localOnly?'本机字体':' '}
    </span>;
}

function FontSample(props:{id:string;loaded:boolean;localOnly:boolean}) {
    const bundled=WATERMARK_FONTS.some(font=>font.id===props.id&&!font.localSource);
    if(bundled)return <span className="wm-font-sample wm-font-image-sample"><img
        src={`/fonts/watermark/preview-${props.id}.png`} alt="字体真实字形预览" width={180} height={55} decoding="async"/></span>;
    return <DynamicFontSample {...props}/>;
}

export default function WatermarkFontPicker({value = DEFAULT_FONT_ID,onChange,text,label = '标题字体'}: {
    value?: string; onChange:(id:string)=>void; text:string; label?:string;
}) {
    const [open,setOpen]=useState(false);
    const [category,setCategory]=useState('全部');
    const [query,setQuery]=useState('');
    const [pending,setPending]=useState('');
    const [error,setError]=useState('');
    const [loaded,setLoaded]=useState<string[]>([value,DEFAULT_FONT_ID]);
    const sequence=useRef(0);
    const input=useRef<HTMLInputElement>(null);
    const hoverTimer=useRef<ReturnType<typeof setTimeout>>();
    useEffect(()=>()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);},[]);
    const imported=useSyncExternalStore(subscribeFonts,getImportedFonts,getImportedFonts);
    const sample=text || '秋声赋卷 山川清远';
    const fonts=[...WATERMARK_FONTS,...imported].filter(font => (category==='全部' || category==='古籍刻本' && font.tags.includes('古籍刻本') || category==='名家' && font.tags.includes('颜真卿') || font.category===category)
        && `${font.name} ${font.category} ${font.tags}`.toLowerCase().includes(query.toLowerCase()));
    const masters=MASTER_FONTS.filter(font => `${font.name} ${font.description}`.includes(query));
    const changeOpen=(next:boolean) => {
        if(!next){sequence.current++;setPending('');}
        setOpen(next);
    };
    const choose=async (id:string) => {
        const request=++sequence.current;
        setPending(id); setError('');
        try {
            await ensureWatermarkFont(id,sample);
            if (request!==sequence.current) return;
            setLoaded(prev => [...prev,id]);
            onChange(id);
            const missing=missingFontCharacters(id,sample);
            if (missing) setError(`这款字体缺少「${missing}」，这些字会由系统宋体补齐。`);
        } catch(error) { if(request===sequence.current) setError(error instanceof Error?error.message:'字体加载失败'); }
        finally { if(request===sequence.current) setPending(''); }
    };
    return <div className="wm-font-field">
        <span className="wm-label">{label}</span>
        <button type="button" className="wm-font-trigger" onClick={()=>setOpen(true)} aria-label={`选择${label}`}>
            <span className="wm-font-glyph" style={{fontFamily:fontFamily(value)}}>永</span>
            <span className="min-w-0 flex-1 truncate text-left">{fontName(value)}</span><ChevronDown size={14}/>
        </button>
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogContent className="wm-font-dialog sm:max-w-[900px]">
                <div className="wm-font-heading"><div><DialogTitle>选一笔，写出气韵</DialogTitle>
                    <DialogDescription>先看真实字形，再用你的水印文字试写。</DialogDescription></div>
                    <button type="button" className="wm-secondary-button mr-6" onClick={()=>input.current?.click()}><Upload size={15}/>导入字体</button>
                </div>
                <input ref={input} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" aria-label="导入本地字体"
                    onChange={async event=>{
                        const file=event.target.files?.[0]; if(!file)return;
                        const request=++sequence.current;setError('');setPending('import');
                        try { const font=await importWatermarkFont(file);if(request!==sequence.current)return;onChange(font.id);setLoaded(prev=>[...prev,font.id]);setCategory('已导入');setQuery(''); }
                        catch(error){setError(error instanceof Error?error.message:'导入失败');}
                        finally{if(request===sequence.current)setPending('');event.target.value='';}
                    }}/>
                <label className="wm-font-search"><Search size={16}/><input aria-label="搜索字体或书法家" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索字体、书体、颜真卿、褚遂良…"/></label>
                <div className="wm-font-categories" aria-label="字体分类">{FONT_CATEGORIES.map(item=><button type="button" key={item} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
                <div className="wm-font-live-preview"><span className="wm-label">{fontName(value)} · 你的水印文字</span><div style={{fontFamily:fontFamily(value)}}>{sample}</div>{pending&&<span className="wm-help"><Loader2 size={12} className="animate-spin"/>正在准备所需字形，当前预览保留</span>}</div>
                <div className="wm-font-results">
                    <div className="wm-font-grid">{fonts.map(font=><div key={font.id} className={`wm-font-card ${value===font.id?'is-selected':''}`}>
                        <button type="button" onClick={()=>void choose(font.id)}
                            onPointerEnter={()=>{hoverTimer.current=setTimeout(()=>{void ensureWatermarkFont(font.id,sample).catch(()=>{});},120);}}
                            onPointerLeave={()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);}}
                            onFocus={()=>{if(!font.localSource)void ensureWatermarkFont(font.id,sample).catch(()=>{});}}
                            aria-pressed={value===font.id} aria-label={`使用${font.name}`}>
                            <span className="wm-font-card-heading"><strong>{font.name}</strong><span>{pending===font.id?<Loader2 size={15} className="animate-spin"/>:value===font.id?<Check size={15}/>:font.category}</span></span>
                            <FontSample id={font.id} loaded={loaded.includes(font.id)} localOnly={Boolean(font.localSource)}/>
                            <span className="wm-font-card-note">{loaded.includes(font.id)?'已加载 · 点击应用':font.localSource?'使用本机已安装字体':'预览已就绪 · 点选应用'}</span>
                        </button>
                        {font.source && <a href={font.source} target="_blank" rel="noreferrer" className="wm-font-source">来源与许可<ExternalLink size={10}/></a>}
                    </div>)}</div>
                    {(category==='名家' || query && masters.length>0) && <div className="wm-master-list">
                        <p className="wm-label">名家字库</p><p className="wm-help">颜体在线字体可直接试用；其他名家字库取得授权后导入 TTF / OTF，在本机处理。</p>
                        {masters.map(master=><div key={master.name} className="wm-master-row"><div><strong>{master.name}</strong><span>{master.description}</span></div>
                            {'id' in master && master.id?<button type="button" className="wm-secondary-button" onClick={()=>void choose(master.id!)}>在线试用</button>:<div className="flex items-center gap-3"><a href={master.source} target="_blank" rel="noreferrer" className="wm-font-source">官方字库<ExternalLink size={11}/></a><button type="button" className="wm-secondary-button" onClick={()=>input.current?.click()}>导入授权字体</button></div>}
                        </div>)}
                    </div>}
                    {!fonts.length && category!=='名家' && !masters.length && <p className="wm-help py-8 text-center">没有匹配字体，可换个关键词或导入字体文件。</p>}
                </div>
                <div className="wm-font-footer"><span role="status" className={error?'text-amber-600 dark:text-amber-300':'wm-help'}>{error || (pending?'正在加载字体，请稍候…':`当前：${fontName(value)} · 导入字体仅用于本次会话`)}</span><button type="button" className="wm-primary-button" onClick={()=>changeOpen(false)}>完成</button></div>
            </DialogContent>
        </Dialog>
    </div>;
}
