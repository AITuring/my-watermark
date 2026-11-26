import UploadEmptyState from "@/components/image-workbench/UploadEmptyState";
import { useId } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const pixelColors = [
    ["#9baea8", "#bcc5b6", "#b0beb3", "#7f9c92", "#aab9ab"],
    ["#7d9b90", "#cfb798", "#d9c3a4", "#b5aa91", "#8da59a"],
    ["#68897e", "#b7a98e", "#ccb79b", "#c1b096", "#74978a"],
    ["#557b6f", "#8d9f91", "#b5ab93", "#8ba193", "#618779"],
    ["#426c5d", "#5f7e70", "#7a9180", "#648474", "#497362"],
];

/** Decorative photo prints with a pixelated selection, matching the EXIF import artwork. */
function MosaicIllustration() {
    const skyId = useId();
    return (
        <div className="mx-auto w-full max-w-[320px]" aria-hidden="true">
            <svg viewBox="40 20 400 320" fill="none" className="w-full text-emerald-900 dark:text-emerald-200">
                <defs>
                    <linearGradient id={skyId} x1="240" y1="60" x2="240" y2="280" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#c9dedb" /><stop offset="1" stopColor="#eee5ce" />
                    </linearGradient>
                </defs>
                <circle cx="247" cy="181" r="155" fill="currentColor" fillOpacity=".035" />
                <circle cx="247" cy="181" r="134" stroke="currentColor" strokeOpacity=".13" strokeDasharray="3 8" />
                <g transform="rotate(-11 195 180)">
                    <rect x="78" y="65" width="222" height="260" rx="9" fill="#e2ded1" />
                    <rect x="91" y="78" width="196" height="203" rx="4" fill="#b0c8be" />
                    <path d="M91 231L159 146L215 212L254 173L287 216V281H91Z" fill="#779c8c" />
                    <path d="M91 261L171 222L231 255L287 225V281H91Z" fill="#527b6b" />
                </g>
                <g transform="rotate(6 260 175)">
                    <rect x="144" y="38" width="239" height="285" rx="9" fill="#122e28" fillOpacity=".1" transform="translate(3 8)" />
                    <rect x="144" y="38" width="239" height="285" rx="9" fill="#faf9f3" stroke="#d9ded5" />
                    <rect x="158" y="52" width="211" height="220" rx="4" fill={`url(#${skyId})`} />
                    <circle cx="320" cy="96" r="22" fill="#faf3d9" />
                    <path d="M158 214L218 130L279 207L321 159L369 212V272H158Z" fill="#6e968b" />
                    <path d="M158 251L233 204L294 242L341 219L369 238V272H158Z" fill="#365f53" />
                    <path d="M235 272L271 238L288 243L271 272" fill="#d3cdb3" />
                    <rect x="172" y="289" width="65" height="4" rx="2" fill="#9aa99f" />
                    <rect x="172" y="300" width="106" height="3" rx="1.5" fill="#d9ded5" />
                    <g shapeRendering="crispEdges">
                        {pixelColors.flatMap((row, y) => row.map((color, x) => <rect key={`${x}-${y}`} x={219 + x * 16} y={133 + y * 16} width="16" height="16" fill={color} />))}
                    </g>
                    <rect x="215" y="129" width="88" height="88" rx="3" stroke="#f5faf7" strokeWidth="1.5" strokeDasharray="4 3" />
                    {[[215, 129], [303, 129], [215, 217], [303, 217]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" rx="1" fill="#faf9f3" stroke="#4e8072" />)}
                </g>
                <g transform="translate(310 253) rotate(-5)">
                    <rect width="117" height="55" rx="11" fill="currentColor" fillOpacity=".08" transform="translate(0 4)" />
                    <rect width="117" height="55" rx="11" className="fill-card stroke-border" />
                    {[0, 1, 2].map((x) => [0, 1, 2].map((y) => <rect key={`${x}-${y}`} x={15 + x * 8} y={16 + y * 8} width="6" height="6" rx="1" fill="currentColor" fillOpacity={.3 + ((x + y) % 3) * .2} />))}
                    <path d="M53 23H98M53 32H82" stroke="currentColor" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round" />
                </g>
                <path d="M389 55V75M379 65H399M63 239V255M55 247H71" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.5" />
                <circle cx="412" cy="207" r="3" fill="currentColor" fillOpacity=".3" />
            </svg>
        </div>
    );
}

export default function EmptyMosaicPanel({ isDragActive, onSelect }: { isDragActive: boolean; onSelect: () => void }) {
    return <UploadEmptyState isDragActive={isDragActive} illustration={<MosaicIllustration />}
        title="给照片添加马赛克" description="框选需要隐藏的细节，保留画面的其余部分。"
        actions={<Button onClick={onSelect} className="h-11 rounded-xl bg-emerald-900 px-7 text-sm text-white shadow-sm hover:bg-emerald-800 dark:bg-emerald-200 dark:text-emerald-950 dark:hover:bg-emerald-100"><ImagePlus className="mr-1 h-4 w-4" />选择图片</Button>} />;
}
