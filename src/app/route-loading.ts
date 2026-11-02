import { appCatalog, type AppCatalogItem } from "./catalog";
import { cacheImport } from "../utils/cache-import";

export const loadLanding = cacheImport(() => import("../pages/landing"));
export const routeLoaders = appCatalog.map((item) => ({
    ...item,
    component: cacheImport(item.component),
}));

const loadersByPath = new Map<string, AppCatalogItem["component"]>([
    ["/", loadLanding],
    ...routeLoaders.map((item) => [item.url, item.component] as const),
]);

/** Only warm the page the user points to, never all tools in the catalog. */
export function preloadRoute(pathname: string): void {
    const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
    // A speculative fetch must not refresh the current page on failure.
    // Real navigation uses importWithRecovery and can retry the failed import.
    void loadersByPath.get(path)?.().catch(() => {});
}
