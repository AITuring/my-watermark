// Opt-in, local-only measurements for verifying deployed pages. No telemetry.
if (new URLSearchParams(location.search).get("perf") === "1") {
    const metrics = { fcp: null, lcp: null, ready: null, lcpElement: null, errors: 0 };
    const observers = [];
    const publish = () => {
        const navigation = performance.getEntriesByType("navigation")[0];
        document.documentElement.dataset.loadMetrics = JSON.stringify({
            ...metrics,
            ttfb: navigation ? Math.round(navigation.responseStart) : null,
            responseEnd: navigation ? Math.round(navigation.responseEnd) : null,
            worker: Boolean(navigator.serviceWorker?.controller),
            isolated: window.crossOriginIsolated,
        });
        document.documentElement.dataset.routeReady = String(metrics.ready !== null);
    };
    const observe = (type, receive) => {
        if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes.includes(type)) return;
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) receive(entry);
            publish();
        });
        observer.observe({ type, buffered: true });
        observers.push(observer);
    };
    observe("paint", (entry) => {
        if (entry.name === "first-contentful-paint") metrics.fcp = Math.round(entry.startTime);
    });
    observe("largest-contentful-paint", (entry) => {
        metrics.lcp = Math.round(entry.startTime);
        metrics.lcpElement = entry.element?.tagName || null;
    });
    observe("mark", (entry) => {
        if (entry.name.startsWith("mytools:route-ready:")) metrics.ready = Math.round(entry.startTime);
    });
    addEventListener("error", () => { metrics.errors += 1; publish(); });
    addEventListener("unhandledrejection", () => { metrics.errors += 1; publish(); });
    addEventListener("load", publish, { once: true });
    addEventListener("pagehide", () => observers.forEach(observer => observer.disconnect()), { once: true });
    publish();
}
