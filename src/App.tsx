import NavTabs from "./components/animata/container/nav-tabs";
import { useContext, useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    useNavigate,
    useLocation,
} from "react-router-dom";
import { ThemeProvider, ThemeContext } from "./context";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import CompTest from "./CompTest";
import LandscapePainting from "./components/LandscapePainting";
import NewsApp from "./News";
import ImageCollage from "./ImageCollage";
import Landing from "./Landing";
import FileRenamer from "./FileRenamer";

// import BorderWatermark from "./BorderWatermark";
import Lottery from "./Lottery";
import ChangeColor from "./ChangeColor";
import PhotoCollage from "./PhotoCollage";
import ImageStitching from "./ImageStitching";
import RestaurantFinder from "./RestaurantFinder";
import Wenwu from "./Wenwu";
import "./App.css";
import BatchImageCompressor from "./BatchImageCompressor";
import GooglePhoto from "./GooglePhoto";
import ImageSplitter from "./ImageSplitter";
import Calendar from "./Calendar";
import { Toaster } from "sonner";


const routeItems = [
    {
        label: "应用库",
        id: "landing",
        url: "/",
        component: <Landing />,
        icon: "material-symbols:apps",
    },
    {
        label: "水印添加",
        id: "watermark",
        url: "/watermark",
        component: <Watermark />,
        icon: "ri:image-ai-line",
    },
    {
        label: "批量压缩",
        id: "compress",
        url: "/compress",
        component: <BatchImageCompressor />,
        icon: "material-symbols:compress",
    },
    {
        label: "Google 相册",
        id: "photo",
        url: "/google-photo",
        component: <GooglePhoto />,
        icon: "logos:google-photos",
    },
    {
        label: "图片分割",
        id: "split",
        url: "/split",
        component: <ImageSplitter />,
        icon: "material-symbols:split-vertical",
    },
    {
        label: "大图拼接",
        id: "puzzle",
        url: "/puzzle",
        component: <Puzzle />,
        icon: "tabler:layout-board-split",
    },
    {
        label: "图片拼接",
        id: "stitch",
        url: "/stitch",
        component: <ImageStitching />,
        icon: "material-symbols:photo-library-outline",
    },
    {
        label: "餐厅搜索",
        id: "restaurant",
        url: "/restaurant",
        component: <RestaurantFinder />,
        icon: "ri:restaurant-2-line",
    },
    {
        label: "图片颜色调整",
        id: "change",
        url: "/change",
        component: <ChangeColor />,
        icon: "material-symbols:palette-outline",
    },
    {
        label: "195禁出",
        id: "wenwu",
        url: "/wenwu",
        component: <Wenwu />,
        icon: "material-symbols:museum-outline",
    },
    {
        label: "新闻",
        id: "news",
        url: "/news",
        component: <NewsApp />,
        icon: "ri:news-line",
    },
    {
        label: "图片拼接",
        id: "collage",
        url: "/collage",
        component: <ImageCollage />,
        icon: "material-symbols:photo-library-outline",
    },
    {
        label: "文件重命名",
        id: "rename",
        url: "/rename",
        component: <FileRenamer />,
        icon: "material-symbols:file-rename-outline",
    },
    {
        label: "测试",
        id: "test",
        url: "/test",
        component: (
            <LandscapePainting
                width={1400}
                height={900}
                seed="qing-a2"
            />
        ),
        icon: "material-symbols:test-tube",
    },
    {
        label: "日历",
        id: "calendar",
        url: "/calendar",
        component: <Calendar />,
        icon: "material-symbols:calendar-month-outline",
    },
];


const FloatingButtons = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark, toggleTheme } = useContext(ThemeContext);
    const [open, setOpen] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end">
            {open ? (
                <div className="bg-white/80 backdrop-blur-xl shadow-2xl shadow-black/10 border border-white/60 rounded-[2rem] p-3 flex flex-col items-center gap-3 transition-all hover:bg-white hover:shadow-black/15">
                    <TooltipProvider>
                        {[
                            {
                                path: "/",
                                icon: "material-symbols:apps",
                                label: "应用库",
                            },
                            {
                                path: "/watermark",
                                icon: "ri:image-ai-line",
                                label: "水印添加",
                            },
                            {
                                path: "/puzzle",
                                icon: "tabler:layout-board-split",
                                label: "图片拼接",
                            },
                            {
                                path: "/restaurant",
                                icon: "ri:restaurant-2-line",
                                label: "美食推荐",
                            },
                            {
                                path: "/news",
                                icon: "ri:news-line",
                                label: "新闻",
                            },
                            {
                                path: "/google-photo",
                                icon: "logos:google-photos",
                                label: "Google 相册",
                            },
                            {
                                path: "/compress",
                                icon: "material-symbols:compress",
                                label: "图片压缩",
                            },
                             {
                                path: "/wenwu",
                                icon: "ri:globe-line",
                                label: "195禁出",
                            },
                        ].map((item) => (
                            <Tooltip key={item.path}>
                                <TooltipTrigger asChild>
                                    <button
                                        title={item.label}
                                        onClick={() => navigate(item.path)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                                            isActive(item.path)
                                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                                : "text-slate-500 hover:bg-slate-100"
                                        }`}
                                    >
                                        <Icon
                                            icon={item.icon}
                                            className="w-5 h-5"
                                        />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    {item.label}
                                </TooltipContent>
                            </Tooltip>
                        ))}

                        <div className="w-8 h-px bg-slate-200 my-1"></div>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    title={isDark ? "切换日间模式" : "切换夜间模式"}
                                    onClick={toggleTheme}
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all hover:scale-110 active:scale-95"
                                >
                                    <Icon
                                        icon={
                                            isDark
                                                ? "line-md:moon-rising-alt-loop"
                                                : "line-md:moon-alt-to-sunny-outline-loop-transition"
                                        }
                                        className="w-5 h-5"
                                    />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                {isDark ? "切换日间模式" : "切换夜间模式"}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    title="收起导航"
                                    onClick={() => setOpen(false)}
                                    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all mt-1"
                                >
                                    <Icon
                                        icon="mdi:close"
                                        className="w-5 h-5"
                                    />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                收起导航
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            ) : (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                onClick={() => setOpen(true)}
                                className="w-12 h-12 rounded-full bg-white shadow-xl shadow-slate-300/30 border border-slate-200 flex items-center justify-center text-slate-600 hover:scale-110 hover:text-blue-600 transition-all cursor-pointer group"
                            >
                                <Icon
                                    icon="material-symbols:navigation"
                                    className="w-6 h-6 group-hover:rotate-12 transition-transform"
                                />
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
                        style={{ height: "calc(100vh - 80px)" }}
                    >
                        <Routes>
                            {routeItems.map((item) => (
                                <Route
                                    key={item.id}
                                    path={item.url}
                                    element={item.component}
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
