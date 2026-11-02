import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD) inject();
window.global = globalThis;

// Route imports recover in lazyWithImportRecovery. Do not suppress Vite's
// rejection globally: a failed speculative preload must not reload this page.

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        window.setTimeout(() => {
            registerSW({ immediate: true });
        }, 5000);
    });
}
