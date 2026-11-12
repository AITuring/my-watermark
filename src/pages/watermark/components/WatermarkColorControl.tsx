import type { FormEvent } from 'react';

const COLORS = [
    {value:'#ffffff',name:'白色'},
    {value:'#171717',name:'黑色'},
    {value:'#cc2828',name:'朱红色'},
    {value:'#b59664',name:'金色'},
];

export default function WatermarkColorControl({value,onChange,onAuto,autoLabel="自动",label="文字 / 图标颜色",suggestions=[]}: {
    autoLabel?: string;
    label?: string;
    suggestions?: string[];
    value: string;
    onChange: (value:string) => void;
    onAuto?: () => void;
}) {
    const update = (event: FormEvent<HTMLInputElement>) => onChange(event.currentTarget.value);
    return <div className="wm-color-control space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{label}</span>
            {onAuto && <button type="button" onClick={onAuto} className="text-blue-500 hover:text-blue-400">{autoLabel}</button>}
        </div>
        <div role="group" aria-label="水印颜色" className="flex min-h-10 flex-wrap items-center gap-2">
            {[...COLORS,...suggestions.filter(value=>!COLORS.some(color=>color.value===value)).map((value,index)=>({value,name:`图片取色 ${index+1}`}))].map(color => <button key={color.value} type="button" title={color.name}
                aria-label={color.name} aria-pressed={value.toLowerCase() === color.value}
                onClick={() => onChange(color.value)} style={{backgroundColor:color.value}}
                className={`h-7 w-7 shrink-0 rounded-full border border-slate-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${value.toLowerCase() === color.value ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}`} />)}
            <input type="color" title="自定义水印颜色" aria-label="自定义水印颜色" value={value || "#ffffff"}
                onInput={update} onChange={update}
                className="h-8 w-9 cursor-pointer rounded-md border border-slate-200 bg-transparent p-0.5 dark:border-slate-700" />
        </div>
    </div>;
}
