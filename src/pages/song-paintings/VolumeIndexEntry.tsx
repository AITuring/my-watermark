import { useEffect, useRef, useState } from "react";
import { Expand } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Artwork } from "./model";

const collectionSummaries: Record<number, string> = {
    5: "国内其他馆",
    6: "欧美馆藏",
    7: "日本馆藏与私藏",
    8: "海内外各馆",
};

function collectionLabel(collection: string) {
    return collection === "私人藏" ? "私人收藏" : collection.replace(/藏$/u, "");
}

export default function VolumeIndexEntry({ volume, entries, readCount, selected, onSelect }: {
    volume: number;
    entries: Artwork[];
    readCount: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [compact, setCompact] = useState(false);
    const openOnPointerDown = useRef(false);
    const list = useRef<HTMLUListElement>(null);
    const collections = [...new Set(entries.map((item) => item.collection.trim()).filter(Boolean))];
    const hasDetails = collections.length > 1;
    const summary = hasDetails ? collectionSummaries[volume] || "多处馆藏" : collections[0] ? collectionLabel(collections[0]) : "馆藏未标注";

    useEffect(() => {
        const query = window.matchMedia("(max-width: 720px)");
        const update = () => setCompact(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    return <div className="song-volume-item">
        <button type="button" className="song-volume" aria-pressed={selected} onClick={onSelect}>
            <span className="song-volume-copy">
                <span>第 {volume} 卷</span>
                <span className="song-volume-collection">{summary}</span>
                <small>{new Set(entries.map((item) => item.book)).size} 册 · 已看 {readCount}</small>
            </span>
            <span className="song-volume-count">{entries.length}</span>
        </button>
        {hasDetails && <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <button type="button" className="song-volume-more" aria-label={`查看第 ${volume} 卷的全部馆藏地`} aria-expanded={open}
                    onPointerDown={() => { openOnPointerDown.current = open; }}
                    onClick={(event) => { event.preventDefault(); setOpen(event.detail === 0 ? !open : !openOnPointerDown.current); }}
                    onKeyDown={(event) => {
                        if (open && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.key)) {
                            event.preventDefault();
                            const target = list.current;
                            if (!target) return;
                            if (event.key === "Home") target.scrollTop = 0;
                            else if (event.key === "End") target.scrollTop = target.scrollHeight;
                            else target.scrollTop += (event.key.endsWith("Down") ? 1 : -1) * (event.key.startsWith("Page") ? target.clientHeight : 48);
                        }
                    }}>
                    <Expand size={13} aria-hidden="true" />
                </button>
            </TooltipTrigger>
            <TooltipContent side={compact ? "bottom" : "right"} align="start" sideOffset={10} collisionPadding={16} className="song-volume-tooltip" aria-label={`第 ${volume} 卷馆藏地：${collections.map(collectionLabel).join("、")}`}>
                <div className="song-volume-tooltip-heading"><strong>第 {volume} 卷 · 馆藏地</strong><span>{collections.length} 处</span></div>
                <ul ref={list}>{collections.map((collection) => <li key={collection}>{collectionLabel(collection)}</li>)}</ul>
            </TooltipContent>
        </Tooltip>}
    </div>;
}
