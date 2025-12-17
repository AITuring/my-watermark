import { useEffect, useState } from "react";

const useDark = (): [boolean, () => void] => {
    // 从localStorage获取主题，如果没有设置，则默认为'light'
    const [isDark, setIsDark] = useState<boolean>(() => {
        const storedTheme = localStorage.getItem("theme");
        if (storedTheme) {
            return storedTheme === "dark";
        }
        const time = new Date().getHours();
        return time >= 18 || time < 6;
    });

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            root.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    }, [isDark]);

    const toggleTheme = () => {
        setIsDark((prev) => !prev);
    };

    return [isDark, toggleTheme];
};

export default useDark;
