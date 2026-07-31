import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RECOVERABLE_DYNAMIC_IMPORT_PATTERNS = [
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /error loading dynamically imported module/i,
    /ChunkLoadError/i,
    /Loading chunk [\d]+ failed/i,
];

const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY_MS = 300;

function isRecoverableDynamicImportError(error: unknown): boolean {
    const message =
        error instanceof Error
            ? `${error.name} ${error.message}`
            : String(error ?? "");

    return RECOVERABLE_DYNAMIC_IMPORT_PATTERNS.some((pattern) =>
        pattern.test(message)
    );
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
    const hasReloaded = sessionStorage.getItem(reloadFlagKey) === "1";
    if (!hasReloaded) {
        sessionStorage.setItem(reloadFlagKey, "1");
        window.location.reload();
        return new Promise<T>(() => {});
    }

    sessionStorage.removeItem(reloadFlagKey);
    throw lastError;
}

export function lazyWithImportRecovery<T extends ComponentType<object>>(
    importer: () => Promise<{ default: T }>,
    key: string
): LazyExoticComponent<T> {
    return lazy(() => importWithRecovery(importer, key));
}
