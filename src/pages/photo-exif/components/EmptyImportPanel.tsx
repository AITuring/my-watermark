import UploadEmptyState from "@/components/image-workbench/UploadEmptyState";
import { ArrowRight, Check, FolderOpen, ImagePlus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyImportPanelProps {
    isDragActive: boolean;
    isImportingDirectory: boolean;
    openFilePicker: () => void;
    onSelectDirectory: () => void;
}

/** Decorative, code-native illustration: photo prints and a metadata label. */
const PhotoIllustration = () => (
    <div className="relative mx-auto w-full max-w-[460px]" aria-hidden="true">
        <svg viewBox="0 0 480 390" fill="none" className="w-full text-emerald-900 dark:text-emerald-200">
            <defs>
                <linearGradient id="exif-sky" x1="210" y1="75" x2="210" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#c9dedb" /><stop offset="1" stopColor="#f0e6cd" /></linearGradient>
                <pattern id="exif-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" stroke="currentColor" strokeOpacity=".08" /></pattern>
            </defs>
            <circle cx="245" cy="189" r="168" fill="currentColor" fillOpacity=".035" />
            <circle cx="245" cy="189" r="142" stroke="currentColor" strokeOpacity=".13" strokeDasharray="3 8" />
            <path d="M24 76H455V335H24z" fill="url(#exif-grid)" />
            <g transform="rotate(-12 200 200)"><rect x="80" y="64" width="239" height="282" rx="8" fill="#e2ded1" /><rect x="93" y="78" width="213" height="223" rx="3" fill="#b0c8be" /><path d="M93 247L170 151L230 216L268 186L306 230V301H93Z" fill="#779c8c" /></g>
            <g transform="rotate(7 250 190)">
                <rect x="141" y="43" width="238" height="289" rx="9" fill="#122e28" fillOpacity=".1" transform="translate(3 9)" />
                <rect x="141" y="43" width="238" height="289" rx="9" fill="#faf9f3" stroke="#d9ded5" />
                <rect x="155" y="57" width="210" height="222" rx="4" fill="url(#exif-sky)" />
                <circle cx="310" cy="107" r="24" fill="#faf3d9" />
                <path d="M155 218L219 126L279 210L319 160L365 211V279H155Z" fill="#6e968b" />
                <path d="M155 252L240 202L292 245L337 215L365 233V279H155Z" fill="#365f53" />
                <path d="M228 279L268 243L286 247L265 279" fill="#d3cdb3" />
                <path d="M160 77V66H172M348 66H359V78M160 259V270H172M348 270H359V258" stroke="#fff" strokeOpacity=".8" strokeWidth="2" />
                <rect x="157" y="295" width="73" height="4" rx="2" fill="#9aa99f" /><rect x="157" y="306" width="110" height="3" rx="1.5" fill="#d9ded5" />
                <circle cx="349" cy="301" r="7" fill="#c5d8cb" />
            </g>
            <path d="M390 57V81M378 69H402M62 252V268M54 260H70" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.5" />
            <circle cx="412" cy="256" r="4" fill="currentColor" fillOpacity=".3" />
        </svg>
        <div className="absolute bottom-3 right-0 w-52 rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-lg dark:border-emerald-200/15 dark:bg-slate-900 sm:bottom-7 sm:right-2">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold tracking-widest text-slate-500"><span>EXIF</span><ScanLine className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /></div>
            {["拍摄时间", "相机与镜头", "GPS 位置"].map((label) => <div key={label} className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300"><span>{label}</span><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" /></div>)}
        </div>
    </div>
);

export default function EmptyImportPanel({ isDragActive, isImportingDirectory, openFilePicker, onSelectDirectory }: EmptyImportPanelProps) {
    return <section className={`overflow-hidden rounded-3xl border bg-card/70 ${isDragActive ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border/70"}`}>
        <UploadEmptyState isDragActive={isDragActive} illustration={<PhotoIllustration />} title="整理照片的拍摄信息"
            description="查看拍摄时间、相机参数与 GPS 位置，补齐缺失的记录。"
            actions={<><Button className="h-11 rounded-xl px-5" onClick={onSelectDirectory} disabled={isImportingDirectory}><FolderOpen className="h-4 w-4" />{isImportingDirectory ? "读取文件夹中…" : "打开照片文件夹"}<ArrowRight className="h-4 w-4" /></Button><Button variant="outline" className="h-11 rounded-xl px-5" onClick={openFilePicker}><ImagePlus className="h-4 w-4" />选择照片</Button></>}
            footer="照片在本地读取 · 预览确认后再保存" />
    </section>;
}
