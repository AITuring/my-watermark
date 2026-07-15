import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context";
import "./App.css";
import { Toaster } from "sonner";
import { appCatalog } from "./app-catalog";
import FloatingButtons from "./app/FloatingButtons";
import Landing from "./pages/landing";

const routeItems = appCatalog.map((item) => ({
    ...item,
    Page: lazy(item.component),
}));

const App = () => {
    return (
        <ThemeProvider>
            <div className="w-screen min-h-screen text-gray-800 bg-transparent dark:text-white">
                <BrowserRouter>
                    {/* <ChineseStyleNavbar /> */}
                    <div
                        className="flex flex-col w-screen"
                        // style={{ height: "calc(100vh - 80px)" }}
                    >
                        <Routes>
                            <Route path="/" element={<Landing />} />
                            {routeItems.map((item) => (
                                <Route
                                    key={item.id}
                                    path={item.url}
                                    element={
                                        <Suspense fallback={<div className="p-6 text-sm text-gray-500">正在加载页面...</div>}>
                                            <item.Page />
                                        </Suspense>
                                    }
                                />
                            ))}
                        </Routes>
                    </div>
                    <FloatingButtons />
                    <Toaster position="top-center" richColors />
                </BrowserRouter>
            </div>
        </ThemeProvider>
    );
};

export default App;
