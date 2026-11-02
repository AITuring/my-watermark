import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { filterArtworks, type Artwork, type CatalogFilters } from "./model";
import "./mobile-filters.css";

const editions: { value: CatalogFilters["edition"]; label: string }[] = [
    { value: "all", label: "综合" },
    { value: "domestic", label: "国内版" },
    { value: "overseas", label: "海外版" },
];
const readingOptions: { value: CatalogFilters["reading"]; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "unread", label: "未读" },
    { value: "read", label: "已读" },
];
const collectionSummaries: Record<number, string> = {
    5: "国内其他馆", 6: "欧美馆藏", 7: "日本馆藏与私藏", 8: "海内外各馆",
};
const collectionLabel = (value: string) => value === "私人藏" ? "私人收藏" : value.replace(/藏$/u, "");

export default function MobileFilters({ artworks, filters, readIds, onApply, onClose }: {
    artworks: readonly Artwork[];
    filters: CatalogFilters;
    readIds: ReadonlySet<string>;
    onApply: (filters: CatalogFilters) => void;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const headingId = useId();
    const bookId = useId();
    const [draft, setDraft] = useState<CatalogFilters>(() => ({ ...filters }));
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.current?.showModal();
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);

    const entries = useMemo(() => artworks.filter((item) => draft.edition === "all" || item.edition === draft.edition), [artworks, draft.edition]);
    const volumes = useMemo(() => [...new Set(entries.map((item) => item.volume))].sort((a, b) => a - b), [entries]);
    const books = useMemo(() => draft.volume === null ? [] : [...new Set(entries.filter((item) => item.volume === draft.volume).map((item) => item.book))].sort((a, b) => a - b), [entries, draft.volume]);
    const resultCount = useMemo(() => filterArtworks(artworks, draft, readIds).length, [artworks, draft, readIds]);

    const chooseEdition = (edition: CatalogFilters["edition"]) => setDraft((previous) => {
        const keepVolume = previous.volume === null || artworks.some((item) => item.volume === previous.volume && (edition === "all" || item.edition === edition));
        return { ...previous, edition, volume: keepVolume ? previous.volume : null, book: keepVolume ? previous.book : null };
    });
    const chooseVolume = (volume: number | null) => setDraft((previous) => ({ ...previous, volume, book: previous.volume === volume ? previous.book : null }));
    const close = () => dialog.current?.close();

    return <dialog ref={dialog} className="song-dialog song-mobile-filter-dialog" aria-labelledby={headingId}
        onClose={onClose}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }}>
        <header>
            <div><p>按卷册与阅读状态查找</p><h2 id={headingId}>筛选作品</h2></div>
            <button type="button" autoFocus aria-label="关闭筛选" onClick={close}><X size={22} /></button>
        </header>
        <div className="song-mobile-filter-body">
            <fieldset>
                <legend>目录范围</legend>
                <div className="song-mobile-filter-segments">
                    {editions.map((edition) => <button key={edition.value} type="button" aria-pressed={draft.edition === edition.value} onClick={() => chooseEdition(edition.value)}>{edition.label}</button>)}
                </div>
            </fieldset>

            <fieldset>
                <legend>选择卷册</legend>
                <div className="song-mobile-volume-grid">
                    <button type="button" className="song-mobile-all-volumes" aria-pressed={draft.volume === null} onClick={() => chooseVolume(null)}><span>全部卷册</span><span>{entries.length} 件</span>{draft.volume === null && <Check size={18} aria-hidden="true" />}</button>
                    {volumes.map((volume) => {
                        const items = entries.filter((item) => item.volume === volume);
                        const collections = [...new Set(items.map((item) => item.collection.trim()).filter(Boolean))];
                        const description = collections.length > 1 ? collectionSummaries[volume] || "多处馆藏" : collections[0] ? collectionLabel(collections[0]) : "馆藏未标注";
                        return <div className="song-mobile-volume-option" data-selected={draft.volume === volume} key={volume}>
                            <button type="button" aria-pressed={draft.volume === volume} onClick={() => chooseVolume(volume)}>
                                <span className="song-mobile-volume-title">第 {volume} 卷{draft.volume === volume && <Check size={18} aria-hidden="true" />}</span>
                                <span className="song-mobile-volume-description">{description}</span>
                                <span className="song-mobile-volume-note">{new Set(items.map((item) => item.book)).size} 册 · {items.length} 件</span>
                            </button>
                            {collections.length > 1 && <details className="song-mobile-collection-details">
                                <summary aria-label={`查看第 ${volume} 卷馆藏名单`}><span>馆藏名单 · {collections.length} 处</span><ChevronDown size={16} aria-hidden="true" /></summary>
                                <ul aria-label={`第 ${volume} 卷馆藏名单`}>{collections.map((collection) => <li key={collection}>{collectionLabel(collection)}</li>)}</ul>
                            </details>}
                        </div>;
                    })}
                </div>
                <div className="song-mobile-book-select">
                    <label htmlFor={bookId}>册号</label>
                    <select id={bookId} aria-label="筛选册号" value={draft.book ?? ""} disabled={draft.volume === null} onChange={(event) => setDraft((previous) => ({ ...previous, book: event.target.value ? Number(event.target.value) : null }))}>
                        <option value="">{draft.volume === null ? "先选择一卷" : "全部册"}</option>
                        {books.map((book) => <option key={book} value={book}>第 {book} 册</option>)}
                    </select>
                </div>
            </fieldset>

            <fieldset>
                <legend>阅读状态</legend>
                <div className="song-mobile-filter-segments">
                    {readingOptions.map((option) => <button key={option.value} type="button" aria-pressed={draft.reading === option.value} onClick={() => setDraft((previous) => ({ ...previous, reading: option.value }))}>{option.label}</button>)}
                </div>
            </fieldset>
            {draft.query && <p className="song-mobile-query-note">同时搜索：{draft.query}</p>}
        </div>
        <footer>
            <button type="button" onClick={() => setDraft((previous) => ({ ...previous, edition: "all", volume: null, book: null, reading: "all" }))}>重置筛选</button>
            <button type="button" className="song-primary" onClick={() => onApply({ ...draft })}>查看 {resultCount} 件作品</button>
        </footer>
    </dialog>;
}
