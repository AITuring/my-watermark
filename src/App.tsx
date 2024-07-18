import { useState, useEffect } from "react";
import {
    Navbar,
    NavbarContent,
    Switch,
    Tabs,
    Tab,
    Card,
    CardBody,
} from "@nextui-org/react";
import { Sun, MoonStar } from "lucide-react";
import useDarkMode from "use-dark-mode";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
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
                </Tabs>
                <NavbarContent className="flex gap-4" justify="end">
                    <Switch
                        defaultSelected
                        size="lg"
                        // color="secondary"
                        startContent={<Sun />}
                        endContent={<MoonStar />}
                        onChange={(e) =>
                            e.target.checked
                                ? darkMode.disable()
                                : darkMode.enable()
                        }
                    ></Switch>
                </NavbarContent>
            </Navbar>
            <Card className="m-4">
                <CardBody>
                    {menuItems.find((item) => item.key === current)?.component}
                </CardBody>
            </Card>
        </div>
    );
};

export default App;
