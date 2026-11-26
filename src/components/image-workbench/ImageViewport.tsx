import { usePreviewImage } from "./usePreviewImage";
import { useEffect, useRef, useState, type ReactNode } from "react";
import PreviewMinimap from "./PreviewMinimap";
import PreviewZoomControl from "./PreviewZoomControl";
import "./image-viewport.css";
import { fitPreviewImage } from "./preview-zoom";

export type ImageViewportView = { zoom: number; center: { x: number; y: number } };
const bound = (value: number) => Math.max(0, Math.min(1, value));

export default function ImageViewport({ src, width, height, children, onViewChange }: {
    src: string; width: number; height: number;
    children: ReactNode;
    onViewChange?: (view: ImageViewportView) => void;
}) {
    const viewport = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const image = usePreviewImage(src);
    const [view, setView] = useState<ImageViewportView>({ zoom: 1, center: { x: .5, y: .5 } });
    const pan = useRef<{ id: number; x: number; y: number; center: ImageViewportView['center'] } | null>(null);
    const fit = fitPreviewImage(width, height, size.width, size.height, 20);
    const renderedWidth = fit.width * view.zoom, renderedHeight = fit.height * view.zoom;

    useEffect(() => {
        const element = viewport.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useEffect(() => { setView({ zoom: 1, center: { x: .5, y: .5 } }); }, [src]);
    useEffect(() => onViewChange?.(view), [view, onViewChange]);
    useEffect(() => {
        const element = viewport.current;
        if (!element) return;
        const wheel = (event: WheelEvent) => {
            if ((event.target as Element).closest('.wm-preview-minimap')) return;
            if (!fit.width || !fit.height) return;
            event.preventDefault();
            const bounds = element.getBoundingClientRect();
            const px = event.clientX - bounds.left - size.width / 2;
            const py = event.clientY - bounds.top - size.height / 2;
            setView(previous => {
                const zoom = Math.max(1, Math.min(5, previous.zoom * Math.exp(-event.deltaY * .003)));
                if (zoom === 1) return { zoom, center: { x: .5, y: .5 } };
                return { zoom, center: {
                    x: bound(previous.center.x + px / fit.width * (1 / previous.zoom - 1 / zoom)),
                    y: bound(previous.center.y + py / fit.height * (1 / previous.zoom - 1 / zoom)),
                } };
            });
        };
        element.addEventListener('wheel', wheel, { passive: false });
        return () => element.removeEventListener('wheel', wheel);
    }, [fit.width, fit.height, size.width, size.height]);

    return <div className="image-viewport-shell flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>滚轮缩放 · 拖动空白处平移</span>
            <PreviewZoomControl value={view.zoom} onChange={zoom => setView(previous => ({ zoom, center: zoom === 1 ? { x: .5, y: .5 } : previous.center }))} />
        </div>
        <div ref={viewport} className="relative min-h-[340px] flex-1 touch-none overflow-clip bg-muted/30 lg:min-h-0" aria-label="可缩放图片预览"
            style={{ cursor: view.zoom > 1 ? 'grab' : undefined }}
            onPointerDown={event => {
                if (view.zoom <= 1 || event.button !== 0 || (event.target as Element).closest('[data-image-interaction], .wm-preview-minimap')) return;
                event.preventDefault();
                pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, center: view.center };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
                const drag = pan.current;
                if (!drag || drag.id !== event.pointerId) return;
                setView(previous => ({ ...previous, center: { x: bound(drag.center.x - (event.clientX - drag.x) / renderedWidth), y: bound(drag.center.y - (event.clientY - drag.y) / renderedHeight) } }));
            }}
            onPointerUp={event => { pan.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}>
            <div className="absolute" style={{ width: renderedWidth, height: renderedHeight, left: size.width / 2 - view.center.x * renderedWidth, top: size.height / 2 - view.center.y * renderedHeight }}>{children}</div>
            {image && <PreviewMinimap image={image} imageWidth={fit.width} imageHeight={fit.height} viewportWidth={size.width} viewportHeight={size.height} zoom={view.zoom} center={view.center} onCenterChange={center => setView(previous => ({ ...previous, center }))} />}
        </div>
    </div>;
}
