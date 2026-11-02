import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Artwork } from "./model";
import type { ArtworkChanges } from "./useCatalog";

export default function ArtworkEditor({ artwork, saving, onSave, onClose }: { artwork: Artwork; saving: boolean; onSave: (id: string, changes: ArtworkChanges) => Promise<boolean>; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [error, setError] = useState("");
    useEffect(() => { dialog.current?.showModal(); }, []);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const text = (name: string) => String(form.get(name) ?? "").trim();
        const page = (name: string) => text(name) === "" ? null : /^\d+$/.test(text(name)) ? Number(text(name)) : text(name);
        const changes: ArtworkChanges = { title: text("title"), artist: text("artist") || null, period: text("period"), collection: text("collection"), volume: Number(text("volume")), book: Number(text("book")), page: page("page"), catalogPdfPage: page("catalogPdfPage") };
        if (await onSave(artwork.id, changes)) onClose(); else setError("未能保存，请检查页面提示或稍后重试。");
    };
    return <dialog ref={dialog} className="song-dialog song-edit-dialog" onCancel={(event) => { if (saving) event.preventDefault(); }} onClose={onClose}>
        <header><div><p>本地目录编辑</p><h2>修正作品信息</h2></div><button type="button" disabled={saving} aria-label="关闭编辑" onClick={onClose}><X size={20} /></button></header>
        <form onSubmit={(event) => void submit(event)}>
            <div className="song-editor-fields">
                <label className="song-field-wide">作品名称<input name="title" defaultValue={artwork.title} required maxLength={300} /></label>
                <label>作者<input name="artist" defaultValue={artwork.artist ?? ""} maxLength={300} /></label>
                <label>年代<input name="period" defaultValue={artwork.period} maxLength={100} /></label>
                <label className="song-field-wide">馆藏地<input name="collection" defaultValue={artwork.collection} maxLength={500} /></label>
                <label>卷号<select name="volume" defaultValue={artwork.volume}>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>第 {i + 1} 卷</option>)}</select></label>
                <label>册号<input name="book" type="number" defaultValue={artwork.book} required min={1} max={99} /></label>
                <label>书内页码<input name="page" defaultValue={artwork.page ?? ""} maxLength={100} placeholder="原目录未提供时留空" /></label>
                <label>目录 PDF 页<input name="catalogPdfPage" defaultValue={artwork.catalogPdfPage ?? ""} maxLength={100} placeholder="未提供时留空" /></label>
            </div>
            <p className="song-dialog-note">保存会写回本地目录 JSON。国内／海外分类随卷号更新，作品标识保留不变。</p>
            {error && <p role="alert" className="song-dialog-error">{error}</p>}
            <footer><button type="button" disabled={saving} onClick={onClose}>取消</button><button type="submit" className="song-primary" disabled={saving}>{saving ? "正在保存…" : "保存修改"}</button></footer>
        </form>
    </dialog>;
}
