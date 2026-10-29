import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { recoverFromStaleDeployment } from "./utils/import-recovery";

inject();
window.global = globalThis;

window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void recoverFromStaleDeployment();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        window.setTimeout(() => {
            registerSW({ immediate: true });
        }, 5000);
    });
}
