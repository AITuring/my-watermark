import { useContext } from "react";
import { ToggleSwitch } from "../animata";
import { ThemeContext } from "@/context";

const DarkToggle = () => {
    const { isDark, toggleTheme } = useContext(ThemeContext);
    return (
        <ToggleSwitch
            defaultChecked={isDark}
            onChange={toggleTheme}
        />
    );
};

export default DarkToggle;
