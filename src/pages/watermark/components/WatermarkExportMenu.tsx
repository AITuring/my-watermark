import {useEffect, useRef, useState} from 'react';
import {ChevronDown, Download} from 'lucide-react';

interface WatermarkExportMenuProps {
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

export default function WatermarkExportMenu({
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
}: WatermarkExportMenuProps) {
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
        action();
    };

    const isDisabled = disabled || loading;
    return (
        <div
            ref={menuRef}
            className={`wm-export-menu wm-export-menu--${placement} ${open ? 'is-open' : ''} ${className}`}
            onMouseEnter={() => !isDisabled && setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                type="button"
                className="wm-export-menu-trigger"
                disabled={isDisabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="选择导出方式"
                onClick={() => setOpen(value => !value)}
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
            <div className="wm-export-menu-list" role="menu" aria-label="导出方式">
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
            </div>
        </div>
    );
}
