import {useMemo, useState} from 'react';
import {Check, ClipboardCheck, RotateCcw, X} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import type {MixedWatermarkConfig} from '@/types';
import type {CaptionConfidence, WatermarkCaptionAnalysis} from '../filename-watermark';
import {applyWatermarkLines, type WatermarkLineModel} from '../watermark-lines';

export type CaptionReviewItem = {
    id: string;
    filename: string;
    analysis: WatermarkCaptionAnalysis;
    textLine1: string;
    textLine2: string;
    /** The watermark's text exactly as drawn, one field per visual line. */
    model: WatermarkLineModel;
    /** Image watermarks draw no text; the lines apply once the image uses a text type. */
    imageMode?: boolean;
    corrected: boolean;
};

type Props = {
    pendingCount: number;
    items: CaptionReviewItem[];
    /** Applies the edited lines per image and marks every listed image as reviewed. */
    onSave: (edits: Record<string, Partial<MixedWatermarkConfig>>) => void;
    onClear: (ids: string[]) => void;
};

function statusLabel(confidence: CaptionConfidence, corrected: boolean) {
    if (corrected) return '已校对';
    if (confidence === 'review') return '需要确认';
    if (confidence === 'none') return '未识别';
    return '自动解析';
}

export default function CaptionReviewDialog({pendingCount, items, onSave, onClear}: Props) {
    const [open, setOpen] = useState(false);
    // Edited line texts per image; images without an entry are unchanged.
    const [draft, setDraft] = useState<Record<string, string[]>>({});
    const reviewItems = useMemo(() => [...items].sort((a, b) => {
        const score = (item: CaptionReviewItem) => item.corrected ? 2 : item.analysis.confidence === 'high' ? 1 : 0;
        return score(a) - score(b) || a.filename.localeCompare(b.filename, 'zh-CN');
    }), [items]);
    const original = (item: CaptionReviewItem) => item.model.fields.map(field => field.value);
    const isEdited = (item: CaptionReviewItem) => Boolean(draft[item.id]) && draft[item.id].some((value, index) => value !== original(item)[index]);
    const editedCount = reviewItems.filter(isEdited).length;

    const changeOpen = (next: boolean) => {setDraft({}); setOpen(next);};
    const editLine = (item: CaptionReviewItem, index: number, value: string) => setDraft(previous => {
        const values = [...(previous[item.id] ?? original(item))];
        values[index] = value;
        return {...previous, [item.id]: values};
    });
    const save = () => {
        const edits = Object.fromEntries(reviewItems.filter(isEdited).map(item => [item.id, applyWatermarkLines(item.model, draft[item.id])]));
        onSave(edits);
        changeOpen(false);
    };

    return <>
        <button type="button" className="wm-caption-review-trigger" aria-label="打开水印校对" onClick={() => changeOpen(true)}>
            <ClipboardCheck size={14}/><span>{pendingCount ? `待确认 ${pendingCount}` : '水印校对'}</span>
        </button>
        <Dialog.Root open={open} onOpenChange={changeOpen}>
            <Dialog.Portal>
                <Dialog.Overlay className="wm-caption-review-overlay"/>
                <Dialog.Content className="wm-caption-review-dialog" aria-describedby={undefined}>
                    <header className="wm-caption-review-heading">
                        <Dialog.Title>水印校对</Dialog.Title>
                        <Dialog.Close className="wm-drawer-close" aria-label="关闭校对"><X size={18}/></Dialog.Close>
                    </header>
                    <div className="wm-caption-review-summary">
                        <span>{pendingCount ? `有 ${pendingCount} 张图片需要确认` : '当前没有待确认项'}</span>
                        <span>每一栏就是水印上的一行，直接修改，保存后预览和导出同步</span>
                    </div>
                    <div className="wm-caption-review-list">
                        {reviewItems.length ? reviewItems.map(item => {
                            const needsReview = item.analysis.confidence !== 'high' && !item.corrected;
                            const edited = isEdited(item);
                            const values = draft[item.id] ?? original(item);
                            const {model} = item;
                            return <article key={item.id} className={`wm-caption-review-row ${needsReview ? 'needs-review' : ''} ${edited ? 'is-edited' : ''}`}>
                                <div className="wm-caption-review-row-heading">
                                    <span className="wm-caption-review-file" title={item.filename}>{item.filename}</span>
                                    <span className="wm-caption-review-layout">{item.imageMode ? '图片水印 · 当前不显示文字' : model.layoutLabel}</span>
                                    <span className={`wm-caption-review-badge ${needsReview || edited ? 'is-review' : ''}`}>{edited ? '已修改' : statusLabel(item.analysis.confidence, item.corrected)}</span>
                                </div>
                                {needsReview && item.analysis.issues.length > 0 && <p className="wm-caption-review-issues">{item.analysis.issues.join(' · ')}</p>}
                                <div className="wm-caption-review-body">
                                    {model.seal === 'beside' && <span className="wm-caption-review-seal" title="图案" aria-hidden="true">印</span>}
                                    <div className="wm-caption-review-lines">
                                        {model.seal === 'row' && <div className="wm-caption-review-line"><span className="wm-caption-review-line-label">第一行</span><span className="wm-caption-review-seal" title="图案">印</span></div>}
                                        {model.fields.map((field, index) => <label key={index} className="wm-caption-review-line">
                                            <span className="wm-caption-review-line-label">{field.label}</span>
                                            <input aria-label={`${item.filename} ${field.label}`} className={index === 0 && model.kind === 'lines' ? 'is-primary' : ''}
                                                value={values[index] ?? ''} placeholder={field.placeholder} maxLength={240}
                                                onChange={event => editLine(item, index, event.target.value)}/>
                                        </label>)}
                                    </div>
                                </div>
                            </article>;
                        }) : <div className="wm-caption-review-empty"><Check size={18}/>目前所有文件名都已通过规则解析。</div>}
                    </div>
                    <footer className="wm-caption-review-footer">
                        <button type="button" className="wm-text-button" onClick={() => {setDraft({}); onClear(reviewItems.filter(item => item.corrected).map(item => item.id));}}><RotateCcw size={13}/>恢复已校对的自动结果</button>
                        <div><Dialog.Close className="wm-caption-review-cancel">取消</Dialog.Close><button type="button" className="wm-caption-review-save" onClick={save}><Check size={14}/>{editedCount ? `保存修改（${editedCount} 张）` : '确认并保存'}</button></div>
                    </footer>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    </>;
}
