import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from '@vercel/analytics';
import {NextUIProvider} from '@nextui-org/react'
import App from "./App";
import "./index.css";

inject();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NextUIProvider>
      <App />
    </NextUIProvider>
  </React.StrictMode>
);
