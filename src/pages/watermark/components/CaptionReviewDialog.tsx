import {useEffect, useMemo, useState} from 'react';
import {Check, ClipboardCheck, RotateCcw, X} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import type {CaptionConfidence, WatermarkCaptionAnalysis} from '../filename-watermark';

export type CaptionReviewItem = {
    id: string;
    filename: string;
    analysis: WatermarkCaptionAnalysis;
    textLine1: string;
    textLine2: string;
    time: string;
    place: string;
    collection: string;
    corrected: boolean;
};

type CaptionPatch = {textLine1: string; textLine2: string; time: string; place: string; collection: string};

type Props = {
    currentFilename: string;
    pendingCount: number;
    items: CaptionReviewItem[];
    onSave: (changes: Record<string, CaptionPatch>) => void;
    onClear: (ids: string[]) => void;
};

function statusLabel(confidence: CaptionConfidence, corrected: boolean) {
    if (corrected) return '已校对';
    if (confidence === 'review') return '需要确认';
    if (confidence === 'none') return '未识别';
    return '自动解析';
}

export default function CaptionReviewDialog({currentFilename, pendingCount, items, onSave, onClear}: Props) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<Record<string, CaptionPatch>>({});
    const reviewItems = useMemo(() => [...items].sort((a, b) => {
        const score = (item: CaptionReviewItem) => item.corrected ? 2 : item.analysis.confidence === 'high' ? 1 : 0;
        return score(a) - score(b) || a.filename.localeCompare(b.filename, 'zh-CN');
    }), [items]);

    useEffect(() => {
        if (!open) return;
        setDraft(Object.fromEntries(reviewItems.map(item => [item.id, {textLine1: item.textLine1, textLine2: item.textLine2, time:item.time, place:item.place, collection:item.collection}])));
    }, [open, reviewItems]);

    const update = (id: string, field: keyof CaptionPatch, value: string) => {
        setDraft(previous => ({...previous, [id]: {...previous[id], [field]: value}}));
    };
    return <>
        <button type="button" className="wm-caption-review-trigger" aria-label="打开水印校对" onClick={() => setOpen(true)}>
            <ClipboardCheck size={14}/><span>{pendingCount ? `待确认 ${pendingCount}` : '水印校对'}</span>
        </button>
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Portal>
                <Dialog.Overlay className="wm-caption-review-overlay"/>
                <Dialog.Content className="wm-caption-review-dialog" aria-describedby="wm-caption-review-description">
                    <header className="wm-caption-review-heading">
                        <div><Dialog.Title>水印校对</Dialog.Title><Dialog.Description id="wm-caption-review-description">可填写时间、地点/文化和馆藏，也可直接修改标题与说明；确认后会保留这类文件名的修正。</Dialog.Description></div>
                        <Dialog.Close className="wm-drawer-close" aria-label="关闭校对"><X size={18}/></Dialog.Close>
                    </header>
                    <div className="wm-caption-review-summary"><span>{pendingCount ? `有 ${pendingCount} 张图片需要确认` : '当前没有待确认项'}</span><span>当前：{currentFilename || '未选择图片'}</span></div>
                    <div className="wm-caption-review-list">
                        {reviewItems.length ? reviewItems.map(item => {
                            const value = draft[item.id] || {textLine1:item.textLine1,textLine2:item.textLine2,time:item.time,place:item.place,collection:item.collection};
                            const needsReview = item.analysis.confidence !== 'high' && !item.corrected;
                            return <article key={item.id} className={`wm-caption-review-row ${needsReview ? 'needs-review' : ''}`}>
                                <div className="wm-caption-review-row-heading"><span className="wm-caption-review-file" title={item.filename}>{item.filename}</span><span className={`wm-caption-review-badge ${needsReview ? 'is-review' : ''}`}>{statusLabel(item.analysis.confidence,item.corrected)}</span></div>
                                {item.analysis.issues.length > 0 && <p className="wm-caption-review-issues">{item.analysis.issues.join(' · ')}</p>}
                                <div className="wm-caption-review-meta-fields"><label><span>时间</span><input aria-label={`${item.filename} 时间`} value={value.time} onChange={event => update(item.id,'time',event.target.value)} placeholder="如 明代、18世纪"/></label><label><span>地点 / 文化</span><input aria-label={`${item.filename} 地点`} value={value.place} onChange={event => update(item.id,'place',event.target.value)} placeholder="如 英国、莫切文化"/></label><label><span>馆藏</span><input aria-label={`${item.filename} 馆藏`} value={value.collection} onChange={event => update(item.id,'collection',event.target.value)} placeholder="如 南京博物院藏"/></label></div>
                                <div className="wm-caption-review-fields"><label><span>主标题</span><input aria-label={`${item.filename} 主标题`} value={value.textLine1} onChange={event => update(item.id,'textLine1',event.target.value)} placeholder="作品名称"/></label><label><span>说明文字</span><input aria-label={`${item.filename} 说明文字`} value={value.textLine2} onChange={event => update(item.id,'textLine2',event.target.value)} placeholder="确认后自动生成，也可直接改"/></label></div>
                            </article>;
                        }) : <div className="wm-caption-review-empty"><Check size={18}/>目前所有文件名都已通过规则解析。</div>}
                    </div>
                    <footer className="wm-caption-review-footer"><button type="button" className="wm-text-button" onClick={() => onClear(reviewItems.filter(item => item.corrected).map(item => item.id))}><RotateCcw size={13}/>恢复已校对的自动结果</button><div><Dialog.Close className="wm-caption-review-cancel">取消</Dialog.Close><button type="button" className="wm-caption-review-save" onClick={() => {onSave(draft);setOpen(false);}}><Check size={14}/>确认并保存</button></div></footer>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    </>;
}
