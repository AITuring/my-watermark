import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Check,ChevronDown,Loader2,Search,Upload,ExternalLink} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {DEFAULT_FONT_ID,WATERMARK_FONTS,ensureWatermarkFont,fontFamily,fontName,getImportedFonts,importWatermarkFont,missingFontCharacters,subscribeFonts,FONT_PREVIEW_TEXT} from '../fonts/registry';
import {FONT_GROUPS,fontGroup} from '../fonts/groups';

export default function WatermarkFontPicker({value=DEFAULT_FONT_ID,onChange,text,label='统一字体'}:{value?:string;onChange:(id:string)=>void;text:string;label?:string}){
    const [open,setOpen]=useState(false),[category,setCategory]=useState('全部'),[query,setQuery]=useState('');
    const [pending,setPending]=useState(''),[error,setError]=useState('');
    const input=useRef<HTMLInputElement>(null),sequence=useRef(0);
    const [gallery,setGallery]=useState<HTMLDivElement|null>(null);
    const imported=useSyncExternalStore(subscribeFonts,getImportedFonts,getImportedFonts);
    const sample=text||'秋声赋卷 山川清远';
    const all=[...WATERMARK_FONTS,...imported],current=all.find(font=>font.id===value);
    const fonts=all.filter(font=>(category==='全部'||fontGroup(font)===category)&&`${font.name} ${font.category} ${font.tags}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a,b)=>Number(b.id===value)-Number(a.id===value)||Number(b.id===DEFAULT_FONT_ID)-Number(a.id===DEFAULT_FONT_ID));
    const changeOpen=(next:boolean)=>{if(!next){sequence.current++;setPending('');}setOpen(next);};
    useEffect(()=>{
        if(!open)return;
        let cancelled=false;
        void ensureWatermarkFont(value,sample).catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:'字体加载失败');});
        return()=>{cancelled=true;};
    },[open,value,sample]);
    useEffect(()=>{
        if(!open||!gallery)return;
        const images=gallery.querySelectorAll<HTMLImageElement>('img[data-preview-src]');
        const load=(image:HTMLImageElement)=>{
            if(image.dataset.previewSrc){image.src=image.dataset.previewSrc;delete image.dataset.previewSrc;}
        };
        if(!('IntersectionObserver' in window)){images.forEach(load);return;}
        // Native lazy images may preload thousands of pixels beyond a modal's viewport.
        const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
            if(entry.isIntersecting){load(entry.target as HTMLImageElement);observer.unobserve(entry.target);}
        }),{root:gallery,rootMargin:'80px 0px'});
        images.forEach(image=>observer.observe(image));
        return()=>observer.disconnect();
    },[open,category,query,imported,value,gallery]);
    const choose=async(id:string)=>{
        const request=++sequence.current;setPending(id);setError('');
        try{
            await ensureWatermarkFont(id,sample);if(request!==sequence.current)return;
            onChange(id);const missing=missingFontCharacters(id,sample);
            if(missing)setError(`缺少「${missing}」，这些字会由系统宋体补齐。`);else changeOpen(false);
        }catch(reason){if(request===sequence.current)setError(reason instanceof Error?reason.message:'字体加载失败');}
        finally{if(request===sequence.current)setPending('');}
    };
    return <div className="wm-font-field">
        <span className="wm-label">{label}</span>
        <button type="button" className="wm-font-trigger" onClick={()=>{setError('');setOpen(true);}} aria-label={`选择${label}`}>
            <span className="wm-font-glyph" style={{fontFamily:fontFamily(value)}}>永</span><span className="min-w-0 flex-1 truncate text-left">{fontName(value)}</span><ChevronDown size={14}/>
        </button>
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogContent className="wm-font-dialog wm-font-dialog-compact">
                <div className="wm-font-heading"><div><DialogTitle>选择字体</DialogTitle><DialogDescription className="sr-only">搜索字体或作者，点击字体即可应用。</DialogDescription></div>
                    <button type="button" className="wm-secondary-button mr-6" onClick={()=>input.current?.click()}><Upload size={14}/>导入</button></div>
                <input ref={input} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" aria-label="导入本地字体" onChange={async event=>{
                    const file=event.target.files?.[0];if(!file)return;
                    const request=++sequence.current;setError('');setPending('import');
                    try{const font=await importWatermarkFont(file);if(request!==sequence.current)return;onChange(font.id);changeOpen(false);}
                    catch(reason){if(request===sequence.current)setError(reason instanceof Error?reason.message:'导入失败');}
                    finally{if(request===sequence.current)setPending('');event.target.value='';}
                }}/>
                <label className="wm-font-search"><Search size={15}/><input aria-label="搜索字体或书法家" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索字体、作者或书体"/></label>
                <div className="wm-font-categories" aria-label="字体分类">{FONT_GROUPS.map(group=><button key={group} type="button" aria-pressed={category===group} onClick={()=>setCategory(group)}>{group}</button>)}</div>
                <div className="wm-font-live-preview"><span className="wm-label">{fontName(value)}</span><div style={{fontFamily:fontFamily(value)}}>{sample}</div></div>
                <div ref={setGallery} className="wm-font-results"><div className="wm-font-grid">
                    {fonts.map(font=><button type="button" className={`wm-font-card wm-font-choice ${font.id===value?'is-selected':''}`} key={font.id} aria-pressed={font.id===value} aria-label={`使用${font.name}`} title={font.name} onClick={()=>void choose(font.id)}>
                        <span className="wm-font-card-heading"><strong>{font.name}</strong>{pending===font.id?<Loader2 size={14} className="animate-spin"/>:font.id===value?<Check size={14}/>:null}</span>
                        {!font.localSource&&!font.id.startsWith('imported-')?<span className="wm-font-image-sample"><img data-preview-src={`/fonts/watermark/preview-${font.id}.png`} alt="字体真实字形预览" width={180} height={55} decoding="async"/></span>:<span className="wm-font-sample" style={{fontFamily:fontFamily(font.id)}}>{FONT_PREVIEW_TEXT}</span>}
                    </button>)}
                </div>{!fonts.length&&<p className="wm-help py-6 text-center">没有匹配字体，可换个关键词或导入字体。</p>}</div>
                <div className="wm-font-footer"><span role="status" className={error?'text-amber-600 dark:text-amber-300':'wm-help'}>{error||(pending?'正在加载字体…':'点击字体即可应用')}</span>{current?.source&&<a className="wm-font-source" href={current.source} target="_blank" rel="noreferrer">来源与许可<ExternalLink size={10}/></a>}</div>
            </DialogContent>
        </Dialog>
    </div>;
}
