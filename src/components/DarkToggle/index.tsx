import { ToggleSwitch } from "../animata";
import useDarkMode from "use-dark-mode";

const DarkToggle = () => {
    const darkMode = useDarkMode(false);
    return (
        <ToggleSwitch
            defaultChecked={darkMode.value}
            onChange={(e) =>{
                return e ? darkMode.enable() : darkMode.disable()
            }
            }
        />
    );
};

export default DarkToggle;
