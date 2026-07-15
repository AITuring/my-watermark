import { lazy, Suspense, useContext, useState, useRef, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    useNavigate,
    useLocation,
} from "react-router-dom";
import { ThemeProvider, ThemeContext } from "./context";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
    Crop,
    Focus,
    Landmark,
    ImagePlus,
    Images,
    Info,
    LayoutGrid,
    FileArchive,
    MoonStar,
    PanelRightOpen,
    PanelsTopLeft,
    Pencil,
    SunMedium,
    X,
} from "lucide-react";
import Landing from "./Landing";
import "./App.css";
import { Toaster } from "sonner";
import { appCatalog } from "./app-catalog";

const routeItems = appCatalog.map((item) => ({
    ...item,
    Page: lazy(item.component),
}));

const menuItems = [
    { path: "/", icon: LayoutGrid, label: "应用库" },
    { path: "/watermark", icon: ImagePlus, label: "水印添加" },
    { path: "/puzzle", icon: PanelsTopLeft, label: "图片拼接" },
    { path: "/crop", icon: Crop, label: "图片裁切" },
    { path: "/rename", icon: Pencil, label: "图片重命名" },
    { path: "/photo-exif", icon: Info, label: "照片 EXIF" },
    { path: "/focus-stack", icon: Focus, label: "焦点合成" },
    { path: "/google-photo", icon: Images, label: "Google 相册" },
    { path: "/compress", icon: FileArchive, label: "图片压缩" },
    { path: "/wenwu", icon: Landmark, label: "195禁出" },
] as const;

const menuButtonClass =
    "w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95";

const inactiveMenuButtonClass =
    "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80";

const activeMenuButtonClass =
    "bg-blue-600 text-white shadow-md shadow-blue-600/20 dark:bg-blue-500 dark:shadow-blue-500/25";

const iconClass = "w-4 h-4";

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
        if (e.pointerType === 'mouse' && e.buttons === 0) return;
        const next = clamp(e.clientX - dragRef.current.offsetX, e.clientY - dragRef.current.offsetY);
        setPos(next);
    };
    const endDragOrClick = (e: ReactPointerEvent<HTMLElement>) => {
        if (!dragRef.current.dragging) return;
        const moved = Math.hypot(
            e.clientX - dragRef.current.startX,
            e.clientY - dragRef.current.startY
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
                                ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/20"
                                : "bg-pink-500 text-white hover:bg-pink-600 shadow-md shadow-pink-500/20"
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
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition-all mt-1"
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
                    className="bg-white/80 backdrop-blur-xl shadow-2xl shadow-black/10 border border-white/60 rounded-[2rem] p-2 flex flex-col items-center gap-2 transition-all hover:bg-white hover:shadow-black/15 dark:bg-slate-900/85 dark:border-white/10 dark:shadow-black/40 dark:hover:bg-slate-900/95"
                    style={{ transform: expandUp ? "translateY(-100%)" : undefined }}
                >
                    <TooltipProvider>
                        {expandUp ? (
                            <>
                                {menuItems.map(renderMenuButton)}
                                <div className="w-6 h-px bg-slate-200 dark:bg-white/10 my-0.5"></div>
                                {renderThemeButton()}
                                {renderCloseButton()}
                            </>
                        ) : (
                            <>
                                {renderCloseButton()}
                                {menuItems.map(renderMenuButton)}
                                <div className="w-6 h-px bg-slate-200 dark:bg-white/10 my-0.5"></div>
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
                                className="w-10 h-10 rounded-full bg-white shadow-xl shadow-slate-300/30 border border-slate-200 flex items-center justify-center text-slate-600 hover:scale-110 hover:text-blue-600 transition-all cursor-pointer group dark:bg-slate-900/90 dark:border-white/10 dark:shadow-black/40 dark:text-slate-200 dark:hover:text-blue-400"
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

const App = () => {
    return (
        <ThemeProvider>
            <div className="w-screen min-h-screen text-gray-800 bg-transparent dark:text-white">
                <BrowserRouter>
                    {/* <ChineseStyleNavbar /> */}
                    <div
                        className="flex flex-col w-screen"
                        // style={{ height: "calc(100vh - 80px)" }}
                    >
                        <Routes>
                            <Route path="/" element={<Landing />} />
                            {routeItems.map((item) => (
                                <Route
                                    key={item.id}
                                    path={item.url}
                                    element={
                                        <Suspense fallback={<div className="p-6 text-sm text-gray-500">正在加载页面...</div>}>
                                            <item.Page />
                                        </Suspense>
                                    }
                                />
                            ))}
                        </Routes>
                    </div>
                    <FloatingButtons />
                    <Toaster position="top-center" richColors />
                </BrowserRouter>
            </div>
        </ThemeProvider>
    );
};

export default App;
