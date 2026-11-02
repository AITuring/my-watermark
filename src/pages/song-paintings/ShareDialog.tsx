import { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import type { Catalog } from "./model";

export default function ShareDialog({ catalog, personal, onClose }: { catalog: Catalog; personal: boolean; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [result, setResult] = useState<{ url: string; file: File } | null>(null);
    const [error, setError] = useState("");
    const [canShare, setCanShare] = useState(false);
    useEffect(() => {
        dialog.current?.showModal();
        let alive = true;
        let objectUrl = "";
        void import("./share").then(async ({ createShareImage }) => {
            const blob = await createShareImage(catalog, { productionUrl: window.location.origin + window.location.pathname, profileLabel: personal ? "宋画阅读档案" : "我的宋画阅读" });
            if (!alive) return;
            objectUrl = URL.createObjectURL(blob);
            const file = new File([blob], "宋画全集_阅读分享.png", { type: "image/png" });
            setResult({ url: objectUrl, file });
            setCanShare(Boolean(navigator.share && navigator.canShare?.({ files: [file] })));
        }).catch(() => { if (alive) setError("分享图生成失败，请关闭后重试。"); });
        return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [catalog, personal]);
    const share = async () => {
        if (!result) return;
        try { await navigator.share({ title: "宋画全集 · 阅读记录", files: [result.file] }); }
        catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setError("系统分享暂不可用，可以下载图片后分享。"); }
    };
    return <dialog ref={dialog} className="song-dialog song-share-dialog" onClose={onClose}>
        <header><div><p>把阅读留成一张画笺</p><h2>分享阅读进度</h2></div><button type="button" aria-label="关闭分享" onClick={onClose}><X size={20} /></button></header>
        {result ? <img className="song-share-preview" src={result.url} alt="宋画全集阅读分享图，含总进度、国内海外及各卷阅读统计" /> : !error && <p role="status" className="song-share-loading">正在生成高清分享图…</p>}
        {error && <p role="alert" className="song-dialog-error">{error}</p>}
        <footer>{result && <><a className="song-primary" href={result.url} download="宋画全集_阅读分享.png"><Download size={16} /> 下载图片</a>{canShare && <button type="button" onClick={() => void share()}><Share2 size={16} /> 系统分享</button>}</>}</footer>
    </dialog>;
}
