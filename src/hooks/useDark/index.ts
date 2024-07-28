import { useEffect, useState } from "react";

const useDark = (): [boolean, () => void] => {
    // 从localStorage获取主题，如果没有设置，则默认为'light'
    const storedTheme = localStorage.getItem('theme') || 'light';
    const [isDark, setIsDark] = useState<boolean>(storedTheme === 'dark');

    useEffect(() => {
        const time = new Date().getHours();
        if (time >= 18 || time < 6) {
            setIsDark(true);
            localStorage.setItem('theme', 'dark');
        } else {
            setIsDark(false);
            localStorage.setItem('theme', 'light');
        }
        // 应用主题到document.body
        document.body.classList.remove(isDark ? 'light' : 'dark');
        document.body.classList.add(isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggleTheme = () => {
        // 切换主题
        const newTheme = isDark ? 'light' : 'dark';
        setIsDark(value => !value);
        // 存储新主题到localStorage
        localStorage.setItem('theme', newTheme);
        // 应用新主题到document.body
        document.body.classList.toggle('dark');
    };

    return [isDark, toggleTheme];
};

export default useDark;
