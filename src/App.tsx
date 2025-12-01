import NavTabs from "./components/animata/container/nav-tabs";
import { useContext } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    useNavigate,
    useLocation,
} from "react-router-dom";
import { ThemeProvider, ThemeContext } from "./context";
import { FloatButton } from "antd";
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

    return (
        <FloatButton.Group
            trigger="click"
            tooltip={<div>{location.pathname === "/" ? "应用库" : "导航"}</div>}
            icon={
                <Icon icon="material-symbols:navigation" className=" w-5 h-5" />
            }
        >
            <FloatButton
                tooltip={<div>{isDark ? "夜间" : "白天"}</div>}
                icon={
                    <Icon
                        icon={
                            isDark
                                ? "line-md:moon-rising-alt-loop"
                                : "line-md:moon-alt-to-sunny-outline-loop-transition"
                        }
                        className=" w-4 h-4"
                    />
                }
                onClick={() => {
                    toggleTheme();
                }}
            />
            <FloatButton
                tooltip={<div>应用库</div>}
                icon={
                    <Icon icon="material-symbols:apps" className=" w-4 h-4" />
                }
                type={location.pathname === "/" ? "primary" : "default"}
                onClick={() => {
                    navigate("/");
                }}
            />
            <FloatButton
                tooltip={<div>水印添加</div>}
                icon={<Icon icon="ri:image-ai-line" className=" w-4 h-4" />}
                type={
                    location.pathname === "/watermark" ? "primary" : "default"
                }
                onClick={() => {
                    navigate("/watermark");
                }}
            />
            <FloatButton
                icon={
                    <Icon
                        icon="tabler:layout-board-split"
                        className=" w-5 h-5"
                    />
                }
                type={location.pathname === "/puzzle" ? "primary" : "default"}
                onClick={() => {
                    navigate("/puzzle");
                }}
                tooltip={<div>图片拼接</div>}
            />
            <FloatButton
                icon={<Icon icon="ri:restaurant-2-line" className=" w-5 h-5" />}
                type={
                    location.pathname === "/restaurant" ? "primary" : "default"
                }
                onClick={() => {
                    navigate("/restaurant");
                }}
                tooltip={<div>美食推荐</div>}
            />
            <FloatButton
                icon={<Icon icon="ri:news-line" className=" w-5 h-5" />}
                type={location.pathname === "/news" ? "primary" : "default"}
                onClick={() => {
                    navigate("/news");
                }}
                tooltip={<div>新闻</div>}
            />
            <FloatButton
                icon={<Icon icon="logos:google-photos" className=" w-5 h-5" />}
                type={
                    location.pathname === "/google-photo"
                        ? "primary"
                        : "default"
                }
                onClick={() => {
                    navigate("/google-photo");
                }}
                tooltip={<div>Google 相册</div>}
            />
            <FloatButton
                icon={
                    <Icon
                        icon="material-symbols:compress"
                        className=" w-5 h-5"
                    />
                }
                type={location.pathname === "/compress" ? "primary" : "default"}
                onClick={() => {
                    navigate("/compress");
                }}
                tooltip={<div>图片压缩</div>}
            />
        </FloatButton.Group>
    );
};

const App = () => {
    return (
        <ThemeProvider>
            <div className="w-screen min-h-screen text-gray-800 bg-gradient-to-br from-slate-50 via-stone-100 to-neutral-200 dark:bg-gray-900 dark:text-white">
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
                </BrowserRouter>
            </div>
        </ThemeProvider>
    );
};

export default App;
