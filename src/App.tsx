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
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            <TooltipProvider>
                {open && (
                    <div className="flex flex-col items-end gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="rounded-full"
                                    onClick={toggleTheme}
                                >
                                    <Icon
                                        icon={
                                            isDark
                                                ? "line-md:moon-rising-alt-loop"
                                                : "line-md:moon-alt-to-sunny-outline-loop-transition"
                                        }
                                        className=" w-4 h-4"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isDark ? "夜间" : "白天"}</TooltipContent>
                        </Tooltip>
                        {[
                            { path: "/", icon: "material-symbols:apps", label: "应用库" },
                            { path: "/watermark", icon: "ri:image-ai-line", label: "水印添加" },
                            { path: "/puzzle", icon: "tabler:layout-board-split", label: "图片拼接" },
                            { path: "/restaurant", icon: "ri:restaurant-2-line", label: "美食推荐" },
                            { path: "/news", icon: "ri:news-line", label: "新闻" },
                            { path: "/google-photo", icon: "logos:google-photos", label: "Google 相册" },
                            { path: "/compress", icon: "material-symbols:compress", label: "图片压缩" },
                        ].map((item) => (
                            <Tooltip key={item.path}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={isActive(item.path) ? "default" : "secondary"}
                                        size="icon"
                                        className={`rounded-full ${isActive(item.path) ? "bg-blue-600 text-white" : ""}`}
                                        onClick={() => navigate(item.path)}
                                    >
                                        <Icon icon={item.icon} className=" w-5 h-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{item.label}</TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full"
                            onClick={() => setOpen((v) => !v)}
                        >
                            <Icon icon="material-symbols:navigation" className=" w-5 h-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{location.pathname === "/" ? "应用库" : "导航"}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
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
