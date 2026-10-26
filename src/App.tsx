import React, { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context";
import "./App.css";
import { Toaster } from "sonner";
import { appCatalog } from "./app/catalog";
import FloatingButtons from "./app/FloatingButtons";
import Landing from "./pages/landing";
import {
    isRecoverableDynamicImportError,
    lazyWithImportRecovery,
    recoverFromStaleDeployment,
} from "./utils/import-recovery";

type RouteErrorBoundaryProps = { children: ReactNode };
type RouteErrorBoundaryState = { error: Error | null };

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
    state: RouteErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("页面加载失败", error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        const staleDeployment = isRecoverableDynamicImportError(this.state.error);
        return (
            <div className="flex min-h-[50vh] items-center justify-center p-6">
                <div className="max-w-md rounded-xl border border-border/60 bg-background p-6 text-center shadow-sm">
                    <h1 className="text-base font-semibold">
                        {staleDeployment ? "页面资源已更新" : "页面加载失败"}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {staleDeployment
                            ? "当前浏览器缓存了旧版本资源，刷新后会重新加载最新页面。"
                            : "页面暂时无法打开，请刷新后重试。"}
                    </p>
                    <button
                        type="button"
                        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                        onClick={() => void recoverFromStaleDeployment(true)}
                    >
                        刷新页面
                    </button>
                </div>
            </div>
        );
    }
}

const routeItems = appCatalog.map((item) => ({
    ...item,
    Page: lazyWithImportRecovery(item.component, `route:${item.id}`),
}));

const App = () => {
    return (
        <ThemeProvider>
            <div className="min-h-screen w-screen bg-background text-foreground">
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
                                        <RouteErrorBoundary>
                                            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载页面...</div>}>
                                                <item.Page />
                                            </Suspense>
                                        </RouteErrorBoundary>
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
