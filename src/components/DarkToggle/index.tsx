import { useContext } from "react";
import { ThemeContext } from "@/context";

const DarkToggle = () => {
    const { isDark, toggleTheme } = useContext(ThemeContext);
    return (
        <label className="flex cursor-pointer select-none items-center">
            <span className="relative">
                <input
                    type="checkbox"
                    checked={isDark}
                    onChange={toggleTheme}
                    aria-label="深色模式"
                    className="peer sr-only"
                />
                <span
                    className={`block h-8 w-14 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-stone-500 peer-focus-visible:ring-offset-2 ${
                        isDark ? "bg-indigo-500" : "bg-pink-500"
                    }`}
                />
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={`absolute top-2 h-4 w-4 text-white ${isDark ? "left-1.5" : "right-1.5"}`}
                >
                    {isDark ? (
                        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
                    ) : (
                        <>
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42M6.35 17.65l-1.42 1.42" />
                        </>
                    )}
                </svg>
                <span
                    className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-gray-200 transition-transform motion-reduce:transition-none ${
                        isDark ? "translate-x-6" : ""
                    }`}
                />
            </span>
        </label>
    );
};

export default DarkToggle;
