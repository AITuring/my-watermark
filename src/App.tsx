import { useEffect } from "react";
import { Navbar, Tabs, Tab } from "@nextui-org/react";
import NavTabs from "./components/animata/container/nav-tabs";
import useDarkMode from "use-dark-mode";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import CompTest from "./CompTest";
// import BorderWatermark from "./BorderWatermark";
import Lottery from "./Lottery";
import ChangeColor from "./ChangeColor";
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
        label: "微博抽奖",
        id: "lottery",
        url: "/lottery",
        component: <Lottery />,
    },
    {
        label: "图片颜色调整",
        id: "change",
        url: "/change",
        component: <ChangeColor />,
    },
    {
        label: "组件测试",
        id: "comptest",
        url: "/comptest",
        component: <CompTest />,
    },
];

const App = () => {
    const darkMode = useDarkMode(false);

    useEffect(() => {
        const time = new Date().getHours();

        if (time > 18 || time < 7) {
            darkMode.enable();
        } else {
            darkMode.disable();
        }
    }, []);

    return (
        <div
            className={`${
                darkMode.value ? "dark" : ""
            } text-foreground bg-background w-screen h-screen`}
        >
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
    );
};

export default App;
