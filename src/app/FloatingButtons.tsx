import { useContext, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MoonStar, PanelRightOpen, SunMedium, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeContext } from "@/context";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    activeMenuButtonClass,
    iconClass,
    inactiveMenuButtonClass,
    menuButtonClass,
    menuItems,
} from "./menu-config";

const FloatingButtons = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark, toggleTheme } = useContext(ThemeContext);
    const [open, setOpen] = useState(false);
    const [expandUp, setExpandUp] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragRef = useRef({ dragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });

    useEffect(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setPos({ x: Math.max(8, w - 88), y: Math.max(8, h - 180) });
    }, []);

    const clamp = (x: number, y: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const w = window.innerWidth;
        const h = window.innerHeight;
        const cw = rect?.width ?? 80;
        const ch = rect?.height ?? 80;
        return {
            x: Math.min(Math.max(8, x), w - cw - 8),
            y: Math.min(Math.max(8, y), h - ch - 8),
        };
    };

    const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        dragRef.current.dragging = true;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.offsetX = e.clientX - rect.left;
        dragRef.current.offsetY = e.clientY - rect.top;
        if (e.currentTarget?.setPointerCapture && e.pointerId != null) {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };

    const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
        if (!dragRef.current.dragging) return;
        if (e.pointerType === "mouse" && e.buttons === 0) return;
        const next = clamp(e.clientX - dragRef.current.offsetX, e.clientY - dragRef.current.offsetY);
        setPos(next);
    };

    const endDragOrClick = (e: ReactPointerEvent<HTMLElement>) => {
        if (!dragRef.current.dragging) return;
        const moved = Math.hypot(
            e.clientX - dragRef.current.startX,
            e.clientY - dragRef.current.startY,
        );
        dragRef.current.dragging = false;
        if (!open && moved < 4) {
            openMenu();
        }
    };

    const cancelDrag = () => {
        dragRef.current.dragging = false;
    };

    const openMenu = () => {
        const h = window.innerHeight;
        const above = pos.y;
        const below = h - pos.y;
        setExpandUp(above > below);
        setOpen(true);
    };

    const isActive = (path: string) => location.pathname === path;

    const renderMenuButton = (item: (typeof menuItems)[number]) => {
        const ItemIcon = item.icon;

        return (
            <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        title={item.label}
                        onClick={() => {
                            navigate(item.path);
                            setOpen(false);
                        }}
                        className={`${menuButtonClass} ${
                            isActive(item.path) ? activeMenuButtonClass : inactiveMenuButtonClass
                        }`}
                    >
                        <ItemIcon className={iconClass} />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="left">{item.label}</TooltipContent>
            </Tooltip>
        );
    };

    const renderThemeButton = () => {
        const ThemeIcon = isDark ? SunMedium : MoonStar;

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        title={isDark ? "切换日间模式" : "切换夜间模式"}
                        onClick={toggleTheme}
                        className={`${menuButtonClass} ${
                            isDark
                                ? "bg-amber-300 text-slate-950 hover:bg-amber-200 shadow-sm shadow-amber-400/20"
                                : "bg-slate-900 text-slate-50 hover:bg-slate-800 shadow-sm shadow-slate-900/15"
                        }`}
                    >
                        <ThemeIcon className={iconClass} />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                    {isDark ? "切换日间模式" : "切换夜间模式"}
                </TooltipContent>
            </Tooltip>
        );
    };

    const renderCloseButton = () => (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    title="收起导航"
                    onClick={() => setOpen(false)}
                    style={{ touchAction: "none" }}
                    onPointerDown={startDrag}
                    onPointerMove={onDragMove}
                    onPointerUp={endDragOrClick}
                    onPointerCancel={cancelDrag}
                    className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-muted-foreground transition-all hover:bg-accent/80 hover:text-foreground"
                >
                    <X className={iconClass} />
                </button>
            </TooltipTrigger>
            <TooltipContent side="left">收起导航</TooltipContent>
        </Tooltip>
    );

    return (
        <div
            ref={containerRef}
            className="fixed z-50 flex flex-col items-end"
            style={{ left: pos.x, top: pos.y }}
        >
            {open ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-[2rem] border border-border/70 bg-background/88 p-2 shadow-2xl shadow-black/10 backdrop-blur-xl transition-all hover:bg-background dark:bg-card/88 dark:shadow-black/35"
                    style={{ transform: expandUp ? "translateY(-100%)" : undefined }}
                >
                    <TooltipProvider>
                        {expandUp ? (
                            <>
                                {menuItems.map(renderMenuButton)}
                                <div className="my-0.5 h-px w-6 bg-border"></div>
                                {renderThemeButton()}
                                {renderCloseButton()}
                            </>
                        ) : (
                            <>
                                {renderCloseButton()}
                                {menuItems.map(renderMenuButton)}
                                <div className="my-0.5 h-px w-6 bg-border"></div>
                                {renderThemeButton()}
                            </>
                        )}
                    </TooltipProvider>
                </div>
            ) : (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                style={{ touchAction: "none" }}
                                onPointerDown={startDrag}
                                onPointerMove={onDragMove}
                                onPointerUp={endDragOrClick}
                                onPointerCancel={cancelDrag}
                                className="group flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/92 text-muted-foreground shadow-xl shadow-black/10 transition-all hover:scale-110 hover:text-foreground dark:bg-card/92 dark:shadow-black/35"
                            >
                                <PanelRightOpen className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">打开导航</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
};

export default FloatingButtons;
