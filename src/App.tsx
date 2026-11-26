import React, { Component, Suspense, useEffect, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context";
import "./App.css";
import { Toaster } from "sonner";
import { loadLanding, routeLoaders } from "./app/route-loading";
import FloatingButtons from "./app/FloatingButtons";
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

const routeItems = routeLoaders.map((item) => ({
    ...item,
    Page: lazyWithImportRecovery(item.component, `route:${item.id}`),
}));

const Landing = lazyWithImportRecovery(
    loadLanding,
    "route:landing"
);

const SPLIT_ISOLATION_ROUTE = /^\/split(?:\/|\.html|\/index\.html)?$/;
const SPLIT_ENTER_RELOAD_KEY = "split-coop-coep-reload";
const SPLIT_EXIT_RELOAD_KEY = "split-coop-coep-exit-reload";

const SplitIsolationGuard = () => {
    const location = useLocation();

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const isSplitRoute = SPLIT_ISOLATION_ROUTE.test(location.pathname);

        if (isSplitRoute) {
            if (window.crossOriginIsolated) {
                try {
                    window.sessionStorage.removeItem(SPLIT_ENTER_RELOAD_KEY);
                } catch { /* Isolation is already active; storage is optional. */ }
                return;
            }
            try {
                if (window.sessionStorage.getItem(SPLIT_ENTER_RELOAD_KEY) === "1") return;
                window.sessionStorage.setItem(SPLIT_ENTER_RELOAD_KEY, "1");
            } catch {
                // Without a reload marker, a browser that denies storage could loop.
                return;
            }
            // A document navigation applies the isolation headers. The worker
            // preserves these headers, so removing registrations is unnecessary.
            window.location.replace(window.location.href);
            return;
        }

        if (!window.crossOriginIsolated) {
            try {
                window.sessionStorage.removeItem(SPLIT_EXIT_RELOAD_KEY);
            } catch { /* Non-isolated mode is already active; storage is optional. */ }
            return;
        }

        try {
            if (window.sessionStorage.getItem(SPLIT_EXIT_RELOAD_KEY) === "1") return;
            window.sessionStorage.setItem(SPLIT_EXIT_RELOAD_KEY, "1");
        } catch {
            // Without a reload marker, a browser that denies storage could loop.
            return;
        }
        // Leaving /split via SPA navigation keeps the document's COEP header,
        // which blocks cross-origin scripts (such as AMap on /photo-exif).
        window.location.replace(window.location.href);
    }, [location.pathname]);

    return null;
};

type AppContentsProps = { initialPath?: string; InitialPage?: ComponentType<object> };

const RouteReady = ({ path, children }: { path: string; children: ReactNode }) => {
    useEffect(() => {
        // This effect is inside Suspense: it records actual route hydration,
        // separately from the earlier paint of its prerendered HTML.
        const name = `mytools:route-ready:${path}`;
        performance.clearMarks(name);
        performance.mark(name);
    }, [path]);
    return <>{children}</>;
};

// Shared by the browser and build-time rendering so hydration keeps the exact
// same providers, Suspense boundaries and useId paths.
export const AppContents = ({ initialPath, InitialPage }: AppContentsProps = {}) => {
    const LandingPage = initialPath === "/" && InitialPage ? InitialPage : Landing;
    return (
        <ThemeProvider>
            <div className="min-h-screen w-screen bg-background text-foreground">
                <SplitIsolationGuard />
                {/* <ChineseStyleNavbar /> */}
                <div
                    className="flex flex-col w-screen"
                    // style={{ height: "calc(100vh - 80px)" }}
                >
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <RouteErrorBoundary key="landing">
                                    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载页面...</div>}>
                                        <RouteReady path="/"><LandingPage /></RouteReady>
                                    </Suspense>
                                </RouteErrorBoundary>
                            }
                        />
                        {routeItems.map((item) => {
                            const Page = initialPath === item.url && InitialPage ? InitialPage : item.Page;
                            return (
                                <Route
                                    key={item.id}
                                    path={item.url}
                                    element={
                                        <RouteErrorBoundary key={item.id}>
                                            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载页面...</div>}>
                                                <RouteReady path={item.url}><Page /></RouteReady>
                                            </Suspense>
                                        </RouteErrorBoundary>
                                    }
                                />
                            );
                        })}
                        <Route path="*" element={
                            <main className="mx-auto max-w-lg p-8">
                                <h1 className="text-xl font-semibold">页面不存在</h1>
                                <Link to="/" className="mt-4 inline-block underline">返回应用库</Link>
                            </main>
                        } />
                    </Routes>
                </div>
                <FloatingButtons />
                <Toaster position="top-center" richColors />
            </div>
        </ThemeProvider>
    );
};

const App = () => <BrowserRouter><AppContents /></BrowserRouter>;

export default App;
