import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/cache-import.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { cacheImport } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("prefetch and navigation share one import, including subsequent visits", async () => {
    let calls = 0;
    let complete;
    const module = { default: () => null };
    const load = cacheImport(() => {
        calls += 1;
        return new Promise((resolve) => { complete = resolve; });
    });
    const prefetch = load();
    const navigation = load();
    assert.equal(prefetch, navigation);
    await Promise.resolve();
    assert.equal(calls, 1);
    complete(module);
    assert.equal(await navigation, module);
    assert.equal(await load(), module);
    assert.equal(calls, 1);
});

test("a failed speculative import can be retried by navigation", async () => {
    let calls = 0;
    const module = { default: () => null };
    const load = cacheImport(async () => {
        if (++calls === 1) throw new Error("network unavailable");
        return module;
    });
    await assert.rejects(load(), /network unavailable/);
    assert.equal(await load(), module);
    assert.equal(calls, 2);
});

test("a synchronous loader error also releases the failed import", async () => {
    let calls = 0;
    const load = cacheImport(() => {
        if (++calls === 1) throw new Error("loader failed");
        return Promise.resolve("ready");
    });
    await assert.rejects(load(), /loader failed/);
    assert.equal(await load(), "ready");
});

const recoverySource = await readFile(new URL("../src/utils/import-recovery.ts", import.meta.url), "utf8");
const recoveryCompiled = ts.transpileModule(recoverySource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function recoveryEnvironment(storage = new Map()) {
    const counts = { reloads: 0, unregisters: 0, cacheDeletes: 0, retryTimers: 0 };
    let resolveReload;
    const reloaded = new Promise((resolve) => { resolveReload = resolve; });
    const browserWindow = new EventTarget();
    const cacheStorage = {
        keys: async () => ["old-page-assets"],
        delete: async () => { counts.cacheDeletes += 1; return true; },
    };
    Object.assign(browserWindow, {
        caches: cacheStorage,
        location: { reload: () => { counts.reloads += 1; resolveReload(); } },
        setTimeout: (callback) => { counts.retryTimers += 1; queueMicrotask(callback); return counts.retryTimers; },
    });
    const exports = {};
    vm.runInNewContext(recoveryCompiled, {
        exports,
        require: (name) => {
            assert.equal(name, "react");
            return { lazy: (importer) => importer };
        },
        Error,
        console,
        window: browserWindow,
        navigator: {
            serviceWorker: {
                getRegistrations: async () => [{ unregister: async () => { counts.unregisters += 1; return true; } }],
            },
        },
        caches: cacheStorage,
        sessionStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key),
        },
    });
    return {
        ...exports, counts, reloaded, storage,
        preloadError(error) {
            const event = new Event("vite:preloadError", { cancelable: true });
            event.payload = error;
            browserWindow.dispatchEvent(event);
            return event;
        },
    };
}

test("a speculative CSS failure stays quiet and blocks a cached route until recovery", { timeout: 1000 }, async () => {
    const environment = recoveryEnvironment();
    const cachedRoute = cacheImport(async () => ({ default: () => null }));
    await cachedRoute();
    const error = new Error("Unable to preload CSS for /assets/shared-deadbeef.css");
    const speculativeRoute = cacheImport(async () => {
        const event = environment.preloadError(error);
        assert.equal(event.defaultPrevented, false, "Vite must still reject the failed import");
        throw error;
    });
    await assert.rejects(speculativeRoute(), error);
    assert.deepEqual(environment.counts, { reloads: 0, unregisters: 0, cacheDeletes: 0, retryTimers: 0 });

    let foregroundCalls = 0;
    let rendered = false;
    void environment.importWithRecovery(() => {
        foregroundCalls += 1;
        return cachedRoute();
    }, "route:cached").then(() => { rendered = true; });
    await environment.reloaded;
    assert.equal(foregroundCalls, 0, "a cached JS module must not hide the missing shared stylesheet");
    assert.equal(rendered, false);
    assert.deepEqual(environment.counts, { reloads: 1, unregisters: 1, cacheDeletes: 1, retryTimers: 0 });
});

test("a stylesheet failing during navigation prevents rendering the resolved module", { timeout: 1000 }, async () => {
    const environment = recoveryEnvironment();
    let finishImport;
    let rendered = false;
    void environment.importWithRecovery(() => new Promise((resolve) => { finishImport = resolve; }), "route:pending")
        .then(() => { rendered = true; });
    environment.preloadError(new Error("Unable to preload CSS for /assets/page-deadbeef.css"));
    finishImport({ default: () => null });
    await environment.reloaded;
    assert.equal(rendered, false);
    assert.equal(environment.counts.retryTimers, 0);
    assert.equal(environment.counts.reloads, 1);
});

test("a foreground CSS failure reloads without retrying Vite's poisoned stylesheet entry", { timeout: 1000 }, async () => {
    const environment = recoveryEnvironment();
    let calls = 0;
    void environment.importWithRecovery(async () => {
        calls += 1;
        if (calls === 1) throw new Error("Unable to preload CSS for /assets/page-deadbeef.css");
        return { default: () => null }; // Vite would skip the failed stylesheet on this retry.
    }, "route:css");
    await environment.reloaded;
    assert.equal(calls, 1);
    assert.equal(environment.counts.retryTimers, 0);
    assert.equal(environment.counts.reloads, 1);
});

test("a persistent CSS failure after reload reaches the boundary without another reload", { timeout: 1000 }, async () => {
    const beforeReload = recoveryEnvironment();
    const error = new Error("Unable to preload CSS for /assets/page-deadbeef.css");
    beforeReload.preloadError(error);
    void beforeReload.importWithRecovery(async () => ({ default: () => null }), "route:css");
    await beforeReload.reloaded;

    const afterReload = recoveryEnvironment(beforeReload.storage);
    await assert.rejects(afterReload.importWithRecovery(async () => { throw error; }, "route:css"), error);
    afterReload.preloadError(error);
    await assert.rejects(afterReload.importWithRecovery(async () => ({ default: () => null }), "route:other"), error);
    assert.equal(afterReload.counts.reloads, 0);
    assert.equal(afterReload.counts.retryTimers, 0);
});
