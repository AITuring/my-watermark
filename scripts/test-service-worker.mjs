import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const origin = "https://mark.aituring.xyz";

function workerEnvironment(network = async () => new Response("online"), failures = {}, clock = { setTimeout, clearTimeout }) {
    const listeners = new Map();
    const data = new Map();
    const calls = { fetch: [], skipWaiting: 0, claim: 0, deleted: [] };
    const keyOf = (key) => typeof key === "string" ? key : key.url;
    const caches = {
        keys: async () => [...data.keys()],
        delete: async (name) => { calls.deleted.push(name); return data.delete(name); },
        open: async (name) => {
            if (failures.open?.(name)) throw new Error("Cache storage unavailable");
            if (!data.has(name)) data.set(name, new Map());
            const entries = data.get(name);
            return {
                match: async (key, options) => {
                    const url = keyOf(key);
                    const match = options?.ignoreSearch
                        ? [...entries.keys()].find((entry) => entry.split("?")[0] === url.split("?")[0])
                        : url;
                    return entries.get(match)?.clone();
                },
                put: async (key, response) => {
                    if (failures.put?.(name, keyOf(key))) throw new Error("Storage quota exceeded");
                    // Cache.put consumes a stream before committing it. This
                    // matters when an oversized or interrupted body is rejected.
                    const body = await response.arrayBuffer();
                    entries.set(keyOf(key), new Response(body, { status: response.status, headers: response.headers }));
                },
                keys: async () => [...entries.keys()].map((url) => new Request(url)),
                delete: async (key) => entries.delete(keyOf(key)),
            };
        },
    };
    vm.runInNewContext(source, {
        URL, Headers, Response, TransformStream, caches, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
        fetch: async (...args) => { calls.fetch.push(args); return network(...args); },
        self: {
            location: { origin },
            registration: { scope: `${origin}/` },
            addEventListener: (name, handler) => listeners.set(name, handler),
            skipWaiting: async () => { calls.skipWaiting += 1; },
            clients: { claim: async () => { calls.claim += 1; } },
        },
    });
    return {
        calls, caches, data,
        start(name, request) {
            const work = [];
            let response;
            listeners.get(name)({
                request,
                waitUntil: (promise) => work.push(promise),
                respondWith: (promise) => { response = promise; },
            });
            return {
                response: Promise.resolve(response),
                async complete() {
                    await response;
                    let completed = 0;
                    while (completed < work.length) {
                        const pending = work.slice(completed);
                        completed = work.length;
                        await Promise.all(pending);
                    }
                },
            };
        },
        async dispatch(name, request) {
            const event = this.start(name, request);
            const response = await event.response;
            await event.complete();
            return response;
        },
    };
}

const navigate = (path) => ({ url: `${origin}${path}`, method: "GET", mode: "navigate" });
const asset = (path) => ({ url: `${origin}${path}`, method: "GET", mode: "cors", destination: "script" });
const html = (body) => new Response(body, { headers: { "Content-Type": "text/html" } });
const javascript = (body) => new Response(body, { headers: { "Content-Type": "text/javascript" } });
const flush = () => new Promise(setImmediate);
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
};
function fakeClock() {
    let now = 0;
    let next = 0;
    const timers = new Map();
    return {
        setTimeout(callback, delay) { timers.set(++next, { callback, at: now + delay }); return next; },
        clearTimeout(id) { timers.delete(id); },
        async advance(milliseconds) {
            now += milliseconds;
            for (const [id, timer] of timers) {
                if (timer.at <= now) { timers.delete(id); timer.callback(); }
            }
            await flush();
        },
    };
}

test("install and activate perform no network precache or forced page reload", async () => {
    const environment = workerEnvironment();
    await environment.dispatch("install");
    await environment.dispatch("activate");
    assert.equal(environment.calls.skipWaiting, 1);
    assert.equal(environment.calls.claim, 1);
    assert.equal(environment.calls.fetch.length, 0);
});

test("online navigation revalidates instead of returning an old cached entry", async () => {
    const environment = workerEnvironment(async () => html("new deployment"));
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/song-paintings`, html("old deployment"));
    const response = await environment.dispatch("fetch", navigate("/song-paintings?volume=2"));
    assert.equal(await response.text(), "new deployment");
    assert.equal(environment.calls.fetch[0][1].cache, "no-cache");
    assert.equal(await (await pages.match(`${origin}/song-paintings`)).text(), "new deployment");
});

test("a visited page uses its exact-path copy after 900 ms of slow network", async () => {
    const clock = fakeClock();
    const network = deferred();
    const environment = workerEnvironment(() => network.promise, {}, clock);
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/`, html("wrong root page"));
    await pages.put(`${origin}/split`, html("cached split"));
    const event = environment.start("fetch", navigate("/split?mode=grid"));
    let delivered = false;
    event.response.then(() => { delivered = true; });
    await clock.advance(899);
    assert.equal(delivered, false);
    await clock.advance(1);
    const response = await event.response;
    assert.equal(await response.text(), "cached split");
    assert.equal(response.headers.get("Cross-Origin-Embedder-Policy"), "require-corp");
    assert.equal(environment.calls.fetch.length, 1);
    network.resolve(html("fresh split"));
    await event.complete();
});

test("a first visit keeps waiting for the network after the cache deadline", async () => {
    const clock = fakeClock();
    const network = deferred();
    const environment = workerEnvironment(() => network.promise, {}, clock);
    await (await environment.caches.open("mytools-pages-v1")).put(`${origin}/`, html("cached root only"));
    const event = environment.start("fetch", navigate("/song-paintings"));
    let delivered = false;
    event.response.then(() => { delivered = true; });
    await clock.advance(900);
    assert.equal(delivered, false);
    await clock.advance(12000);
    assert.equal(delivered, false);
    network.resolve(html("first song visit"));
    assert.equal(await (await event.response).text(), "first song visit");
    await event.complete();
});

test("fast headers with a slow HTML body still return the visited page at 900 ms", async () => {
    const clock = fakeClock();
    let body;
    const stream = new ReadableStream({ start(controller) { body = controller; } });
    const environment = workerEnvironment(async () => html(stream), {}, clock);
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/`, html("cached home"));
    body.enqueue(new TextEncoder().encode("fresh "));
    const event = environment.start("fetch", navigate("/"));
    let delivered = false;
    event.response.then(() => { delivered = true; });
    await clock.advance(899);
    assert.equal(environment.calls.fetch.length, 1);
    assert.equal(delivered, false, "receiving only headers or a partial body must not win");
    await clock.advance(1);
    assert.equal(await (await event.response).text(), "cached home");
    assert.equal(await (await pages.match(`${origin}/`)).text(), "cached home");
    body.enqueue(new TextEncoder().encode("home"));
    body.close();
    await event.complete();
    assert.equal(await (await pages.match(`${origin}/`)).text(), "fresh home");
});

test("a complete HTML body beats the deadline and preserves the network response", async () => {
    const clock = fakeClock();
    let body;
    const stream = new ReadableStream({ start(controller) { body = controller; } });
    const original = html(stream);
    const environment = workerEnvironment(async () => original, {}, clock);
    await (await environment.caches.open("mytools-pages-v1")).put(`${origin}/`, html("cached home"));
    const event = environment.start("fetch", navigate("/"));
    let delivered = false;
    event.response.then(() => { delivered = true; });
    body.enqueue(new TextEncoder().encode("fresh "));
    await clock.advance(300);
    assert.equal(delivered, false);
    body.enqueue(new TextEncoder().encode("home"));
    body.close();
    await flush();
    assert.equal(delivered, true);
    const response = await event.response;
    assert.equal(response, original);
    assert.equal(response.bodyUsed, false);
    assert.equal(await response.text(), "fresh home");
    await event.complete();
});

test("a page without a cached copy streams immediately without waiting for its full body", async () => {
    const clock = fakeClock();
    let body;
    const stream = new ReadableStream({ start(controller) { body = controller; } });
    const environment = workerEnvironment(async () => html(stream), {}, clock);
    const event = environment.start("fetch", navigate("/song-paintings"));
    let delivered = false;
    event.response.then(() => { delivered = true; });
    body.enqueue(new TextEncoder().encode("first paint"));
    await flush();
    assert.equal(delivered, true, "first visits must not wait for the stream to close");
    const response = await event.response;
    const reader = response.body.getReader();
    assert.equal(new TextDecoder().decode((await reader.read()).value), "first paint");
    await clock.advance(1500);
    body.enqueue(new TextEncoder().encode(" final content"));
    body.close();
    assert.equal(new TextDecoder().decode((await reader.read()).value), " final content");
    assert.equal((await reader.read()).done, true);
    await event.complete();
});

test("HTML readiness checks remain bounded for an oversized body", async () => {
    const clock = fakeClock();
    const environment = workerEnvironment(async () => html(new Uint8Array(10 * 1024 * 1024 + 1)), {}, clock);
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/`, html("bounded fallback"));
    const event = environment.start("fetch", navigate("/"));
    let delivered = false;
    event.response.then(() => { delivered = true; });
    await flush();
    assert.equal(delivered, true, "an oversized body must stop readiness buffering before the timer fires");
    assert.equal(await (await event.response).text(), "bounded fallback");
    await event.complete();
    assert.equal(await (await pages.match(`${origin}/`)).text(), "bounded fallback");
});

test("an interrupted HTML body falls back to the visited page", async () => {
    const clock = fakeClock();
    const environment = workerEnvironment(async () => html(new ReadableStream({
        start(controller) { controller.error(new Error("body interrupted")); },
    })), {}, clock);
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/`, html("working fallback"));
    assert.equal(await (await environment.dispatch("fetch", navigate("/"))).text(), "working fallback");
    assert.equal(await (await pages.match(`${origin}/`)).text(), "working fallback");
});

test("split opaque navigation redirects are passed back to the browser unchanged", async () => {
    for (const path of ["/split", "/split.html"]) {
        const redirect = Object.defineProperties(new Response(null), {
            type: { value: "opaqueredirect" },
            status: { value: 0 },
        });
        const environment = workerEnvironment(async () => redirect);
        const response = await environment.dispatch("fetch", navigate(path));
        assert.equal(response, redirect);
        assert.equal(response.type, "opaqueredirect");
        assert.equal(response.status, 0);
        assert.equal(environment.data.get("mytools-pages-v1").size, 0);
    }
});

test("timed-out navigation retains background work and refreshes only valid HTML", async () => {
    for (const [lateResponse, expected] of [
        [html("fresh song catalog"), "fresh song catalog"],
        [new Response("server error", { status: 503, headers: { "Content-Type": "text/html" } }), "cached catalog"],
        [javascript("wrong MIME"), "cached catalog"],
        [Object.defineProperty(html("redirect target"), "redirected", { value: true }), "cached catalog"],
    ]) {
        const clock = fakeClock();
        const network = deferred();
        const environment = workerEnvironment(() => network.promise, {}, clock);
        const pages = await environment.caches.open("mytools-pages-v1");
        await pages.put(`${origin}/song-paintings`, html("cached catalog"));
        const event = environment.start("fetch", navigate("/song-paintings"));
        await clock.advance(900);
        assert.equal(await (await event.response).text(), "cached catalog");
        let completed = false;
        const background = event.complete().then(() => { completed = true; });
        await flush();
        assert.equal(completed, false, "waitUntil must keep the unfinished fetch alive");
        assert.equal(await (await pages.match(`${origin}/song-paintings`)).text(), "cached catalog");
        network.resolve(lateResponse);
        await background;
        assert.equal(await (await pages.match(`${origin}/song-paintings`)).text(), expected);
        assert.equal(environment.calls.fetch.length, 1);
    }
});

test("online HTTP errors are visible and do not replace a working offline page", async () => {
    let offline = false;
    const environment = workerEnvironment(async () => {
        if (offline) throw new TypeError("offline");
        return new Response("Server unavailable", { status: 503, headers: { "Content-Type": "text/html" } });
    });
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/split`, html("last working split"));
    const error = await environment.dispatch("fetch", navigate("/split"));
    assert.equal(error.status, 503);
    assert.equal(await error.text(), "Server unavailable");
    assert.equal(error.headers.get("Cross-Origin-Embedder-Policy"), "require-corp");
    offline = true;
    assert.equal(await (await environment.dispatch("fetch", navigate("/split"))).text(), "last working split");
});

test("redirected and non-HTML documents never overwrite an offline page", async () => {
    for (const response of [new Response("JSON", { headers: { "Content-Type": "application/json" } }), html("redirect target")]) {
        if (response.headers.get("Content-Type") === "text/html") Object.defineProperty(response, "redirected", { value: true });
        const environment = workerEnvironment(async () => response);
        const pages = await environment.caches.open("mytools-pages-v1");
        await pages.put(`${origin}/split`, html("correct split"));
        await environment.dispatch("fetch", navigate("/split"));
        assert.equal(await (await pages.match(`${origin}/split`)).text(), "correct split");
    }
});

test("offline fallback only returns the requested visited path", async () => {
    const environment = workerEnvironment(async () => { throw new TypeError("offline"); });
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/`, html("home"));
    await pages.put(`${origin}/song-paintings`, html("song catalog"));
    assert.equal(await (await environment.dispatch("fetch", navigate("/song-paintings"))).text(), "song catalog");
    const missing = await environment.dispatch("fetch", navigate("/never-visited"));
    assert.equal(missing.status, 503);
    assert.match(await missing.text(), /还没有离线副本/);
});

test("corrupt offline page entries are removed instead of served", async () => {
    const environment = workerEnvironment(async () => { throw new TypeError("offline"); });
    const pages = await environment.caches.open("mytools-pages-v1");
    await pages.put(`${origin}/song-paintings`, javascript("wrong document"));
    const response = await environment.dispatch("fetch", navigate("/song-paintings?volume=2"));
    assert.equal(response.status, 503);
    assert.equal(await pages.match(`${origin}/song-paintings`), undefined);
});

test("split navigation preserves required isolation even in offline fallback", async () => {
    const environment = workerEnvironment(async () => { throw new TypeError("offline"); });
    await (await environment.caches.open("mytools-pages-v1")).put(`${origin}/split`, html("split page"));
    const response = await environment.dispatch("fetch", navigate("/split"));
    assert.equal(response.headers.get("Cross-Origin-Opener-Policy"), "same-origin");
    assert.equal(response.headers.get("Cross-Origin-Embedder-Policy"), "require-corp");
    assert.equal(await response.text(), "split page");
    const uncachedHtml = await environment.dispatch("fetch", navigate("/split.html"));
    assert.equal(uncachedHtml.status, 503);
    assert.equal(uncachedHtml.headers.get("Cross-Origin-Embedder-Policy"), "require-corp");
});

test("hashed code is reused but a server HTML fallback never poisons the code cache", async () => {
    let valid = false;
    const environment = workerEnvironment(async () => valid
        ? new Response("export default 1", { headers: { "Content-Type": "text/javascript" } })
        : html("SPA fallback"));
    const request = asset("/assets/route-deadbeef.js");
    await environment.dispatch("fetch", request);
    assert.equal(environment.data.get("page-assets-cache").size, 0);
    valid = true;
    await environment.dispatch("fetch", request);
    assert.equal(await (await environment.dispatch("fetch", request)).text(), "export default 1");
    assert.equal(environment.calls.fetch.length, 2);
});

test("HTML left in the old runtime code cache is replaced with valid code", async () => {
    const environment = workerEnvironment(async () => javascript("repaired code"));
    const code = await environment.caches.open("page-assets-cache");
    const url = `${origin}/assets/route-deadbeef.js`;
    await code.put(url, html("old SPA fallback"));
    assert.equal(await (await environment.dispatch("fetch", asset("/assets/route-deadbeef.js"))).text(), "repaired code");
    assert.equal(await (await code.match(url)).text(), "repaired code");
    assert.equal(environment.calls.fetch.length, 1);
});

test("code cache validates the requested file type and excludes partial responses", async () => {
    const responses = [
        [".js", new Response("CSS", { headers: { "Content-Type": "text/css" } })],
        [".css", javascript("JS")],
        [".js", new Response("partial", { status: 206, headers: { "Content-Type": "text/javascript" } })],
    ];
    for (const [extension, response] of responses) {
        const environment = workerEnvironment(async () => response);
        await environment.dispatch("fetch", asset(`/assets/route-deadbeef${extension}`));
        assert.equal(environment.data.get("page-assets-cache").size, 0);
    }
});

test("legacy migration preserves old tabs' hashed code but removes stale HTML", async () => {
    const environment = workerEnvironment();
    const legacyName = `workbox-precache-v2-${origin}/`;
    const legacy = await environment.caches.open(legacyName);
    await legacy.put(`${origin}/index.html?__WB_REVISION__=old`, html("stale HTML"));
    await legacy.put(`${origin}/assets/old-deadbeef.js?__WB_REVISION__=old`, new Response("old code", { headers: { "Content-Type": "text/javascript" } }));
    await environment.caches.open("unrelated-app-user-files");
    await environment.dispatch("activate");
    assert.deepEqual(environment.calls.deleted, [legacyName]);
    assert(environment.data.has("unrelated-app-user-files"));
    const assets = await environment.caches.open("page-assets-cache");
    assert.equal(await (await assets.match(`${origin}/assets/old-deadbeef.js`)).text(), "old code");
    assert.equal(await assets.match(`${origin}/index.html`), undefined);
    assert.equal(environment.calls.fetch.length, 0);
});

test("migration repairs poisoned target code without copying legacy HTML or other scopes", async () => {
    const environment = workerEnvironment();
    const name = `workbox-precache-v2-${origin}/`;
    const legacy = await environment.caches.open(name);
    await legacy.put(`${origin}/assets/route-deadbeef.js?__WB_REVISION__=old`, javascript("valid old code"));
    await legacy.put(`${origin}/assets/bad-deadbeef.css`, html("invalid fallback"));
    const code = await environment.caches.open("page-assets-cache");
    await code.put(`${origin}/assets/route-deadbeef.js`, html("poisoned target"));
    const otherScope = `workbox-precache-v2-${origin}/other-app/`;
    await environment.caches.open(otherScope);
    await environment.dispatch("activate");
    assert.equal(await (await code.match(`${origin}/assets/route-deadbeef.js`)).text(), "valid old code");
    assert.equal(await code.match(`${origin}/assets/bad-deadbeef.css`), undefined);
    assert.deepEqual(environment.calls.deleted, [name]);
    assert(environment.data.has(otherScope));
});

test("quota failure preserves legacy modules for old tabs and still activates", async () => {
    const environment = workerEnvironment(async () => new Response("removed", { status: 404 }), {
        put: (name) => name === "page-assets-cache",
    });
    const name = `workbox-precache-v2-${origin}/`;
    const legacy = await environment.caches.open(name);
    await legacy.put(`${origin}/assets/old-deadbeef.js?__WB_REVISION__=old`, javascript("old tab code"));
    await legacy.put(`${origin}/index.html?__WB_REVISION__=old`, html("stale root"));
    await environment.dispatch("activate");
    assert.equal(environment.calls.claim, 1);
    assert(environment.data.has(name));
    assert.equal(await (await environment.dispatch("fetch", asset("/assets/old-deadbeef.js"))).text(), "old tab code");
    assert.equal(environment.calls.fetch.length, 0);
    const response = await environment.dispatch("fetch", navigate("/"));
    assert.equal(response.status, 404);
});

test("unavailable cache storage never prevents network loading or worker activation", async () => {
    const environment = workerEnvironment(async (request) => request.mode === "navigate" ? html("online page") : javascript("online code"), {
        open: () => true,
    });
    await environment.dispatch("activate");
    assert.equal(environment.calls.claim, 1);
    assert.equal(await (await environment.dispatch("fetch", navigate("/"))).text(), "online page");
    assert.equal(await (await environment.dispatch("fetch", asset("/assets/route-deadbeef.js"))).text(), "online code");
});

test("concurrent writes bound every runtime cache", async () => {
    const environment = workerEnvironment(async (request) => request.mode === "navigate"
        ? html("page")
        : request.destination === "image"
            ? new Response("image", { headers: { "Content-Type": "image/png" } })
            : javascript("code"));
    const requests = [
        ...Array.from({ length: 48 }, (_, index) => navigate(`/page-${index}`)),
        ...Array.from({ length: 264 }, (_, index) => asset(`/assets/route-${index}-deadbeef.js`)),
        ...Array.from({ length: 128 }, (_, index) => ({ ...asset(`/image-${index}.png`), destination: "image" })),
    ];
    await Promise.all(requests.map((request) => environment.dispatch("fetch", request)));
    assert.equal(environment.data.get("mytools-pages-v1").size, 40);
    assert.equal(environment.data.get("page-assets-cache").size, 256);
    assert.equal(environment.data.get("image-assets-cache").size, 120);
});

test("activation bounds oversized caches retained from the previous worker", async () => {
    const environment = workerEnvironment();
    for (const [name, limit] of [["mytools-pages-v1", 40], ["page-assets-cache", 256], ["image-assets-cache", 120]]) {
        const cache = await environment.caches.open(name);
        await Promise.all(Array.from({ length: limit + 5 }, (_, index) => cache.put(`${origin}/old-${index}`, html("old"))));
    }
    await environment.dispatch("activate");
    assert.equal(environment.data.get("mytools-pages-v1").size, 40);
    assert.equal(environment.data.get("page-assets-cache").size, 256);
    assert.equal(environment.data.get("image-assets-cache").size, 120);
});

test("oversized bodies are not cached even with missing or false Content-Length", async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    for (const length of [undefined, "1", String(bytes.byteLength)]) {
        const headers = { "Content-Type": "image/png" };
        if (length !== undefined) headers["Content-Length"] = length;
        const environment = workerEnvironment(async () => new Response(bytes, { headers }));
        const response = await environment.dispatch("fetch", { ...asset("/large.png"), destination: "image" });
        assert.equal((await response.arrayBuffer()).byteLength, bytes.byteLength);
        assert.equal(environment.data.get("image-assets-cache").size, 0);
    }
});

test("interrupted response streams do not leave partial cached files", async () => {
    const environment = workerEnvironment(async () => new Response(new ReadableStream({
        start(controller) { controller.error(new Error("connection interrupted")); },
    }), { headers: { "Content-Type": "text/javascript" } }));
    const response = await environment.dispatch("fetch", asset("/assets/route-deadbeef.js"));
    await assert.rejects(() => response.text(), /connection interrupted/);
    assert.equal(environment.data.get("page-assets-cache").size, 0);
});

test("non-GET, external URLs, range requests and unversioned code are left to the browser", async () => {
    const environment = workerEnvironment();
    for (const request of [
        { ...asset("/api/upload"), method: "POST" },
        { ...asset("/assets/test-deadbeef.js"), url: "https://other.example/assets/test-deadbeef.js" },
        asset("/libraw-wasm/worker.js"),
        { ...asset("/assets/test-deadbeef.js"), headers: new Headers({ Range: "bytes=0-10" }) },
    ]) assert.equal(await environment.dispatch("fetch", request), undefined);
    assert.equal(environment.calls.fetch.length, 0);
});

test("production cache headers revalidate HTML/SW and retain split isolation", async () => {
    const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
    const headersFor = (path) => Object.assign({}, ...config.routes.filter((rule) => rule.continue && new RegExp(`^(?:${rule.src})$`).test(path)).map((rule) => rule.headers || {}));
    for (const path of ["/", "/split", "/song-paintings", "/index.html", "/split.html", "/sw.js"]) {
        assert.equal(headersFor(path)["Cloudflare-CDN-Cache-Control"], "no-store", path);
        assert.match(headersFor(path)["Cache-Control"], /no-store/, path);
    }
    assert.match(headersFor("/assets/route-deadbeef.js")["Cache-Control"], /immutable/);
    for (const path of ["/split", "/split/", "/split.html"]) {
        assert.equal(headersFor(path)["Cross-Origin-Opener-Policy"], "same-origin");
        assert.equal(headersFor(path)["Cross-Origin-Embedder-Policy"], "require-corp");
    }
    assert(config.routes.some((rule) => rule.status === 404 && new RegExp(`^(?:${rule.src})$`).test("/assets/missing-deadbeef.js")));
});
