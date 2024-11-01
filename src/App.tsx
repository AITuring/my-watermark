import NavTabs from "./components/animata/container/nav-tabs";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import CompTest from "./CompTest";

// import BorderWatermark from "./BorderWatermark";
import Lottery from "./Lottery";
import ChangeColor from "./ChangeColor";
import PhotoCollage from "./PhotoCollage";
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
    // {
    //     label: "微博抽奖",
    //     id: "lottery",
    //     url: "/lottery",
    //     component: <Lottery />,
    // },
    // {
    //     label: "图片颜色调整",
    //     id: "change",
    //     url: "/change",
    //     component: <ChangeColor />,
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

const App = () => {
    return (
        <ThemeProvider>
            <div className="w-screen min-h-screen text-gray-800 bg-gray-100 dark:bg-gray-900 dark:text-white">
                <BrowserRouter>
                    <NavTabs tabs={menuItems} />
                    <div className="flex flex-col w-screen h-full">
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
                </BrowserRouter>
            </div>
        </ThemeProvider>
    );
};

export default App;
