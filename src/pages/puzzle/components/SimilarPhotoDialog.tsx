import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { SimilarPhotoGroup } from '../similar-photos';

type Props = { groups: SimilarPhotoGroup[]; onFinish: (removed: Set<string>) => void; onCancel: () => void };
export function SimilarPhotoDialog({ groups, onFinish, onCancel }: Props) {
    const [index, setIndex] = useState(0);
    const [enlarged, setEnlarged] = useState<string | null>(null);
    const [choices, setChoices] = useState<Record<number, string>>({});
    const group = groups[index];
    if (!group) return null;
    const choice = choices[index];
    const finish = () => {
        setEnlarged(null);
        if (index < groups.length - 1) { setIndex(index + 1); return; }
        const removed = new Set<string>();
        groups.forEach((item, i) => { if (choices[i] && choices[i] !== 'all') item.photos.forEach((photo) => { if (photo.id !== choices[i]) removed.add(photo.id); }); });
        onFinish(removed);
    };
    return <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
        <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto rounded-2xl border bg-background p-5 shadow-xl" onPointerDownOutside={(event) => event.preventDefault()}>
            <div className="pr-8"><DialogTitle>同件照片，选一张放入拼图</DialogTitle><DialogDescription className="mt-2">疑似组 {index + 1} / {groups.length} · {group.reason}。仅调整拼图选片，不改动原文件。</DialogDescription></div>
            {enlarged ? <div><Button size="sm" variant="outline" onClick={() => setEnlarged(null)}>返回对比</Button><img src={enlarged} alt="候选照片放大预览" className="mt-3 max-h-[60dvh] w-full rounded-xl bg-slate-950 object-contain" /></div> : <div role="radiogroup" aria-label="选择保留照片" className={`grid grid-cols-2 gap-3 ${group.photos.length > 2 ? 'sm:grid-cols-3' : ''}`}>
                {group.photos.map((photo, i) => <label key={photo.id} className={`min-w-0 cursor-pointer rounded-xl border p-2 ${choice === photo.id ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-border'}`}>
                    <img src={photo.src} alt={photo.fileName ?? `候选 ${i + 1}`} className="h-44 w-full rounded-lg bg-slate-950 object-contain sm:h-52" />
                    <div className="mt-2 flex items-center gap-2 text-xs"><input type="radio" name={`similar-${index}`} value={photo.id} checked={choice === photo.id} onChange={() => setChoices({ ...choices, [index]: photo.id })} /><span>保留第 {i + 1} 张</span></div>
                    <p className="mt-1 truncate text-xs text-slate-500" title={photo.fileName}>{photo.fileName}</p>
                    <div className="mt-1 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{photo.sourceFile ? `${(photo.sourceFile.size / 1048576).toFixed(1)} MB` : `${photo.width} × ${photo.height}`}</span><button type="button" className="min-h-9 px-2 text-xs underline" onClick={(event) => { event.preventDefault(); setEnlarged(photo.src); }}>放大查看</button></div>
                </label>)}
            </div>}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm"><input type="radio" name={`similar-${index}`} checked={choice === 'all'} onChange={() => setChoices({ ...choices, [index]: 'all' })} />不确定 / 不是同一件，全部保留</label>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={onCancel}>跳过选片，全部保留</Button>
                <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!index} onClick={() => { setEnlarged(null); setIndex(index - 1); }}>上一组</Button><Button size="sm" disabled={!choice} onClick={finish}>{index === groups.length - 1 ? '完成选择' : '下一组'}</Button></div>
            </div>
        </DialogContent>
    </Dialog>;
}
