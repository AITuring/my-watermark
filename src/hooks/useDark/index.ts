import { useEffect, useState, useCallback } from "react";

const getScheduledIsDark = (now: Date) => {
    const minutes = now.getHours() * 60 + now.getMinutes();
    // 7:30 = 450 minutes, 19:30 = 1170 minutes
    // Light range: 450 <= minutes < 1170
    // If within light range, return false (not dark)
    return !(minutes >= 450 && minutes < 1170);
};

const getLastSwitchPoint = (now: Date) => {
    // Generate switch points for today and yesterday to cover all cases
    const points = [
        new Date(now).setHours(7, 30, 0, 0),
        new Date(now).setHours(19, 30, 0, 0),
        new Date(now.getTime() - 86400000).setHours(7, 30, 0, 0),
        new Date(now.getTime() - 86400000).setHours(19, 30, 0, 0),
    ];
    // Return the latest switch point that has already passed
    return Math.max(...points.filter((t) => t <= now.getTime()));
};

const useDark = (): [boolean, () => void] => {
    const calculateState = useCallback(() => {
        const now = new Date();
        const lastSwitchTime = getLastSwitchPoint(now);
        const scheduledIsDark = getScheduledIsDark(now);

        const storedTheme = localStorage.getItem("theme_preference");
        const storedTimeStr = localStorage.getItem("theme_preference_time");

        if (storedTheme && storedTimeStr) {
            const storedTime = parseInt(storedTimeStr, 10);
            // Only respect manual setting if it was made AFTER the last auto-switch point
            if (storedTime > lastSwitchTime) {
                return storedTheme === "dark";
            }
        }
        return scheduledIsDark;
    }, []);

    const [isDark, setIsDark] = useState<boolean>(calculateState);

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [isDark]);

    // Check for updates every minute to handle auto-switching
    useEffect(() => {
        const checkTheme = () => {
            const newState = calculateState();
            setIsDark((prev) => {
                if (prev !== newState) return newState;
                return prev;
            });
        };

        const interval = setInterval(checkTheme, 60000); // Check every minute

        // Check when window gains focus (user comes back to tab)
        window.addEventListener("focus", checkTheme);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", checkTheme);
        };
    }, [calculateState]);

    const toggleTheme = () => {
        setIsDark((prev) => {
            const newIsDark = !prev;
            localStorage.setItem("theme_preference", newIsDark ? "dark" : "light");
            localStorage.setItem("theme_preference_time", Date.now().toString());
            return newIsDark;
        });
    };

    return [isDark, toggleTheme];
};

export default useDark;
