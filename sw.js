/*
 * A deployment-independent worker. Installing an update must not download the
 * entire app, cache an old HTML entry, or reload a page with unsaved work.
 */
const PAGE_CACHE = "mytools-pages-v1";
const ASSET_CACHE = "page-assets-cache";
const IMAGE_CACHE = "image-assets-cache";
const HASHED_ASSET = /^\/assets\/.+-[\w-]{8,}\.(?:js|css)$/;
const IMAGE_FILE = /\.(?:png|jpe?g|webp|avif|svg|ico)$/i;
const MAX_RESOURCE_BYTES = 10 * 1024 * 1024;
const NAVIGATION_WAIT_MS = 900;

function pageKey(url) {
    return new URL(url.pathname, self.location.origin).href;
}

function splitResponse(response, url) {
    // Navigation redirects are opaque to the worker (status 0); the browser
    // must follow them, and they cannot be reconstructed with new Response.
    if (response.type === "opaqueredirect" || response.status === 0 || !/^\/split(?:\/|\.html$|$)/.test(url.pathname)) return response;
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

function validResponse(response, kind) {
    if (!response || response.status !== 200 || response.redirected) return false;
    const type = (response.headers.get("Content-Type") || "").split(";", 1)[0].trim();
    if (kind === "html") return /^text\/html$/i.test(type);
    if (kind === "css") return /^text\/css$/i.test(type);
    if (kind === "js") return /^(?:text|application)\/(?:x-)?(?:javascript|ecmascript)$/i.test(type);
    return /^image\//i.test(type);
}

async function trimCache(cache, limit) {
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((entry) => cache.delete(entry)));
}

async function storeResponse(cacheName, key, response, limit) {
    let boundedResponse;
    try {
        const declaredSize = Number(response.headers.get("Content-Length"));
        if (declaredSize > MAX_RESOURCE_BYTES || !response.body || typeof TransformStream === "undefined") {
            response.body?.cancel().catch(() => {});
            return;
        }
        const cache = await caches.open(cacheName);
        // CDN responses often omit Content-Length. Bound the actual streamed
        // body too, without buffering a large image before returning it.
        let received = 0;
        const boundedBody = response.body.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                received += chunk.byteLength;
                if (received > MAX_RESOURCE_BYTES) throw new Error("Resource exceeds offline cache limit");
                controller.enqueue(chunk);
            },
        }));
        boundedResponse = new Response(boundedBody, { headers: response.headers });
        await cache.put(key, boundedResponse);
        await trimCache(cache, limit);
    } catch {
        // Storage restrictions or quota must never prevent the page loading.
        (boundedResponse || response).body?.cancel().catch(() => {});
    }
}

async function cachedResponse(cacheName, key, kind) {
    try {
        const cache = await caches.open(cacheName);
        const response = await cache.match(key);
        if (validResponse(response, kind)) return response;
        // The previous worker could cache an HTTP 200 SPA fallback as code.
        if (response) await cache.delete(key);
        return undefined;
    } catch {
        return undefined;
    }
}

async function completeHtmlBody(response) {
    if (!response.body) return true;
    const copy = response.clone();
    if (Number(copy.headers.get("Content-Length")) > MAX_RESOURCE_BYTES) {
        copy.body.cancel().catch(() => {});
        return false;
    }
    const reader = copy.body.getReader();
    let received = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) return true;
            received += value.byteLength;
            if (received > MAX_RESOURCE_BYTES) {
                reader.cancel().catch(() => {});
                return false;
            }
        }
    } catch {
        return false;
    } finally {
        reader.releaseLock();
    }
}

async function navigation(event, url) {
    const key = pageKey(url);
    // Prefer current HTML, but avoid holding a previously visited page behind
    // a stalled connection or slow HTML body. A timeout does not abort the
    // background refresh, and first visits retain the network's streaming body.
    const network = fetch(event.request, { cache: "no-cache" });
    const cached = cachedResponse(PAGE_CACHE, key, "html");
    event.waitUntil(network.then(async (response) => {
        if (validResponse(response, "html")) {
            await storeResponse(PAGE_CACHE, key, response.clone(), 40);
        }
    }, () => {}));
    let timer;
    let returnedCache = false;
    const deadline = new Promise((resolve) => { timer = setTimeout(resolve, NAVIGATION_WAIT_MS); });
    try {
        const current = network.then(async (response) => {
            const fallback = await cached;
            if (fallback && !returnedCache && validResponse(response, "html")) {
                // Headers alone do not mean the page is ready to display.
                // Drain a bounded clone, preserving the original response.
                if (!await completeHtmlBody(response)) return { response: fallback, fromCache: true };
            }
            return { response, fromCache: false };
        });
        const afterDeadline = Promise.all([cached, deadline]).then(([response]) =>
            response ? { response, fromCache: true } : current,
        );
        const result = await Promise.race([current, afterDeadline]);
        if (result.fromCache) {
            returnedCache = true;
            // Only the cache clone needs the late network body. No navigation
            // or automatic reload is triggered when fresh HTML arrives.
            event.waitUntil(network.then((response) => response.body?.cancel().catch(() => {}), () => {}));
        }
        return splitResponse(result.response, url);
    } catch {
        const fallback = await cached;
        if (fallback) return splitResponse(fallback, url);
        return splitResponse(new Response(
            '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>暂时无法连接</title><body style="font-family:system-ui;padding:3rem;line-height:1.7"><h1>暂时无法连接</h1><p>这个页面还没有离线副本。恢复网络后刷新即可继续。</p><a href="/">返回应用库</a></body></html>',
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
        ), url);
    } finally {
        clearTimeout(timer);
    }
}

async function legacyCacheNames() {
    return (await caches.keys()).filter((name) =>
        name.startsWith("workbox-precache-") && name.endsWith(self.registration.scope),
    );
}

async function legacyCode(request, kind) {
    try {
        for (const name of await legacyCacheNames()) {
            const response = await (await caches.open(name)).match(request, { ignoreSearch: true });
            if (validResponse(response, kind)) return response;
        }
    } catch {
        // The network remains available when cache storage is restricted.
    }
    return undefined;
}

async function staticResource(event, cacheName, limit, kind) {
    const cached = await cachedResponse(cacheName, event.request, kind);
    if (cached) return cached;
    if (kind === "js" || kind === "css") {
        // If quota prevented migration, old open tabs can still load modules
        // from the retained Workbox cache, even after deployment removes them.
        const legacy = await legacyCode(event.request, kind);
        if (legacy) return legacy;
    }
    const response = await fetch(event.request);
    if (validResponse(response, kind)) {
        event.waitUntil(storeResponse(cacheName, event.request, response.clone(), limit));
    }
    return response;
}

async function migrateLegacyPrecache() {
    // Retain hashed code needed by tabs already open on the old deployment, but
    // never copy its HTML. User files, IndexedDB and localStorage are untouched.
    try {
        const legacyNames = await legacyCacheNames();
        const target = await caches.open(ASSET_CACHE);
        for (const name of legacyNames) {
            const legacy = await caches.open(name);
            for (const request of await legacy.keys()) {
                const url = new URL(request.url);
                if (url.origin !== self.location.origin || !HASHED_ASSET.test(url.pathname)) continue;
                const key = new URL(url.pathname, url.origin).href;
                const kind = url.pathname.endsWith(".css") ? "css" : "js";
                if (validResponse(await target.match(key), kind)) continue;
                const response = await legacy.match(request);
                if (validResponse(response, kind)) {
                    await target.put(key, response);
                }
            }
            await caches.delete(name);
        }
    } catch {
        // An unavailable cache must not hold the new worker in the waiting state.
    }
}

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        await migrateLegacyPrecache();
        // Also bound runtime caches retained from the previous worker.
        await Promise.all([[PAGE_CACHE, 40], [ASSET_CACHE, 256], [IMAGE_CACHE, 120]].map(async ([name, limit]) => {
            try { await trimCache(await caches.open(name), limit); } catch { /* Optional offline storage. */ }
        }));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin || event.request.headers?.has("Range")) return;
    if (event.request.mode === "navigate") {
        event.respondWith(navigation(event, url));
    } else if (HASHED_ASSET.test(url.pathname)) {
        event.respondWith(staticResource(event, ASSET_CACHE, 256, url.pathname.endsWith(".css") ? "css" : "js"));
    } else if (event.request.destination === "image" && IMAGE_FILE.test(url.pathname)) {
        event.respondWith(staticResource(event, IMAGE_CACHE, 120, "image"));
    }
});
