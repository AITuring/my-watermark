import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import { registerAppServiceWorker } from "./utils/register-service-worker";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD) inject();
window.global = globalThis;

// Route imports recover in lazyWithImportRecovery. Do not suppress Vite's
// rejection globally: a failed speculative preload must not reload this page.

const root = document.getElementById("root") as HTMLElement;
const app = (
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

if (root.dataset.prerendered === "true") {
    // Keep the already-visible page while its lazy route hydrates. React can
    // replay interactions made inside a still-dehydrated Suspense boundary.
    ReactDOM.hydrateRoot(root, app);
} else {
    ReactDOM.createRoot(root).render(app);
}

if (import.meta.env.PROD) registerAppServiceWorker();
