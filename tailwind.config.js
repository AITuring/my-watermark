const { nextui } = require("@nextui-org/react");

module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                foreground: "hsl(var(--foreground))",
                headground: "#2A1261"
            }
        },
    },
    darkMode: "class",
    plugins: [nextui(), require("tailwindcss-animate")],
};
