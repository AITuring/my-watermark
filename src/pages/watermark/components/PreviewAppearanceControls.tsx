import {useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Check, ChevronDown, GripHorizontal, X} from 'lucide-react';
import './preview-appearance-controls.css';

type ColorPanelProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

function FloatingColorPanel({label, trigger, children, headerAction, open, onOpenChange}: ColorPanelProps & {
    label: string; trigger: ReactNode; children: ReactNode; headerAction?: ReactNode;
}) {
    const button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
    const [point, setPoint] = useState<{left: number; top: number} | null>(null);
    const savedPoint = useRef<{left: number; top: number} | null>(null);
    const drag = useRef<{id: number; x: number; y: number; left: number; top: number} | null>(null);
    const [dragging, setDragging] = useState(false);
    const id = useId();
    const move = useCallback((left: number, top: number) => {
        const rect = panel.current?.getBoundingClientRect();
        if (!rect) return;
        const next = {left: Math.max(12, Math.min(left, window.innerWidth - rect.width - 12)),
            top: Math.max(12, Math.min(top, window.innerHeight - rect.height - 12))};
        savedPoint.current = next;
        setPoint(next);
    }, []);
    useLayoutEffect(() => {
        if (!open) {drag.current = null; setDragging(false); return;}
        const rect = panel.current?.getBoundingClientRect(), anchor = button.current?.getBoundingClientRect();
        if (!rect || !anchor) return;
        const saved = savedPoint.current;
        move(saved?.left ?? anchor.left + anchor.width / 2 - rect.width / 2, saved?.top ?? anchor.top - rect.height - 10);
        const resize = () => {const saved = savedPoint.current; if (saved) move(saved.left, saved.top);};
        const observer = new ResizeObserver(resize);
        observer.observe(panel.current!);
        window.addEventListener('resize', resize);
        return () => {observer.disconnect(); window.removeEventListener('resize', resize);};
    }, [open, move]);
    const positioned = point !== null;
    useEffect(() => {if (open && positioned) panel.current?.focus({preventScroll: true});}, [open, positioned]);
    useEffect(() => {
        if (!open) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); onOpenChange(false); button.current?.focus();}
        };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, [open, onOpenChange]);
    return <>
        <button ref={button} type="button" className="wm-canvas-popover-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
            onClick={() => onOpenChange(!open)}>{trigger}</button>
        {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label={label} tabIndex={-1} className={`wm-canvas-popover wm-canvas-color-panel no-drag ${dragging ? 'is-dragging' : ''}`}
            style={{left: point?.left ?? 0, top: point?.top ?? 0, visibility: point ? 'visible' : 'hidden'}}>
            <div className="wm-canvas-popover-heading">
                <div className="wm-color-drag-handle" role="button" tabIndex={0} aria-label="移动颜色面板" title="拖动标题栏移动；方向键微调位置"
                    onPointerDown={event => {
                        if (event.button !== 0 || !savedPoint.current) return;
                        event.preventDefault();
                        drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, ...savedPoint.current};
                        event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
                    }}
                    onPointerMove={event => {const start = drag.current; if (start?.id === event.pointerId) move(start.left + event.clientX - start.x, start.top + event.clientY - start.y);}}
                    onPointerUp={event => {if (drag.current?.id === event.pointerId) {drag.current = null; setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId);}}}
                    onPointerCancel={() => {drag.current = null; setDragging(false);}}
                    onLostPointerCapture={() => {drag.current = null; setDragging(false);}}
                    onKeyDown={event => {
                        const saved = savedPoint.current, offset = event.shiftKey ? 1 : 10;
                        if (!saved || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                        event.preventDefault();
                        move(saved.left + (event.key === 'ArrowRight' ? offset : event.key === 'ArrowLeft' ? -offset : 0),
                            saved.top + (event.key === 'ArrowDown' ? offset : event.key === 'ArrowUp' ? -offset : 0));
                    }}><GripHorizontal size={13}/><strong>{label}</strong></div>
                <div className="wm-canvas-popover-actions">{headerAction}<button type="button" aria-label={`关闭${label}`} onClick={() => {onOpenChange(false); button.current?.focus();}}><X size={16}/></button></div>
            </div>
            {children}
        </div>, document.body)}
    </>;
}

const COMMON_COLORS = [
    {name: '素白', color: '#ffffff'}, {name: '纸白', color: '#f3eee2'},
    {name: '米白', color: '#e6dcc5'}, {name: '银灰', color: '#b6b3ad'},
    {name: '石灰', color: '#78756f'}, {name: '墨黑', color: '#302b27'},
    {name: '浅金', color: '#d4bc86'}, {name: '金色', color: '#af8a4c'},
    {name: '赭石', color: '#a77a56'}, {name: '茶褐', color: '#765b47'},
    {name: '棕黑', color: '#503d32'}, {name: '玄黑', color: '#171a19'},
    {name: '青白', color: '#d5e3dc'}, {name: '青灰', color: '#91a39a'},
    {name: '石绿', color: '#677c69'}, {name: '松绿', color: '#3b5e50'},
    {name: '靛青', color: '#35566a'}, {name: '黛蓝', color: '#2b3b52'},
    {name: '淡朱', color: '#d49a88'}, {name: '朱红', color: '#a63b32'},
    {name: '绛红', color: '#762f34'}, {name: '藕灰', color: '#b899a6'},
    {name: '紫灰', color: '#7c6d80'}, {name: '雾蓝', color: '#8b9eae'},
];

export function WatermarkColorControl({color, automatic, textMode, suggestions, onChange, open, onOpenChange, opacity = 1, onOpacityChange}: ColorPanelProps & {
    color: string; automatic: boolean; textMode: boolean; suggestions: string[]; onChange: (color: string) => void;
    opacity?: number; onOpacityChange?: (value: number) => void;
}) {
    const opacityId = useId();
    const [hex, setHex] = useState(color || '#302b27'), [error, setError] = useState('');
    useEffect(() => {setHex(color || '#302b27'); setError('');}, [color]);
    const choose = (next: string) => {setHex(next); setError(''); onChange(next);};
    const applyHex = () => {
        const value = hex.trim().replace(/^#?/, '#');
        if (!/^#[a-f\d]{6}$/i.test(value)) {setError('请输入 6 位颜色值，例如 #302B27'); return;}
        choose(value.toLowerCase());
    };
    const swatch = (value: string, name: string) => {
        const selected = !automatic && value.toLowerCase() === color.toLowerCase();
        return <button type="button" key={value} className="wm-canvas-swatch" aria-label={`${name} ${value}`} aria-pressed={selected} title={`${name} ${value}`} onClick={() => choose(value)}>
            <span style={{backgroundColor: value}}>{selected && <Check size={16} style={{color: parseInt(value.slice(1, 3), 16) + parseInt(value.slice(3, 5), 16) + parseInt(value.slice(5, 7), 16) > 420 ? '#302b27' : '#fffefa'}}/>}</span>
        </button>;
    };
    return <FloatingColorPanel open={open} onOpenChange={onOpenChange} label="水印颜色" trigger={<><span className="wm-canvas-color-chip"><span className={`wm-canvas-chip-fill ${!textMode && automatic ? 'is-original' : ''}`} style={{...(textMode || !automatic ? {backgroundColor: color} : {}), opacity}}/></span><span>颜色</span><ChevronDown size={14}/></>}
        headerAction={<button type="button" className="wm-canvas-auto-color" aria-pressed={automatic} onClick={() => {setError(''); onChange('transparent');}}><span>{textMode ? '自动配色' : '恢复原色'}</span>{automatic && <Check size={12}/>}</button>}>
        <div className="wm-canvas-color-grid" role="group" aria-label="常用颜色">{COMMON_COLORS.map(item => swatch(item.color, item.name))}</div>
        {suggestions.length > 0 && <><p className="wm-canvas-control-label">画面取色</p><div className="wm-canvas-extracted">{[...new Set(suggestions)].slice(0, 5).map(value => swatch(value, '取色'))}</div></>}
        <div className="wm-canvas-custom-color" title="自定义颜色"><input type="color" aria-label="选择自定义水印颜色" value={/^#[a-f\d]{6}$/i.test(hex) ? hex : '#302b27'} onChange={event => choose(event.target.value)}/>
            <input type="text" aria-label="水印颜色 HEX" value={hex} maxLength={7} spellCheck={false} onChange={event => {setHex(event.target.value); setError('');}} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); applyHex();}}}/>
            <button type="button" onClick={applyHex}>应用</button>
        </div>
        {error && <p className="wm-canvas-control-error" role="alert">{error}</p>}
        <label className="wm-canvas-alpha-control" htmlFor={opacityId}>
            <span><span>透明度</span><output htmlFor={opacityId}>{Math.round(opacity * 100)}%</output></span>
            <input id={opacityId} type="range" aria-label="水印颜色透明度" aria-valuetext={`${Math.round(opacity * 100)}%`} min={0} max={1} step={0.01}
                value={opacity} disabled={!onOpacityChange} onChange={event => onOpacityChange?.(Number(event.target.value))}/>
        </label>
    </FloatingColorPanel>;
}

export function PreviewZoomControl({value, onChange}: {value: number; onChange: (value: number) => void}) {
    const id = useId();
    const percentage = Math.round(value * 100);
    return <div className="wm-canvas-zoom" role="group" aria-label="预览缩放" title="100% 为适应画面，仅影响预览。放大后可拖动画面。">
        <label className="wm-canvas-zoom-inline">
            <output htmlFor={id}>{percentage}%</output>
            <input id={id} type="range" aria-label="调整预览缩放" aria-valuetext={`${percentage}%`} min={100} max={500} step={5}
                value={percentage} onChange={event => onChange(Number(event.target.value) / 100)}/>
        </label>
        <button type="button" className="wm-canvas-fit" title="显示完整画面" onClick={() => onChange(1)}>适应</button>
    </div>;
}
