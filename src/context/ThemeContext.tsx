import { FC, createContext, ReactNode } from "react";
import { useDark } from "@/hooks";

// 定义 ThemeContext 类型和默认值
const ThemeContext = createContext<{
    isDark: boolean;
    toggleTheme: () => void; // 修改类型定义以接受可选参数
}>({
    isDark: false,
    toggleTheme: () => {},
});

const ThemeProvider: FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [isDark, toggleTheme] = useDark(); // 假设 useDark 钩子返回正确的类型

    // 如果 useDark 返回的 toggleTheme 不是一个接受参数的函数，则这里不需要改变
    // 但根据错误提示，我们可能需要修改 useDark 钩子或此处的类型定义

    // useEffect(() => {
    //     document.body.classList.add(isDark ? "dark" : "light");
    // }, [isDark]);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
export {ThemeProvider, ThemeContext};
