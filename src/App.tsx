import { useState, useEffect } from "react";
import { Navbar, Tabs, Tab } from "@nextui-org/react";
import NavTabs from "./components/animata/container/nav-tabs";
import useDarkMode from "use-dark-mode";
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
        key: "watermark",
        component: <Watermark />,
    },
    {
        label: "大图拼接",
        key: "puzzle",
        component: <Puzzle />,
    },
    {
        label: "微博抽奖",
        key: "lottery",
        component: <Lottery />,
    },
    {
        label: "图片颜色调整",
        key: "change",
        component: <ChangeColor />,
    },
    {
        label: "组件测试",
        key: "comptest",
        component: <CompTest />,
    },
];

const App = () => {
    const darkMode = useDarkMode(false);
    const [current, setCurrent] = useState("watermark");

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
            <NavTabs
                tabs={[
                    "Profile",
                    "Search",
                    "About Us",
                    "Contact Us",
                    "Settings",
                ]}
            />
            <Navbar>
                <Tabs
                    aria-label="Options"
                    color="primary"
                    radius="sm"
                    size="lg"
                    selectedKey={current}
                    onSelectionChange={(e) => setCurrent(e as string)}
                >
                    <Tab key="watermark" title="水印添加" />
                    <Tab key="puzzle" title="大图拼接" />

                    <Tab key="lottery" title="微博抽奖" />

                    <Tab key="change" title="logo变色" />
                    <Tab key="comptest" title="组件测试" />
                </Tabs>
            </Navbar>
            <div>
                {menuItems.find((item) => item.key === current)?.component}
            </div>
        </div>
    );
};

export default App;
