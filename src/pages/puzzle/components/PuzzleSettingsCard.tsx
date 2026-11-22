import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, Download } from "lucide-react";
import { aspectRatioOptions } from "../constants";
import type { AspectRatio, PuzzleLayout } from "../types";

type PuzzleSettingsCardProps = {
    imagesCount: number;
    layout: PuzzleLayout;
    inputColumns: number | null;
    margin: number;
    radius: number;
    inputScale: number;
    selectedRatio: AspectRatio | null;
    onLayoutChange: (value: PuzzleLayout) => void;
    onInputColumnsChange: (value: number) => void;
    onMarginChange: (value: number) => void;
    onRadiusChange: (value: number) => void;
    onInputScaleChange: (value: number) => void;
    onRatioChange: (value: string) => void;
    onDownload: () => void;
    onAddMore: () => void;
    onClear: () => void;
};

function RangeSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
    const id = useId();
    return <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><label htmlFor={id}>{label}</label><output htmlFor={id} className="min-w-6 text-right font-medium tabular-nums text-foreground">{value}</output></div>
        <div className="flex h-9 items-center px-1"><input id={id} type="range" aria-label={label} value={value} min={min} max={max} step={1} className="h-9 w-full cursor-pointer accent-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:accent-slate-200" onChange={(event) => onChange(Number(event.target.value))} /></div>
    </div>;
}

function SelectSetting({ label, value, onChange, children, disabled = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
    const id = useId();
    return <div className="grid gap-1.5 text-xs text-slate-500">
        <label htmlFor={id}>{label}</label>
        <div className="relative">
            <select id={id} disabled={disabled} aria-label={label} className="h-9 w-full appearance-none rounded-md border bg-background pl-3 pr-9 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
    </div>;
}

export function PuzzleSettingsCard(props: PuzzleSettingsCardProps) {
    return <section className="mx-4 mt-3 overflow-hidden rounded-xl border bg-background sm:mx-6" aria-label="拼图工具栏">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="mr-auto text-sm font-semibold">拼图设置<span className="ml-2 text-xs font-normal text-slate-500">{props.imagesCount} 张</span></span>
            <Button variant="outline" size="sm" className="h-9" onClick={props.onAddMore}><Plus className="mr-1.5 h-4 w-4" />继续添加</Button>
            <Button size="sm" className="h-9" onClick={props.onDownload}><Download className="mr-1.5 h-4 w-4" />下载拼图</Button>
        </div>
        <div id="puzzle-settings" className="border-t px-3 py-3">
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <SelectSetting disabled={Boolean(props.selectedRatio?.width)} label="布局方式" value={props.layout} onChange={(value) => props.onLayoutChange(value as PuzzleLayout)}>{props.selectedRatio?.width ? <option value={props.layout}>固定比例网格</option> : <><option value="rows">等高行排列</option><option value="columns">等宽列排列</option><option value="masonry">瀑布流排列</option></>}</SelectSetting>
                {(props.layout !== "rows" || props.selectedRatio?.width) && <RangeSetting label="图片列数" value={props.inputColumns ?? 3} min={1} max={15} onChange={props.onInputColumnsChange} />}
                <RangeSetting label="图片间距（px）" value={props.margin} min={0} max={50} onChange={props.onMarginChange} />
                <RangeSetting label="图片圆角（px）" value={props.radius} min={0} max={50} onChange={props.onRadiusChange} />
                <SelectSetting label="生成图片长宽比" value={props.selectedRatio?.label ?? "自适应"} onChange={props.onRatioChange}>{aspectRatioOptions.map((ratio) => <option key={ratio.label} value={ratio.label}>{ratio.label}</option>)}</SelectSetting>
                <RangeSetting label="导出图片规模" value={props.inputScale} min={1} max={10} onChange={props.onInputScaleChange} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{props.selectedRatio?.width ? "单张固定比例 · 完整保留每张照片，可能留白；可调整列数。" : "保留照片原比例，不裁切；拖动照片可调整顺序。"}</p><Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" onClick={props.onClear}>清空照片</Button></div>
        </div>
    </section>;
}
