import { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import type { Catalog } from "./model";
import { buildShareData, SHARE_SCOPES, type ShareScope } from "./shareData";

export default function ShareDialog({ catalog, initialScope = "all", onClose }: { catalog: Catalog; initialScope?: ShareScope; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [scope, setScope] = useState<ShareScope>(initialScope);
    const [result, setResult] = useState<{ url: string; file: File; scope: ShareScope } | null>(null);
    const [error, setError] = useState("");
    const [canShare, setCanShare] = useState(false);
    const data = buildShareData(catalog.artworks, scope);
    const currentResult = result?.scope === scope ? result : null;
    useEffect(() => { dialog.current?.showModal(); }, []);
    useEffect(() => {
        let alive = true;
        let objectUrl = "";
        setResult(null);
        setError("");
        setCanShare(false);
        void import("./share").then(async ({ createShareImage }) => {
            const blob = await createShareImage(catalog, { scope });
            if (!alive) return;
            objectUrl = URL.createObjectURL(blob);
            const label = SHARE_SCOPES.find((choice) => choice.value === scope)!.label;
            const file = new File([blob], `宋画全集_${label}_观画记录.png`, { type: "image/png" });
            setResult({ url: objectUrl, file, scope });
            setCanShare(Boolean(navigator.share && navigator.canShare?.({ files: [file] })));
        }).catch(() => { if (alive) setError("分享图生成失败，请关闭后重试。"); });
        return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [catalog, scope]);
    const share = async () => {
        if (!currentResult) return;
        try { await navigator.share({ title: `宋画全集 · ${data.scopeLabel}观画记录`, files: [currentResult.file] }); }
        catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setError("系统分享暂不可用，可以下载图片后分享。"); }
    };
    return <dialog ref={dialog} className="song-dialog song-share-dialog" aria-labelledby="song-share-title" onClose={onClose}>
        <header><h2 id="song-share-title">分享观画记录</h2><button type="button" aria-label="关闭分享" onClick={onClose}><X size={20} /></button></header>
        <div className="song-share-body"><div className="song-share-options">
            <label htmlFor="song-share-scope">分享数据源</label>
            <select id="song-share-scope" value={scope} onChange={(event) => setScope(event.target.value as ShareScope)}>{SHARE_SCOPES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
            <p aria-live="polite">已看 {data.stats.read} / {data.stats.total} 件</p>
        </div>
        {currentResult ? <img className="song-share-preview" src={currentResult.url} alt={`宋画全集${data.scopeLabel}观画记录：已看${data.stats.read}件，共${data.stats.total}件，包含完成率、馆藏覆盖、版别进度、馆藏进度、年代分布和网站二维码`} /> : !error && <p role="status" className="song-share-loading">正在生成高清分享图…</p>}
        {error && <p role="alert" className="song-dialog-error">{error}</p>}
        </div>
        <footer>{currentResult && <><a className="song-primary" href={currentResult.url} download={currentResult.file.name}><Download size={16} /> 下载图片</a>{canShare && <button type="button" onClick={() => void share()}><Share2 size={16} /> 系统分享</button>}</>}</footer>
    </dialog>;
}
