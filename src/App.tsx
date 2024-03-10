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
  Button,
} from "@nextui-org/react";
import AiLogo from '@/components/AiLogo';
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
  const [current, setCurrent] = useState("/");

  return (
    <div className="app">
      <Router>
        <Navbar onChange={(e => console.log(e))}>
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
        </Navbar>
        <Routes>
          <Route path="/" element={<Watermark />} />
          <Route path="/border" element={<BorderWatermark />} />
          <Route path="/puzzle" element={<Puzzle />} />
          <Route path="/lottery" element={<Lottery />} />
          <Route path="/change" element={<ChangeColor />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
