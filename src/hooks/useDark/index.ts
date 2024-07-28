import { useEffect, useState } from "react";

const useDark = (): [boolean, () => void] => {
    // 从localStorage获取主题，如果没有设置，则默认为'light'
    const storedTheme = localStorage.getItem("theme") || "light";
    const [isDark, setIsDark] = useState<boolean>(storedTheme === "dark");


    useEffect(() => {
        // 根据当前时间自动切换主题
        const time = new Date().getHours();
        if (time >= 18 || time < 6) {
            setIsDark(true);
            localStorage.setItem("theme", "dark");
            document.body.classList.add("dark");
        } else {
            setIsDark(false);
            localStorage.setItem("theme", "light");
            document.body.classList.add("light");
        }
    }, []);

    const toggleTheme = () => {
        // 切换主题
        const newTheme = isDark ? "light" : "dark";
        setIsDark((value) => !value);
        // 存储新主题到localStorage
        localStorage.setItem("theme", newTheme);
        // 应用新主题到document.body
        document.body.classList.toggle("dark");
    };

    return [isDark, toggleTheme];
};

export default useDark;
