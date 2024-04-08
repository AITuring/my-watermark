import { useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Switch,
} from "@nextui-org/react";
import { Sun, MoonStar } from "lucide-react";
import useDarkMode from "use-dark-mode";
import AiLogo from "@/components/AiLogo";
import type { MenuProps } from "antd";
import { Menu } from "antd";
import {
  AppstoreOutlined,
  MailOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import BorderWatermark from "./BorderWatermark";
import Lottery from "./Lottery";
import ChangeColor from "./ChangeColor";
import BlackHole from "./components/BlackHole";
import "./App.css";

const items: MenuProps["items"] = [
  {
    label: "水印添加",
    key: "/",
    icon: <MailOutlined />,
  },
  {
    label: "大图拼接",
    key: "/puzzle",
    icon: <AppstoreOutlined />,
  },
  {
    label: "微博抽奖",
    key: "/lottery",
    icon: <SettingOutlined />,
  },
  {
    label: "图片颜色调整",
    key: "/change",
    icon: <SettingOutlined />,
  },
];

const NavigationMenu = ({ current, setCurrent }) => {
  const navigate = useNavigate();

  const onClick = (e) => {
    setCurrent(e.key);
    navigate(e.key);
  };

  return (
    <Menu
      onClick={onClick}
      selectedKeys={[current]}
      mode="horizontal"
      items={items}
    />
  );
};

const App = () => {
  const darkMode = useDarkMode(false);
  const [current, setCurrent] = useState("/");

  return (
    <div
      className={`${
        darkMode.value ? "dark" : ""
      } text-foreground bg-background w-screen h-screen`}
    >
      <Router>
        <Navbar onChange={(e) => console.log(e)}>
          <NavbarBrand>
            <AiLogo />
            <p className="font-bold text-inherit">AITuring</p>
          </NavbarBrand>
          <NavbarContent className="hidden sm:flex gap-4" justify="center">
            <NavbarItem>
              <Link color="foreground" href="/">
                水印添加
              </Link>
            </NavbarItem>
            <NavbarItem isActive>
              <Link href="/puzzle" aria-current="page">
                大图拼接
              </Link>
            </NavbarItem>
            <NavbarItem>
              <Link color="foreground" href="/lottery">
                微博抽奖
              </Link>
            </NavbarItem>
            <NavbarItem>
              <Link color="foreground" href="/change">
                图片颜色调整
              </Link>
            </NavbarItem>
          </NavbarContent>
          <NavbarContent className="flex gap-4" justify="end">
            <NavbarItem>
              <Switch
                defaultSelected
                size="lg"
                // color="secondary"
                startContent={<Sun />}
                endContent={<MoonStar />}
                onChange={e => e.target.checked ? darkMode.disable() : darkMode.enable()}
              >
              </Switch>
            </NavbarItem>
          </NavbarContent>
        </Navbar>
        <Routes>
          <Route path="/" element={<Watermark />} />
          <Route path="/border" element={<BorderWatermark />} />
          <Route path="/puzzle" element={<Puzzle />} />
          <Route path="/lottery" element={<Lottery />} />
          <Route path="/change" element={<ChangeColor />} />
          <Route path="/hole" element={<BlackHole />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
