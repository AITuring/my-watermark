import NavTabs from "./components/animata/container/nav-tabs";
import { useContext } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider,ThemeContext } from "./context";
import { FloatButton } from "antd";
import { Icon } from "@iconify/react";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import CompTest from "./CompTest";

// import BorderWatermark from "./BorderWatermark";
import Lottery from "./Lottery";
import ChangeColor from "./ChangeColor";
import PhotoCollage from "./PhotoCollage";
import ImageStitching from "./ImageStitching";
import RestaurantFinder from "./RestaurantFinder";
import Wenwu from "./wenwu";
import "./App.css";

const menuItems = [
    {
        label: "水印添加",
        id: "watermark",
        url: "/",
        component: <Watermark />,
    },
    {
        label: "大图拼接",
        id: "puzzle",
        url: "/puzzle",
        component: <Puzzle />,
    },
    {
        label: "图片拼接",
        id: "stitch",
        url: "/stitch",
        component: <ImageStitching />,
    },
    {
        label: "餐厅搜索",
        id: "restaurant",
        url: "/restaurant",
        component: <RestaurantFinder />,

    },
    {
        label: "图片颜色调整",
        id: "change",
        url: "/change",
        component: <ChangeColor />,
    },
    {
        label: "195禁出",
        id: "wenwu",
        url: "/wenwu",
        component: <Wenwu />,
    }
    // {
    //     label: "微博抽奖",
    //     id: "lottery",
    //     url: "/lottery",
    //     component: <Lottery />,
    // },
    // {
    //     label: "组件测试",
    //     id: "comptest",
    //     url: "/comptest",
    //     component: <CompTest />,
    // },
    // {
    //     label: "图片拼接",
    //     id: "collage",
    //     url: "/collage",
    //     component: <PhotoCollage />,
    // },
];

const FloatingButtons = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark, toggleTheme } = useContext(ThemeContext);

    return (
        <FloatButton.Group
            trigger="click"
            tooltip={<div>{location.pathname === "/" ? '水印添加' : '图片拼接'}</div>}
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
                tooltip={<div>水印添加</div>}
                icon={
                    <Icon
                        icon="ri:image-ai-line"
                        className=" w-4 h-4"
                    />
                }
                type={location.pathname === "/" ? "primary": "default"}
                onClick={() => {
                    navigate("/");
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
        </FloatButton.Group>
    );
};

const App = () => {

    return (
        <ThemeProvider>
            <div className="w-screen min-h-screen text-gray-800 bg-gray-100 dark:bg-gray-900 dark:text-white">
                <BrowserRouter>
                    {/* <NavTabs tabs={menuItems} /> */}
                    <div className="flex flex-col w-screen h-screen">
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
