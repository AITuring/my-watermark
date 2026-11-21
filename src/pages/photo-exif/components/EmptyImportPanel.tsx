import { ArrowRight, Check, FolderOpen, ImagePlus, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyImportPanelProps {
    isDragActive: boolean;
    isImportingDirectory: boolean;
    openFilePicker: () => void;
    onSelectDirectory: () => void;
}

const steps = [
    { number: "01", title: "载入照片", text: "打开文件夹，或直接拖入一组照片。", icon: FolderOpen },
    { number: "02", title: "筛选与补齐", text: "找到缺失信息的照片，选择来源图补齐。", icon: ScanLine },
    { number: "03", title: "确认后保存", text: "检查预览，再写回原文件或导出副本。", icon: ShieldCheck },
];

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
    return (
        <div className="mx-auto max-w-6xl py-6 sm:py-10 lg:py-6">
            <section className={`relative overflow-hidden rounded-3xl border bg-white/60 dark:bg-slate-900/60 ${isDragActive ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-stone-200 dark:border-slate-800"}`}>
                <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 30%, #d4e5da 0, transparent 50%), radial-gradient(#899b8b 0.6px, transparent 0.6px)", backgroundSize: "100% 100%, 20px 20px" }} aria-hidden="true" />
                <div className="relative grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-6 lg:px-14 lg:py-8">
                    <div className="max-w-lg">
                        <div className="mb-6 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-emerald-800 dark:text-emerald-300"><span className="h-px w-7 bg-current" />每一张照片，都有来处</div>
                        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-[42px]">留住画面，<br /><span className="text-emerald-800 dark:text-emerald-300">也补全它的故事。</span></h2>
                        <p className="mt-5 max-w-sm text-sm leading-7 text-slate-600 dark:text-slate-400">整理拍摄时间、相机参数与 GPS 位置。<br className="hidden sm:block" />只补缺失信息，让已有记录好好保留。</p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Button className="h-12 rounded-xl bg-emerald-900 px-5 text-white hover:bg-emerald-800 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200" onClick={onSelectDirectory} disabled={isImportingDirectory}><FolderOpen className="mr-2 h-4 w-4" />{isImportingDirectory ? "读取文件夹中…" : "打开照片文件夹"}<ArrowRight className="ml-3 h-4 w-4" /></Button>
                            <Button variant="outline" className="h-12 rounded-xl bg-white/70 px-5 dark:bg-slate-900" onClick={openFilePicker}><ImagePlus className="mr-2 h-4 w-4" />选择照片</Button>
                        </div>
                        <p className={`mt-4 text-xs ${isDragActive ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-slate-500"}`}>{isDragActive ? "松开鼠标，开始读取照片" : "也可以将照片直接拖到这里"}</p>
                    </div>
                    <PhotoIllustration />
                </div>
                <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stone-200/70 bg-white/50 px-6 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/20 sm:px-10 lg:px-14">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />照片在本地读取</span><span>JPEG / PNG 支持写回原文件</span><span>预览确认后再保存</span>
                </div>
            </section>
            <ol className="mt-7 grid gap-5 sm:grid-cols-3 sm:gap-8 lg:mt-9">
                {steps.map(({ number, title, text, icon: Icon }) => <li key={number} className="flex gap-3 px-2"><span className="mt-0.5 font-mono text-xs text-emerald-700/70 dark:text-emerald-300/70">{number}</span><div><h3 className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-slate-500" />{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></div></li>)}
            </ol>
        </div>
    );
}
