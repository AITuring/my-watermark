import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Artwork } from "./model";
import { getArtworkThumbnail, type ArtworkThumbnailData } from "./thumbnails";

function ThumbnailPreview({ artwork, sample, onClose }: { artwork: Artwork; sample: ArtworkThumbnailData; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const headingId = useId();
    const [failed, setFailed] = useState(false);
    const { width, height } = sample;

    useEffect(() => {
        const element = dialog.current;
        const previousOverflow = document.body.style.overflow;
        element?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    return <dialog
        ref={dialog}
        className="song-dialog song-thumbnail-dialog"
        aria-labelledby={headingId}
        onClose={onClose}
        onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
        }}
    >
        <header>
            <div><h2 id={headingId}>{artwork.title}{sample.previewPartial && <span className="song-thumbnail-partial">局部</span>}</h2><p>{[artwork.period, artwork.artist, artwork.collection].filter(Boolean).join(" · ")}</p></div>
            <button type="button" aria-label="关闭画作预览" onClick={() => dialog.current?.close()} autoFocus><X size={22} /></button>
        </header>
        <div className="song-thumbnail-stage">
            {failed ? <div className="song-thumbnail-error" role="status"><p>这张画作暂时无法加载</p><button type="button" onClick={() => setFailed(false)}>重新加载</button></div> : <div className="song-thumbnail-frame" style={{ width: `min(100%, ${70 * width / height}dvh)` }}>
                <img src={sample.previewSrc} width={width} height={height} decoding="async" alt={`《${artwork.title}》${sample.previewPartial ? "局部" : ""}`} onError={() => setFailed(true)} />
            </div>}
        </div>
    </dialog>;
}

export default function ArtworkThumbnail({ artwork }: { artwork: Artwork }) {
    const sample = getArtworkThumbnail(artwork.id);
    const trigger = useRef<HTMLButtonElement>(null);
    const [opened, setOpened] = useState(false);
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    if (!sample || sample.src === failedSrc) return null;

    const close = () => {
        setOpened(false);
        requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
    };

    return <>
        <button ref={trigger} type="button" className="song-artwork-thumbnail" aria-label={`预览《${artwork.title}》${sample.previewPartial ? "（局部）" : ""}`} aria-haspopup="dialog" onClick={() => setOpened(true)}>
            <img src={sample.src} width={320} height={320} loading="lazy" decoding="async" alt="" onError={() => setFailedSrc(sample.src)} />
            {sample.previewPartial && <span className="song-thumbnail-badge" aria-hidden="true">局部</span>}
        </button>
        {opened && <ThumbnailPreview artwork={artwork} sample={sample} onClose={close} />}
    </>;
}
