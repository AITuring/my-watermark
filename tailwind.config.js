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
            }
        },
    },
    darkMode: "selector",
    plugins: [require("tailwindcss-animate")],
};
