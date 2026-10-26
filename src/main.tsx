import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
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
