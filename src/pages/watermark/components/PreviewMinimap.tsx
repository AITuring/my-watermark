import {useEffect, useRef, useState} from 'react';
import type {KeyboardEvent, PointerEvent} from 'react';
import {ChevronDown, ScanEye} from 'lucide-react';
import {fitPreviewImage} from '../preview-zoom';
import {getMinimapViewport, minimapPointToCenter} from '../preview-minimap';
import './preview-minimap.css';

type Point = {x: number; y: number};
type Props = {
    image: HTMLImageElement;
    imageWidth: number;
    imageHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    zoom: number;
    center: Point;
    onCenterChange: (center: Point) => void;
};

export default function PreviewMinimap({image, imageWidth, imageHeight, viewportWidth, viewportHeight, zoom, center, onCenterChange}: Props) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const drag = useRef<{pointerId: number; offset: Point; start: Point; moved: boolean} | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [dragging, setDragging] = useState(false);
    const thumb = fitPreviewImage(image.naturalWidth, image.naturalHeight, 156, 112, 0);
    const view = getMinimapViewport(center, zoom, viewportWidth, viewportHeight, imageWidth, imageHeight);

    useEffect(() => {
        const target = canvas.current;
        if (!target || collapsed) return;
        const density = Math.min(window.devicePixelRatio || 1, 2);
        target.width = Math.max(1, Math.round(thumb.width * density));
        target.height = Math.max(1, Math.round(thumb.height * density));
        target.getContext('2d')?.drawImage(image, 0, 0, target.width, target.height);
    }, [image, thumb.width, thumb.height, collapsed]);

    const pointAt = (event: PointerEvent<HTMLDivElement>): Point => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return {x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height};
    };
    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        const click = event.type === 'pointerup' && !drag.current.moved;
        drag.current = null;
        setDragging(false);
        if (click) onCenterChange(minimapPointToCenter(pointAt(event)));
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = (event.shiftKey ? .2 : .05) / zoom;
        const directions: Record<string, Point> = {ArrowLeft: {x: -step, y: 0}, ArrowRight: {x: step, y: 0},
            ArrowUp: {x: 0, y: -step}, ArrowDown: {x: 0, y: step}};
        const delta = directions[event.key];
        if (delta || ['Home', 'Enter', ' '].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            onCenterChange(delta ? minimapPointToCenter({x: center.x + delta.x, y: center.y + delta.y}) : {x: .5, y: .5});
        }
    };

    return <section className={`wm-preview-minimap${collapsed ? ' is-collapsed' : ''}`} aria-label="缩略导航">
        {collapsed ? <button type="button" className="wm-minimap-expand" aria-label="展开缩略导航" title="展开缩略导航" onClick={() => setCollapsed(false)}><ScanEye size={16}/></button> : <>
            <header className="wm-minimap-heading"><span>导航</span><button type="button" aria-label="收起缩略导航" title="收起缩略导航" onClick={() => setCollapsed(true)}><ChevronDown size={13}/></button></header>
            <div className={`wm-minimap-image${dragging ? ' is-dragging' : ''}`} role="button" tabIndex={0}
                aria-label={`调整预览视野：水平 ${Math.round(center.x * 100)}%，垂直 ${Math.round(center.y * 100)}%`}
                title="点击定位或拖动视野框；方向键微调，Home 居中"
                style={{width: thumb.width, height: thumb.height}}
                onKeyDown={onKeyDown}
                onPointerDown={event => {
                    if (!event.isPrimary || event.button !== 0) return;
                    event.preventDefault(); event.stopPropagation();
                    event.currentTarget.focus({preventScroll: true});
                    const point = pointAt(event);
                    const inside = point.x >= view.x && point.x <= view.x + view.width && point.y >= view.y && point.y <= view.y + view.height;
                    drag.current = {pointerId: event.pointerId, offset: inside ? {x: point.x - center.x, y: point.y - center.y} : {x: 0, y: 0},
                        start: {x: event.clientX, y: event.clientY}, moved: false};
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(true);
                    if (!inside) onCenterChange(minimapPointToCenter(point));
                }}
                onPointerMove={event => {
                    if (drag.current?.pointerId !== event.pointerId) return;
                    event.preventDefault(); event.stopPropagation();
                    if (Math.hypot(event.clientX - drag.current.start.x, event.clientY - drag.current.start.y) > 3) drag.current.moved = true;
                    if (drag.current.moved) onCenterChange(minimapPointToCenter(pointAt(event), drag.current.offset));
                }}
                onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
                <canvas ref={canvas} aria-hidden="true"/>
                <span className="wm-minimap-view" aria-hidden="true" style={{left: `${view.x * 100}%`, top: `${view.y * 100}%`, width: `${view.width * 100}%`, height: `${view.height * 100}%`}}/>
            </div>
        </>}
    </section>;
}
