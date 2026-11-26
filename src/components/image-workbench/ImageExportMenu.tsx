import './image-export-menu.css';
import {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, Download} from 'lucide-react';

export interface ImageExportMenuProps {
    onExportCurrent: () => void;
    onExportAll: () => void;
    onExportZip: () => void;
    loading: boolean;
    progress: number;
    imageCount: number;
    disabled?: boolean;
    currentDisabled?: boolean;
    placement?: 'top' | 'bottom';
    className?: string;
}

export default function ImageExportMenu({
    onExportCurrent,
    onExportAll,
    onExportZip,
    loading,
    progress,
    imageCount,
    disabled = false,
    currentDisabled = false,
    placement = 'top',
    className = '',
}: ImageExportMenuProps) {
    const menuId = useId();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                menuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
            }
        };
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
        };
    }, [open]);

    const choose = (action: () => void) => {
        setOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
        action();
    };

    const isDisabled = disabled || loading;
    return (
        <div
            ref={menuRef}
            className={`wm-export-menu wm-export-menu--${placement} ${open ? 'is-open' : ''} ${className}`}
        >
            <button
                type="button"
                className="wm-export-menu-trigger"
                disabled={isDisabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label="选择导出方式"
                onClick={() => setOpen(value => !value)}
                onKeyDown={event => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault(); setOpen(true);
                        requestAnimationFrame(() => {
                            const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
                            (event.key === 'ArrowUp' ? items?.[items.length - 1] : items?.[0])?.focus();
                        });
                    }
                }}
            >
                {loading ? (
                    <span className="wm-export-menu-progress">导出中 {Math.round(progress)}%</span>
                ) : (
                    <>
                        <Download size={15} />
                        <span>导出</span>
                        <ChevronDown size={14} aria-hidden="true" />
                    </>
                )}
            </button>
            {open && <div id={menuId} className="wm-export-menu-list" role="menu" aria-label="导出方式"
                onKeyDown={event => {
                    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
                    const index = items.indexOf(document.activeElement as HTMLButtonElement);
                    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                        event.preventDefault();
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                        items[next]?.focus();
                    }
                }}>
                <button
                    type="button"
                    role="menuitem"
                    disabled={isDisabled || currentDisabled}
                    onClick={() => choose(onExportCurrent)}
                >
                    导出当前
                </button>
                <button
                    type="button"
                    role="menuitem"
                    disabled={isDisabled || !imageCount}
                    onClick={() => choose(onExportAll)}
                >
                    导出全部 <span>{imageCount} 张</span>
                </button>
                <button
                    type="button"
                    role="menuitem"
                    disabled={isDisabled || !imageCount}
                    onClick={() => choose(onExportZip)}
                >
                    ZIP 打包导出
                </button>
            </div>}
        </div>
    );
}
