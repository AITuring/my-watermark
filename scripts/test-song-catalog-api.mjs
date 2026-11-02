import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { promises as fs } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../plugins/songCatalog.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { localSongCatalogPlugin, createSongCatalogStore, createSongCatalogMiddleware, assertLocalSongRequest } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const sample = {
    schemaVersion: 1, title: "宋画全集", metadata: { keep: "untouched" },
    artworks: [
        { id: "1-1-1", sequence: 1, period: "五代", artist: "黄筌", title: "写生珍禽图", volume: 1, book: 1, page: 2, collection: "故宫博物院藏", catalogPdfPage: 7, edition: "domestic", read: false },
        { id: "4-1-1", sequence: 1, period: "宋", artist: null, title: "山水图", volume: 4, book: 1, page: null, collection: "海外馆藏", catalogPdfPage: null, edition: "overseas", read: true },
    ],
};

async function fixture(run) {
    const root = await mkdtemp(path.join(tmpdir(), "song-catalog-test-"));
    const filename = path.join(root, "src/pages/song-paintings/catalog.json");
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, JSON.stringify(sample, null, 2) + "\n");
    try { await run({ root, filename, store: createSongCatalogStore(root) }); }
    finally { await rm(root, { recursive: true, force: true }); }
}

test("plugin registers only Vite dev middleware and has no preview/build handler", () => {
    const plugin = localSongCatalogPlugin();
    assert.equal(plugin.apply, "serve");
    assert.equal(typeof plugin.configureServer, "function");
    assert.equal(plugin.configurePreviewServer, undefined);
    assert.equal(plugin.buildStart, undefined);
    let registered;
    plugin.configureServer({ config: { root: "/tmp", server: {} }, middlewares: { use: middleware => { registered = middleware; } } });
    assert.equal(typeof registered, "function");
});

test("local access requires loopback, exact origin, content type and unpredictable session token", () => {
    const token = "a".repeat(64);
    const valid = { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost:8123", origin: "http://localhost:8123", "sec-fetch-site": "same-origin", "content-type": "application/json; charset=utf-8", "x-song-catalog-token": token } };
    assert.doesNotThrow(() => assertLocalSongRequest(valid, true, token, "http:"));
    assert.doesNotThrow(() => assertLocalSongRequest({ socket: valid.socket, headers: { host: "localhost:8123" } }, false, token, "http:"));
    for (const patch of [{ origin: "https://localhost:8123" }, { origin: "http://localhost:8124" }, { origin: "http://evil.test" }, { origin: undefined }, { host: "localhost.evil.test:8123" }, { host: "127.0.0.1@evil.test:8123" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }, { "x-song-catalog-token": "b".repeat(64) }, { "x-song-catalog-token": undefined }]) {
        assert.throws(() => assertLocalSongRequest({ ...valid, headers: { ...valid.headers, ...patch } }, true, token, "http:"), error => error.status === 403);
    }
    assert.throws(() => assertLocalSongRequest({ ...valid, socket: { remoteAddress: "192.168.1.2" } }, false, token, "http:"), error => error.status === 403);
    assert.throws(() => assertLocalSongRequest({ ...valid, headers: { ...valid.headers, "content-type": "text/plain" } }, true, token, "http:"), error => error.status === 415);
    assert.doesNotThrow(() => assertLocalSongRequest({ socket: { remoteAddress: "::1" }, headers: { ...valid.headers, host: "[::1]:8123", origin: "https://[::1]:8123" } }, true, token, "https:"));
});

test("patches persist atomically, preserve unrelated metadata and keep IDs stable", () => fixture(async ({ filename, store }) => {
    const before = await store.read();
    const next = await store.update({ revision: before.revision, id: "1-1-1", changes: { read: true, title: "写生珍禽图（修订）", artist: null, volume: 6, page: "2–3" } });
    assert.notEqual(next.revision, before.revision);
    assert.equal(next.catalog.artworks[0].id, "1-1-1");
    assert.equal(next.catalog.artworks[0].volume, 6);
    assert.equal(next.catalog.artworks[0].edition, "overseas");
    assert.equal(next.catalog.artworks[0].read, true);
    assert.equal(next.catalog.artworks[0].artist, null);
    assert.deepEqual(next.catalog.artworks[1], sample.artworks[1]);
    assert.deepEqual(next.catalog.metadata, sample.metadata);
    assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), next.catalog);
    assert.deepEqual(await readdir(path.dirname(filename)), ["catalog.json"]);
}));

test("invalid writes never alter the catalog and merge imports never clear existing reads", () => fixture(async ({ filename, store }) => {
    const beforeText = await readFile(filename, "utf8");
    const { revision } = await store.read();
    const invalidChanges = [
        {}, { id: "other" }, { edition: "overseas" }, { extra: true }, { read: 1 }, { title: " " }, { title: "x".repeat(501) },
        { artist: 5 }, { artist: "x".repeat(301) }, { volume: 9 }, { volume: 0 }, { volume: 1.2 }, { book: 100 }, { sequence: 0 },
        { page: -1 }, { page: "-2" }, { page: {} }, { catalogPdfPage: false }, { period: null }, { collection: [] }, { volume: 4 },
    ];
    for (const changes of invalidChanges) await assert.rejects(store.update({ revision, id: "1-1-1", changes }), error => error.status === 400);
    for (const payload of [{ revision, id: "unknown", changes: { read: true } }, { revision, id: "1-1-1", changes: { read: true }, path: "/tmp/other" }, { revision, readIds: ["unknown"] }, { revision, readIds: ["1-1-1", "1-1-1"] }, { revision, readIds: [false] }, { revision: "bad", readIds: [] }]) {
        await assert.rejects(store.update(payload), error => error.status === 400);
    }
    assert.equal(await readFile(filename, "utf8"), beforeText);
    const merged = await store.update({ revision, readIds: ["1-1-1"] });
    assert.deepEqual(merged.catalog.artworks.map(item => item.read), [true, true]);
}));

test("stale and simultaneous writes conflict instead of losing data; external edits are detected", () => fixture(async ({ filename, store }) => {
    const { revision } = await store.read();
    const results = await Promise.allSettled([
        store.update({ revision, id: "1-1-1", changes: { read: true } }),
        store.update({ revision, id: "4-1-1", changes: { title: "修订标题" } }),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.find(result => result.status === "rejected").reason.status, 409);
    const fresh = await store.read();
    const retried = await store.update({ revision: fresh.revision, id: "4-1-1", changes: { title: "修订标题" } });
    assert.equal(retried.catalog.artworks[0].read, true);
    assert.equal(retried.catalog.artworks[1].title, "修订标题");
    await writeFile(filename, JSON.stringify({ ...retried.catalog, external: true }));
    await assert.rejects(store.update({ revision: retried.revision, id: "1-1-1", changes: { read: false } }), error => error.status === 409);
    assert.equal((await store.read()).catalog.external, true);
}));

test("an external edit after the temporary file is written is preserved and the temporary is cleaned", async (t) => fixture(async ({ filename, store }) => {
    const before = await store.read();
    const external = JSON.stringify({ ...sample, title: "外部编辑器更新" }, null, 2) + "\n";
    const originalWriteFile = fs.writeFile.bind(fs);
    const intercepted = t.mock.method(fs, "writeFile", async (...args) => {
        await originalWriteFile(...args);
        if (typeof args[0] === "string" && args[0].startsWith(filename + ".") && args[0].endsWith(".tmp")) {
            await originalWriteFile(filename, external, "utf8");
        }
    });
    try {
        await assert.rejects(store.update({ revision: before.revision, id: "1-1-1", changes: { read: true } }), error => error.status === 409);
        assert.equal(await readFile(filename, "utf8"), external);
        assert.deepEqual(await readdir(path.dirname(filename)), ["catalog.json"]);
    } finally { intercepted.mock.restore(); }
}));

test("HTTP middleware enforces security, JSON body size and request methods", () => fixture(async ({ root, store }) => {
    const middleware = createSongCatalogMiddleware(root);
    const server = createServer((req, res) => void middleware(req, res, () => { res.writeHead(404); res.end(); }));
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const port = server.address().port;
    const origin = `http://127.0.0.1:${port}`;
    const request = (method, payload, extra = {}, endpoint = "/__song_catalog") => new Promise((resolve, reject) => {
        const body = typeof payload === "string" ? payload : payload === undefined ? undefined : JSON.stringify(payload);
        const req = httpRequest(`${origin}${endpoint}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }), ...extra } }, res => {
            let data = ""; res.setEncoding("utf8"); res.on("data", chunk => { data += chunk; }); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, data: data ? JSON.parse(data) : null }));
        });
        req.on("error", reject); req.end(body);
    });
    try {
        const bootstrap = await request("GET");
        assert.equal(bootstrap.status, 200);
        assert.equal(bootstrap.data.token.length, 64);
        assert.equal(bootstrap.headers["cache-control"], "no-store");
        const payload = { revision: bootstrap.data.revision, id: "1-1-1", changes: { read: true } };
        const headers = { Origin: origin, "X-Song-Catalog-Token": bootstrap.data.token };
        assert.equal((await request("POST", payload)).status, 403);
        assert.equal((await request("POST", payload, { ...headers, Origin: "http://evil.test" })).status, 403);
        assert.equal((await request("GET", undefined, { Origin: "http://evil.test" })).status, 403);
        assert.equal((await request("POST", "{bad", headers)).status, 400);
        assert.equal((await request("POST", " ".repeat(128 * 1024 + 1), headers)).status, 413);
        assert.equal((await request("DELETE", undefined, { Origin: origin })).status, 405);
        assert.equal((await request("GET", undefined, {}, "/other")).status, 404);
        const saved = await request("POST", payload, headers);
        assert.equal(saved.status, 200);
        assert.equal(saved.data.catalog.artworks[0].read, true);
        assert.equal(saved.data.token, undefined);
        assert.equal((await request("POST", payload, headers)).status, 409);
        assert.equal((await store.read()).catalog.artworks[0].read, true);
    } finally { await new Promise(resolve => server.close(resolve)); }
}));
