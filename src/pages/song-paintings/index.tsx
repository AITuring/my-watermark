import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BarChart3, Check, ChevronLeft, ChevronRight, Download, List, Pencil, Search, Share2, Upload, X } from "lucide-react";
import rawCatalog from "./catalog.json";
import { createProgress, filterArtworks, parseProgress, STORAGE_KEY, type Artwork, type Catalog, type CatalogFilters } from "./model";
import { useCatalog, type CatalogMode } from "./useCatalog";
import ReadingStats from "./ReadingStats";
import ArtworkEditor from "./ArtworkEditor";
import ShareDialog from "./ShareDialog";
import "./song-paintings.css";

const sourceCatalog = rawCatalog as Catalog;
const PAGE_SIZE = 50;
const initialFilters: CatalogFilters = { edition: "all", volume: null, book: null, reading: "all", query: "" };
const editions = [
    { value: "all", label: "全部目录", note: "8 卷 · 31 册" },
    { value: "domestic", label: "国内版", note: "第 1、2、3、5 卷" },
    { value: "overseas", label: "海外版", note: "第 4、6、7、8 卷" },
] as const;

function downloadJson(value: unknown, filename: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SongPaintingsPage({ mode }: { mode: CatalogMode }) {
    const personal = mode === "personal";
    const { catalog, readIds, warning, saving, canEditReading, canEditMetadata, toggleRead, mergeProgress, saveArtwork } = useCatalog(sourceCatalog, mode);
    const validIds = useMemo(() => new Set(catalog.artworks.map((item) => item.id)), [catalog]);
    const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
    const [page, setPage] = useState(1);
    const [view, setView] = useState<"catalog" | "statistics">("catalog");
    const [editing, setEditing] = useState<Artwork | null>(null);
    const [shareSnapshot, setShareSnapshot] = useState<Catalog | null>(null);
    const [message, setMessage] = useState("");
    const [importError, setImportError] = useState("");
    const importInput = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = personal ? "宋画全集 · 个人阅读档案" : "宋画全集 · 我的阅读清单";
        return () => { document.title = previousTitle; };
    }, [personal]);

    const editionArtworks = useMemo(() => catalog.artworks.filter((item) => filters.edition === "all" || item.edition === filters.edition), [catalog, filters.edition]);
    const volumes = useMemo(() => [...new Set(editionArtworks.map((item) => item.volume))], [editionArtworks]);
    const books = useMemo(() => filters.volume === null ? [] : [...new Set(editionArtworks.filter((item) => item.volume === filters.volume).map((item) => item.book))], [editionArtworks, filters.volume]);
    const filtered = useMemo(() => filterArtworks(catalog.artworks, filters, readIds), [catalog, filters, readIds]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const shown = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const editionRead = editionArtworks.filter((item) => readIds.has(item.id)).length;
    const currentEdition = editions.find((edition) => edition.value === filters.edition)!;
    const hasFilters = Boolean(filters.query || filters.volume || filters.reading !== "all");

    const updateFilters = (patch: Partial<CatalogFilters>) => {
        setFilters((previous) => ({ ...previous, ...patch }));
        setPage(1);
    };

    const importProgress = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setImportError("");
        try {
            if (file.size > 1024 * 1024) throw new Error("阅读记录文件过大，请选择从本应用导出的备份。");
            const imported = parseProgress(await file.text(), validIds);
            if (await mergeProgress(imported)) setMessage(`已合并 ${imported.size} 条看过记录。`);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : "无法导入该文件，请选择阅读记录 JSON 备份。");
        }
    };

    const migrateLegacy = async () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) { setMessage("这个浏览器没有旧版阅读记录。"); return; }
            const ids = parseProgress(saved, validIds);
            if (await mergeProgress(ids)) setMessage(`已将 ${ids.size} 条旧版已看记录合并到个人档案。`);
        } catch (error) { setImportError(error instanceof Error ? error.message : "无法读取旧版记录。"); }
    };

    const changePage = (next: number) => {
        setPage(next);
        resultsRef.current?.scrollIntoView({ block: "start" });
    };

    return (
        <main className="song-catalog">
            <div className="song-shell">
                <nav className="song-topline" aria-label="页面导航">
                    <Link to="/"><ArrowLeft size={16} /> 应用库</Link>
                    <Link to={personal ? "/song-paintings" : "/song-paintings-me"}>{personal ? "创建我的阅读清单" : "查看个人阅读档案"}<ArrowUpRight size={14} /></Link>
                </nav>

                <header className="song-heading">
                    <div>
                        <p className="song-eyebrow">宋代绘画 · {personal ? "个人阅读档案" : "我的阅读清单"}</p>
                        <h1>宋画全集<span className="song-seal" aria-hidden="true">书目</span></h1>
                        <p className="song-intro">{personal ? "一卷一册，记录我与宋画的相遇。" : "从第一幅开始，为自己的每一次翻阅留下记录。"}</p>
                    </div>
                    <div className="song-progress">
                        <div><span>{currentEdition.label}阅读进度</span><strong>{editionRead}<span> / {editionArtworks.length}</span></strong></div>
                        <progress value={editionRead} max={editionArtworks.length} aria-label={`${currentEdition.label}已看过 ${editionRead} 条，共 ${editionArtworks.length} 条`} />
                        <p>{personal ? import.meta.env.DEV ? saving ? "正在保存到本地 JSON…" : "本地编辑 · 修改保存到目录 JSON" : "个人档案 · 仅供查看" : "你的勾选只保存在当前浏览器，可随时导出。"}</p>
                    </div>
                </header>

                <div className="song-view-controls">
                    <div role="group" aria-label="内容视图"><button type="button" aria-pressed={view === "catalog"} onClick={() => setView("catalog")}><List size={16} />作品目录</button><button type="button" aria-pressed={view === "statistics"} onClick={() => setView("statistics")}><BarChart3 size={16} />阅读统计</button></div>
                    <button type="button" className="song-share-button" disabled={saving} onClick={() => setShareSnapshot(catalog)}><Share2 size={16} />生成分享图</button>
                </div>
                {(warning || importError) && <div className="song-alert" role="alert">{importError || warning}</div>}
                {message && <p className="song-action-message" role="status">{message}</p>}
                {view === "statistics" ? <ReadingStats artworks={catalog.artworks} /> : <>
                <div className="song-editions" role="group" aria-label="版本">
                    {editions.map((edition) => (
                        <button type="button" key={edition.value} aria-pressed={filters.edition === edition.value} onClick={() => updateFilters({ edition: edition.value, volume: null, book: null })}>
                            <span>{edition.label}</span>
                            <span className="song-edition-count">{edition.value === "all" ? catalog.artworks.length : catalog.artworks.filter((item) => item.edition === edition.value).length}</span>
                        </button>
                    ))}
                    <span className="song-edition-note">{filters.edition === "all" ? `${new Set(catalog.artworks.map((item) => item.volume)).size} 卷 · ${new Set(catalog.artworks.map((item) => `${item.volume}-${item.book}`)).size} 册` : currentEdition.note}</span>
                </div>

                <div className="song-workspace">
                    <aside className="song-volumes" aria-label="按卷查阅">
                        <h2>卷册索引</h2>
                        <div className="song-volume-list">
                            <button type="button" className="song-volume" aria-pressed={filters.volume === null} onClick={() => updateFilters({ volume: null, book: null })}><span>全部卷册</span><span>{editionArtworks.length}</span></button>
                            {volumes.map((volume) => {
                                const entries = editionArtworks.filter((item) => item.volume === volume);
                                const readCount = entries.filter((item) => readIds.has(item.id)).length;
                                return <button type="button" className="song-volume" key={volume} aria-pressed={filters.volume === volume} onClick={() => updateFilters({ volume, book: null })}>
                                    <span>第 {volume} 卷<small>{new Set(entries.map((item) => item.book)).size} 册 · 已看 {readCount}</small></span><span>{entries.length}</span>
                                </button>;
                            })}
                        </div>
                        <div className="song-backup">
                            <h3>阅读记录</h3>
                            <p>{personal ? canEditMetadata ? "在本地编辑并保存后，重新部署即可更新公开档案。" : "这是已发布的个人档案。可以去公共目录创建自己的阅读清单。" : "换设备前导出备份，导入后继续记录。你的勾选不会修改个人档案。"}</p>
                            <button type="button" onClick={() => downloadJson(createProgress(readIds), `宋画全集_${personal ? "个人档案" : "我的阅读记录"}.json`)}><Download size={15} /> 导出阅读记录</button>
                            {(!personal || canEditMetadata) && <><button type="button" disabled={saving} onClick={() => importInput.current?.click()}><Upload size={15} /> 导入阅读记录</button><input className="song-sr-only" ref={importInput} type="file" accept=".json,application/json" aria-label="导入阅读记录文件" onChange={(event) => void importProgress(event)} /></>}
                            {canEditMetadata && <button type="button" disabled={saving} onClick={() => void migrateLegacy()}>迁移此浏览器的旧版记录</button>}
                        </div>
                    </aside>

                    <section className="song-directory" aria-label="作品目录">
                        <div className="song-filters">
                            <div className="song-search">
                                <Search size={19} aria-hidden="true" />
                                <input type="search" aria-label="搜索作品、作者或馆藏地" placeholder="搜索作品、作者、年代或馆藏地" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} />
                                {filters.query && <button type="button" aria-label="清空搜索" onClick={() => updateFilters({ query: "" })}><X size={16} /></button>}
                            </div>
                            <label className="song-select"><span>册号</span><select aria-label="筛选册号" value={filters.book ?? ""} disabled={filters.volume === null} onChange={(event) => updateFilters({ book: event.target.value ? Number(event.target.value) : null })}><option value="">{filters.volume === null ? "请先选卷" : "全部册"}</option>{books.map((book) => <option key={book} value={book}>第 {book} 册</option>)}</select></label>
                            <label className="song-select"><span>阅读</span><select aria-label="筛选阅读状态" value={filters.reading} onChange={(event) => updateFilters({ reading: event.target.value as CatalogFilters["reading"] })}><option value="all">全部状态</option><option value="unread">没看过</option><option value="read">看过</option></select></label>
                        </div>

                        <div className="song-result-bar" ref={resultsRef}>
                            <div><h2>{filters.volume ? `第 ${filters.volume} 卷${filters.book ? ` · 第 ${filters.book} 册` : ""}` : currentEdition.label}</h2><span>{filtered.length} 条作品</span>{hasFilters && <button type="button" className="song-reset" onClick={() => updateFilters({ volume: null, book: null, query: "", reading: "all" })}>重置筛选</button>}</div>
                            <button type="button" className="song-export" onClick={() => downloadJson({ schemaVersion: catalog.schemaVersion, title: catalog.title, artworks: filtered }, `宋画全集_${currentEdition.label}_目录.json`)}><Download size={15} /> 导出当前目录 <span>JSON</span></button>
                        </div>

                        {shown.length ? <div className="song-table-scroll"><table className="song-table">
                            <caption className="song-sr-only">宋画全集作品目录{canEditReading ? "，阅读状态可直接勾选" : "，个人阅读档案只读"}</caption>
                            <thead><tr><th scope="col">看过</th><th scope="col">原序</th><th scope="col">年代</th><th scope="col">作者</th><th scope="col">作品名称</th><th scope="col">卷号</th><th scope="col">册号</th><th scope="col">书内页码</th><th scope="col">馆藏地</th><th scope="col">目录PDF页</th>{canEditMetadata && <th scope="col">编辑</th>}</tr></thead>
                            <tbody>{shown.map((artwork) => {
                                const checked = readIds.has(artwork.id);
                                return <tr key={artwork.id} data-read={checked}>
                                    <td className="song-cell-check">{canEditReading ? <label className="song-checkbox"><input type="checkbox" checked={checked} disabled={saving} aria-label={`标记《${artwork.title}》为看过（第${artwork.volume}卷第${artwork.book}册，原序${artwork.sequence}）`} onChange={(event) => { void toggleRead(artwork.id, event.target.checked).catch(() => setMessage("更新失败，请重试。")); }} /><span aria-hidden="true"><Check size={14} strokeWidth={2.8} /></span></label> : <span className="song-readonly-check" data-checked={checked} role="img" aria-label={checked ? "看过" : "没看过"}><Check size={14} strokeWidth={2.8} /></span>}</td>
                                    <td className="song-cell-sequence" data-label="原序">{artwork.sequence}</td>
                                    <td className="song-cell-period" data-label="年代">{artwork.period || "—"}</td>
                                    <td className="song-cell-artist" data-label="作者">{artwork.artist || "—"}</td>
                                    <td className="song-cell-title">{artwork.title}</td>
                                    <td className="song-cell-volume" data-label="卷号">第 {artwork.volume} 卷</td>
                                    <td className="song-cell-book" data-label="册号">第 {artwork.book} 册</td>
                                    <td className="song-cell-page" data-label="书内页码">{artwork.page ?? "—"}</td>
                                    <td className="song-cell-collection" data-label="馆藏">{artwork.collection || "—"}</td>
                                    <td className="song-cell-pdf" data-label="目录PDF页">{artwork.catalogPdfPage ?? "—"}</td>
                                    {canEditMetadata && <td className="song-cell-edit"><button type="button" disabled={saving} aria-label={`编辑《${artwork.title}》`} onClick={() => setEditing(artwork)}><Pencil size={14} /></button></td>}
                                </tr>;
                            })}</tbody>
                        </table></div> : <div className="song-empty"><Search size={28} /><h3>没有找到匹配的作品</h3><p>试试更短的作品名、作者名，或放宽卷册与阅读状态筛选。</p><button type="button" onClick={() => updateFilters({ ...initialFilters, edition: filters.edition })}>清除筛选 <ArrowUpRight size={15} /></button></div>}

                        <footer className="song-pagination">
                            <span>{filtered.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} / ${filtered.length} 条` : "0 条作品"}</span>
                            <div><button type="button" aria-label="上一页" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={18} /></button><span>{currentPage} / {pageCount}</span><button type="button" aria-label="下一页" disabled={currentPage >= pageCount} onClick={() => changePage(currentPage + 1)}><ChevronRight size={18} /></button></div>
                        </footer>
                        <p className="song-footnote">“—”表示原目录未提供。国内／海外按卷号划分。{personal ? "个人档案展示随部署发布的阅读记录。" : "个人勾选仅保存在当前浏览器，建议定期导出。"}</p>
                    </section>
                </div>
                </>}
                {editing && canEditMetadata && <ArtworkEditor artwork={editing} saving={saving} onSave={saveArtwork} onClose={() => setEditing(null)} />}
                {shareSnapshot && <ShareDialog catalog={shareSnapshot} personal={personal} onClose={() => setShareSnapshot(null)} />}
            </div>
        </main>
    );
}

export default function SongPaintings() { return <SongPaintingsPage mode="visitor" />; }
