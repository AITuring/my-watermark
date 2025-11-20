import NavTabs from "./components/animata/container/nav-tabs";
import { useContext } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider,ThemeContext } from "./context";
import { FloatButton } from "antd";
import { Icon } from "@iconify/react";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import CompTest from "./CompTest";
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



const menuItems = [
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
];

// 中国风导航栏组件
const ChineseStyleNavbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark, toggleTheme } = useContext(ThemeContext);

    const currentItem = menuItems.find(item => item.url === location.pathname) || menuItems[0];

    return (
        <div className="relative">
            {/* 导航栏背景 */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-50/80 via-stone-100/80 to-neutral-200/80 backdrop-blur-xl border-b border-white/30"></div>

            {/* 导航栏内容 */}
            <nav className="relative z-10 px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo区域 */}
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-600 rounded-lg flex items-center justify-center shadow-lg">
                            <Icon icon="material-symbols:image" className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-light text-slate-700 tracking-wide">图像工坊</span>
                    </div>

                    {/* 导航菜单 */}
                    <div className="hidden md:flex items-center space-x-1">
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.url;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => navigate(item.url)}
                                    className={`group relative px-4 py-2 rounded-xl transition-all duration-300 ${
                                        isActive
                                            ? 'bg-white/40 text-slate-800 shadow-lg'
                                            : 'text-slate-600 hover:bg-white/20 hover:text-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center space-x-2">
                                        <Icon
                                            icon={item.icon}
                                            className={`w-4 h-4 transition-transform duration-300 ${
                                                isActive ? 'scale-110' : 'group-hover:scale-105'
                                            }`}
                                        />
                                        <span className="text-sm font-light tracking-wide">{item.label}</span>
                                    </div>

                                    {/* 活跃状态指示器 */}
                                    {isActive && (
                                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-slate-400 to-slate-600 rounded-full"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* 右侧控制区 */}
                    <div className="flex items-center space-x-3">
                        {/* 主题切换 */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-300 text-slate-600 hover:text-slate-800"
                        >
                            <Icon
                                icon={isDark ? "line-md:moon-rising-alt-loop" : "line-md:sun-rising-loop"}
                                className="w-5 h-5"
                            />
                        </button>

                        {/* 移动端菜单按钮 */}
                        <button className="md:hidden p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-300 text-slate-600 hover:text-slate-800">
                            <Icon icon="material-symbols:menu" className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 移动端下拉菜单 */}
                <div className="md:hidden mt-4 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.url)}
                                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                                    isActive
                                        ? 'bg-white/40 text-slate-800 shadow-lg'
                                        : 'text-slate-600 hover:bg-white/20 hover:text-slate-800'
                                }`}
                            >
                                <Icon icon={item.icon} className="w-5 h-5" />
                                <span className="text-sm font-light tracking-wide">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

const FloatingButtons = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark, toggleTheme } = useContext(ThemeContext);

    return (
        <FloatButton.Group
            trigger="click"
            tooltip={<div>{location.pathname === "/" ? '应用库' : '导航'}</div>}
            icon={
                <Icon
                    icon="material-symbols:navigation"
                    className=" w-5 h-5"
                />
            }
        >
            <FloatButton
                tooltip={<div>{isDark ? '夜间' : '白天'}</div>}
                icon={
                    <Icon
                        icon={isDark ? "line-md:moon-rising-alt-loop" : "line-md:moon-alt-to-sunny-outline-loop-transition"}
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
                    <Icon
                        icon="material-symbols:apps"
                        className=" w-4 h-4"
                    />
                }
                type={location.pathname === "/" ? "primary": "default"}
                onClick={() => {
                    navigate("/");
                }}
            />
            <FloatButton
                tooltip={<div>水印添加</div>}
                icon={
                    <Icon
                        icon="ri:image-ai-line"
                        className=" w-4 h-4"
                    />
                }
                type={location.pathname === "/watermark" ? "primary": "default"}
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
                type={location.pathname === "/puzzle" ? "primary": "default"}
                onClick={() => {
                    navigate("/puzzle");
                }}
                tooltip={<div>图片拼接</div>}
            />
            <FloatButton
                icon={
                    <Icon
                        icon="ri:restaurant-2-line"
                        className=" w-5 h-5"
                    />
                }
                type={location.pathname === "/restaurant" ? "primary": "default"}
                onClick={() => {
                    navigate("/restaurant");
                }}
                tooltip={<div>美食推荐</div>}
            />
             <FloatButton
                icon={
                    <Icon
                        icon="ri:news-line"
                        className=" w-5 h-5"
                    />
                }
                type={location.pathname === "/news" ? "primary": "default"}
                onClick={() => {
                    navigate("/news");
                }}
                tooltip={<div>新闻</div>}
            />
             <FloatButton
                icon={
                    <Icon
                        icon="logos:google-photos"
                        className=" w-5 h-5"
                    />
                }
                type={location.pathname === "/google-photo" ? "primary": "default"}
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
                type={location.pathname === "/compress" ? "primary": "default"}
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
                    <div className="flex flex-col w-screen" style={{ height: 'calc(100vh - 80px)' }}>
                        <Routes>
                            {menuItems.map((item) => (
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
