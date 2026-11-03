/** Update the worker itself immediately, without a bulk install or page reload. */
export function registerAppServiceWorker(): void {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
    }).then((registration) => {
        let lastCheck = Date.now();
        const checkForUpdate = () => {
            if (document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastCheck < 5 * 60 * 1000) return;
            lastCheck = Date.now();
            void registration.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", checkForUpdate);
        window.addEventListener("online", checkForUpdate);
    }).catch((error) => {
        console.warn("离线缓存暂时不可用，页面会继续在线加载", error);
    });
}
