import { useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
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
        <NavigationMenu current={current} setCurrent={setCurrent} />
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
