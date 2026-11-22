import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fixedRatioPlacements, recommendColumns } from '../fixed-ratio';
import type { ImgProp } from '../types';

function FixedPhoto({ photo, rect, radius, onPreview, onDelete }: { photo: ImgProp; rect: { left: string; top: string; width: string; height: string }; radius: number; onPreview: () => void; onDelete: () => void }) {
    const { setNodeRef, attributes, listeners, transform, isDragging } = useSortable({ id: photo.id });
    return <div ref={setNodeRef} {...attributes} {...listeners} className="photo-frame group absolute" style={{ ...rect, transform: CSS.Transform.toString(transform), zIndex: isDragging ? 2 : 1, opacity: isDragging ? .7 : 1, touchAction: 'none' }}>
        <img src={photo.src} alt={photo.fileName ?? '拼图照片'} draggable={false} className="h-full w-full cursor-zoom-in object-contain" style={{ borderRadius: radius }} onClick={onPreview} />
        <button type="button" className="interactive-actions absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs text-white opacity-0 focus:opacity-100 group-hover:opacity-100" aria-label={`从拼图移除 ${photo.fileName ?? '照片'}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete(); }}>移除</button>
    </div>;
}

export function FixedRatioPreview({ photos, ratio, columns, gap, radius, onPreview, onDelete }: { photos: ImgProp[]; ratio: number; columns: number | null; gap: number; radius: number; onPreview: (index: number) => void; onDelete: (id: string) => void }) {
    const ref = useRef<HTMLDivElement>(null), [width, setWidth] = useState(1000);
    useEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
        observer.observe(ref.current); return () => observer.disconnect();
    }, []);
    const height = width / ratio;
    const placements = fixedRatioPlacements(photos, width, height, columns ?? recommendColumns(photos, ratio), gap);
    return <div ref={ref} id="puzzle-fixed-canvas" aria-label="固定比例拼图预览" className="relative w-full bg-white" style={{ aspectRatio: String(ratio) }}>
        {photos.map((photo, i) => { const p = placements[i]; return <FixedPhoto key={photo.id} photo={photo} radius={radius} rect={{ left: `${p.x / width * 100}%`, top: `${p.y / height * 100}%`, width: `${p.width / width * 100}%`, height: `${p.height / height * 100}%` }} onPreview={() => onPreview(i)} onDelete={() => onDelete(photo.id)} />; })}
    </div>;
}
