
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
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
    plugins: [require("tailwindcss-animate")],
};
