import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RECOVERABLE_DYNAMIC_IMPORT_PATTERNS = [
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /error loading dynamically imported module/i,
    /Expected a JavaScript-or-Wasm module script/i,
    /MIME type of ["']text\/html["']/i,
    /ChunkLoadError/i,
    /Loading chunk [\d]+ failed/i,
];

const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY_MS = 300;

export function isRecoverableDynamicImportError(error: unknown): boolean {
    const message =
        error instanceof Error
            ? `${error.name} ${error.message}`
            : String(error ?? "");

    return RECOVERABLE_DYNAMIC_IMPORT_PATTERNS.some((pattern) =>
        pattern.test(message)
    );
}

const GLOBAL_RELOAD_FLAG_KEY = getReloadFlagKey("global");

async function clearStaleApplicationState(): Promise<void> {
    try {
        if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        }
        if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
    } catch (error) {
        console.warn("清理旧页面资源失败，将继续刷新页面", error);
    }
}

export async function recoverFromStaleDeployment(force = false): Promise<boolean> {
    if (!force && sessionStorage.getItem(GLOBAL_RELOAD_FLAG_KEY) === "1") {
        return false;
    }

    sessionStorage.setItem(GLOBAL_RELOAD_FLAG_KEY, "1");
    await clearStaleApplicationState();
    window.location.reload();
    return true;
}

function getReloadFlagKey(key: string): string {
    return `dynamic-import-reload:${key}`;
}

async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function importWithRecovery<T>(
    importer: () => Promise<T>,
    key: string,
    retryCount = DEFAULT_RETRY_COUNT
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        try {
            const module = await importer();
            sessionStorage.removeItem(getReloadFlagKey(key));
            sessionStorage.removeItem(GLOBAL_RELOAD_FLAG_KEY);
            return module;
        } catch (error) {
            lastError = error;

            const isLastAttempt = attempt === retryCount;
            if (!isRecoverableDynamicImportError(error) || isLastAttempt) {
                break;
            }

            await wait(DEFAULT_RETRY_DELAY_MS);
        }
    }

    if (!isRecoverableDynamicImportError(lastError)) {
        throw lastError;
    }

    const reloadFlagKey = getReloadFlagKey(key);
    const hasReloaded = sessionStorage.getItem(reloadFlagKey) === "1" ||
        sessionStorage.getItem(GLOBAL_RELOAD_FLAG_KEY) === "1";
    if (!hasReloaded) {
        sessionStorage.setItem(reloadFlagKey, "1");
        await recoverFromStaleDeployment();
        return new Promise<T>(() => {});
    }

    sessionStorage.removeItem(reloadFlagKey);
    sessionStorage.removeItem(GLOBAL_RELOAD_FLAG_KEY);
    throw lastError;
}

export function lazyWithImportRecovery<T extends ComponentType<object>>(
    importer: () => Promise<{ default: T }>,
    key: string
): LazyExoticComponent<T> {
    return lazy(() => importWithRecovery(importer, key));
}
