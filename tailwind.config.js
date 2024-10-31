const colors = require('tailwindcss/colors');

module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                foreground: "hsl(var(--foreground))",
                headground: "#2A1261",
                primary: colors.sky,
                secondary: colors.teal,
                default: colors.slate,
                accent: colors.amber,
                success: colors.emerald,
                danger: colors.red,
            },
            keyframes: {
                "marquee-x": {
                    from: { transform: "translateX(0)" },
                    to: { transform: "translateX(calc(-100% - var(--gap)))" },
                },
                "marquee-y": {
                    from: { transform: "translateY(0)" },
                    to: { transform: "translateY(calc(-100% - var(--gap)))" },
                },
            },
            animation: {
                "marquee-horizontal": "marquee-x var(--duration) infinite linear",
                "marquee-vertical": "marquee-y var(--duration) linear infinite",
            },
        },
    },
    darkMode: "selector",
    plugins: [require("tailwindcss-animate")],
};
