import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import ts from "typescript";

// Run after npm run build. These checks inspect the deployable documents, not
// source snippets, so missing CSS/chunks and route rewrite mistakes fail here.
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.resolve(root, process.env.PRERENDER_DIST || "dist");
const read = (file) => readFile(path.join(dist, file), "utf8");
const routes = JSON.parse(await readFile(new URL("./prerender-routes.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await read("prerender-manifest.json"));
const viteManifest = JSON.parse(await read("manifest.json"));
const chunks = new Map(Object.values(viteManifest).map((entry) => [entry.file, entry]));
const documents = new Map(await Promise.all(routes.map(async (page) => [page.route, await read(page.file)])));
const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((match) => match[0]);
const body = (html) => html.slice(html.indexOf("<body"));
const localPath = (url) => decodeURIComponent(new URL(url, "https://build.example/").pathname).replace(/^\//, "");
async function exists(file) {
    try { return (await stat(path.join(dist, file))).isFile(); } catch { return false; }
}

for (const page of routes) {
    test(`${page.route} ships real route content inside a completed hydration boundary`, async () => {
        const html = documents.get(page.route);
        const markup = body(html);
        assert.match(markup, /<div id="root" data-prerendered="true">/);
        assert.match(markup, /<!--\$-->/, "the selected route must be a completed Suspense boundary");
        assert.doesNotMatch(markup, /<!--\$[!?]-->|正在加载页面\.\.\.|页面加载失败/);
        assert.doesNotMatch(markup, /(?:src|href)="\/src\//, "SSR must use production asset URLs");
        assert.match(html, new RegExp(`<title>${page.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</title>`));
        if (page.route === "/") {
            const links = tags(markup, "a").map((tag) => attr(tag, "href"));
            assert(links.includes("/split") && links.includes("/song-paintings"));
            assert(links.length >= 10, "the application catalog must be present without JavaScript");
        } else if (page.route === "/split") {
            assert.match(markup, /<h2[^>]*>长图智能切片<\/h2>/);
            assert(tags(markup, "input").some((tag) => attr(tag, "type") === "file"));
            assert.match(markup, /按宽度连续切/);
        } else if (page.route === "/song-paintings") {
            assert.match(markup, /<h1[^>]*>宋画全集/);
            assert.match(markup, /卷册索引/);
            assert(tags(markup, "tr").filter((tag) => attr(tag, "data-read") !== undefined).length >= 20,
                "the first page of the actual catalog must be present");
            assert.doesNotMatch(markup, /阅读记录无法读取|浏览器无法保存记录/);
        }
        const compressed = await readFile(path.join(dist, `${page.file}.gz`));
        assert.equal(gunzipSync(compressed).toString(), html, "compressed HTML must match the current document");
        for (const tag of tags(markup, "img")) {
            const src = attr(tag, "src");
            if (src?.startsWith("/")) assert(await exists(localPath(src)), `missing rendered image: ${src}`);
        }
    });

    test(`${page.route} inlines every initial stylesheet without blocking stylesheet requests`, async () => {
        const html = documents.get(page.route);
        const expected = manifest[page.route].styles;
        assert(expected.length >= 1);
        const inlined = [...html.matchAll(/<style data-prerender-css="([^"]+)">([\s\S]*?)<\/style>/g)];
        assert.deepEqual(inlined.map((match) => match[1]), expected);
        for (const [, file, css] of inlined) {
            assert.equal(css, (await read(file)).replace(/<\/style/gi, "<\\/style"), `inline CSS differs: ${file}`);
            for (const match of css.matchAll(/url\(\s*["']?(\/assets\/[^\s"')]+)["']?\s*\)/g)) {
                assert(await exists(localPath(match[1])), `missing CSS asset: ${match[1]}`);
            }
        }
        const links = tags(html, "link").filter((tag) => attr(tag, "rel") === "stylesheet");
        assert.deepEqual(links.map((tag) => localPath(attr(tag, "href"))), expected);
        assert(links.every((tag) => /\sdisabled(?:\s|>|=)/.test(tag)), "initial stylesheets must not trigger blocking downloads");
    });

    test(`${page.route} preloads a complete static closure and leaves other tools/engines deferred`, async () => {
        const html = documents.get(page.route);
        const initial = new Set(manifest[page.route].scripts);
        const preloads = tags(html, "link").filter((tag) => attr(tag, "rel") === "modulepreload");
        assert.deepEqual(new Set(preloads.map((tag) => localPath(attr(tag, "href")))), initial);
        assert.equal(preloads.length, initial.size, "duplicate preload requests");
        assert(initial.size <= 8, "the route regressed into a long chain of initial script requests");
        const scripts = tags(html, "script").filter((tag) => attr(tag, "type") === "module");
        assert.equal(scripts.length, 1, "one browser entry must own hydration");
        assert(initial.has(localPath(attr(scripts[0], "src"))));
        for (const file of initial) {
            assert(await exists(file), `missing preloaded script: ${file}`);
            const chunk = chunks.get(file);
            assert(chunk, `preloaded script is missing from Vite's manifest: ${file}`);
            for (const key of chunk.imports || []) {
                assert(initial.has(viteManifest[key]?.file), `static dependency omitted: ${file} -> ${key}`);
            }
            for (const css of chunk.css || []) assert(manifest[page.route].styles.includes(css), `initial CSS omitted: ${css}`);
        }
        for (const [key, chunk] of Object.entries(viteManifest)) {
            if (/three(?:\.module|\/)|html2canvas|exif-reader|jszip|libraw|mediapipe|wasm-vips|jpeg-vips|song-paintings\/share/.test(key)) {
                assert(!initial.has(chunk.file), `heavy engine was eagerly selected: ${key}`);
            }
            if (chunk.isDynamicEntry && /^src\/pages\/.+\/(?:index|personal)\.tsx$/.test(key) && key !== page.entry) {
                assert(!initial.has(chunk.file), `unselected tool was eagerly selected: ${key}`);
            }
        }
    });
}

test("home embeds the same five original critical WebPs for prerender and hydration", async () => {
    const images = tags(body(documents.get("/")), "img");
    assert(images.length > 18, "include the repeated thumbnails below the fold");
    const client = (await Promise.all(manifest["/"].scripts.map(read))).join("\n");
    for (const [index, tag] of images.entries()) {
        const src = attr(tag, "src");
        assert.equal(attr(tag, "width"), "128");
        assert.equal(attr(tag, "height"), "128");
        if (index < 5) {
            assert.equal(attr(tag, "loading"), "eager");
            assert.match(src, /^data:image\/webp;base64,/);
            const original = await readFile(new URL(`../src/assets/history/thumbnails/split_${String(index + 1).padStart(3, "0")}.webp`, import.meta.url));
            assert.deepEqual(Buffer.from(src.split(",")[1], "base64"), original, "inlining must preserve every original image byte");
            assert(client.includes(src), "client hydration must use the exact prerendered data URI");
        } else {
            assert.equal(attr(tag, "loading"), "lazy");
            assert.match(src, /^\/assets\/split_\d{3}-[^/]+\.webp$/, "later and repeated cards must retain external cacheable images");
        }
    }
    assert.equal(images.filter((tag) => attr(tag, "src")?.startsWith("data:")).length, 5);
});

test("other routes receive the empty client shell and missing code never receives HTML", async () => {
    const shell = await read("app.html");
    assert.match(shell, /<div id="root"><\/div>/);
    assert.doesNotMatch(shell, /data-prerendered|data-prerender-css|宋画全集|长图智能切片/);
    const resolve = async (url) => {
        // Production route patterns match pathnames, never the query string.
        const pathname = new URL(url, "https://build.example/").pathname;
        for (const rule of config.routes) {
            if (rule.handle === "filesystem" && await exists(pathname === "/" ? "index.html" : pathname.slice(1))) return pathname === "/" ? "/index.html" : pathname;
            if (rule.src && new RegExp(`^(?:${rule.src})$`).test(pathname) && !rule.continue) return rule.status || rule.dest;
        }
        return undefined;
    };
    for (const page of routes) {
        assert.equal(await resolve(page.route), `/${page.file}`);
        assert.equal(await resolve(`${page.route}?q=%E5%AE%8B%E7%94%BB&tag=a&tag=b`), `/${page.file}`);
        if (page.route !== "/") assert.equal(await resolve(`${page.route}/`), `/${page.file}`);
    }
    for (const route of ["/watermark", "/crop", "/song-paintings-me", "/missing-page"]) {
        assert.equal(await resolve(route), "/app.html");
        assert.equal(await resolve(`${route}?from=catalog`), "/app.html");
    }
    assert.equal(await resolve("/assets/missing-deadbeef.js"), 404);
});

test("production HTML aliases redirect before filesystem delivery and canonical routes do not loop", () => {
    const filesystem = config.routes.findIndex((rule) => rule.handle === "filesystem");
    assert(filesystem >= 0);
    for (const page of routes) {
        for (const query of ["", "?q=%E5%AE%8B%E7%94%BB&tag=a&tag=b"]) {
            const pathname = new URL(`/${page.file}${query}`, "https://build.example/").pathname;
            const ruleIndex = config.routes.findIndex((rule) => rule.src && !rule.continue && new RegExp(`^(?:${rule.src})$`).test(pathname));
            assert(ruleIndex >= 0 && ruleIndex < filesystem, `${pathname} must redirect before serving its SSR file`);
            const rule = config.routes[ruleIndex];
            assert.equal(rule.status, 308);
            assert.equal(rule.headers?.Location, page.route);
        }
        assert(!config.routes.some((rule) => rule.status >= 300 && rule.status < 400
            && new RegExp(`^(?:${rule.src})$`).test(page.route)), `${page.route} must not redirect back to its file`);
    }
    // Query preservation for Vercel's low-level Location headers is verified
    // against the deployed response; do not invent edge behavior in this mock.
});

test("preview routes choose the same documents without intercepting assets or API calls", async () => {
    const source = await readFile(new URL("../plugins/prerenderPreview.ts", import.meta.url), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: () => ({ default: routes }) });
    let middleware;
    exports.prerenderPreview().configurePreviewServer({ middlewares: { use(handler) { middleware = handler; } } });
    for (const [url, expected] of [["/", "/index.html"], ["/?from=bookmark", "/index.html"], ["/split?test=1", "/split.html"], ["/song-paintings/?q=%E5%AE%8B%E7%94%BB", "/song-paintings.html"], ["/crop?from=catalog", "/app.html"], ["/assets/missing.js?cache=1", "/assets/missing.js?cache=1"]]) {
        const req = { url, headers: { accept: "text/html,application/xhtml+xml" } };
        let continued = false;
        middleware(req, {}, () => { continued = true; });
        assert.equal(req.url, expected);
        assert(continued);
    }
    const request = { url: "/api/example", headers: { accept: "application/json" } };
    middleware(request, {}, () => {});
    assert.equal(request.url, "/api/example");

    for (const page of routes) {
        for (const query of ["", "?", "?q=%E5%AE%8B%E7%94%BB&tag=a&tag=b&return=%2Fsplit%3Fx%3D1"]) {
            const url = `/${page.file}${query}`;
            const req = { url, headers: { accept: "text/html" } };
            const headers = {};
            let ended = false;
            let continued = false;
            const res = {
                statusCode: 200,
                setHeader(name, value) { headers[name] = value; },
                end() { ended = true; },
            };
            middleware(req, res, () => { continued = true; });
            assert.equal(res.statusCode, 308, url);
            assert.equal(headers.Location, `${page.route}${query}`, "redirect must preserve the exact encoded and repeated query parameters");
            assert(ended);
            assert.equal(continued, false, "a redirected request must never also serve SSR HTML");
            assert.equal(req.url, url);
            const redirected = { url: headers.Location, headers: { accept: "text/html" } };
            middleware(redirected, {}, () => {});
            assert.equal(redirected.url, `/${page.file}`, "following the redirect must reach the correct document without another redirect");
        }
    }
});

test("deployed worker and document headers preserve fresh routes and split isolation", async () => {
    assert((await read("sw.js")) === await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
        "dist/sw.js is stale; rebuild after the worker changes");
    const headersFor = (pathname) => Object.assign({}, ...config.routes
        .filter((rule) => rule.continue && new RegExp(`^(?:${rule.src})$`).test(pathname))
        .map((rule) => rule.headers || {}));
    for (const pathname of ["/", "/split", "/song-paintings", "/app.html", "/split.html", "/song-paintings.html", "/sw.js"]) {
        assert.match(headersFor(pathname)["Cache-Control"], /no-store/, pathname);
        assert.equal(headersFor(pathname)["Cloudflare-CDN-Cache-Control"], "no-store", pathname);
    }
    for (const pathname of ["/split", "/split/", "/split.html"]) {
        assert.equal(headersFor(pathname)["Cross-Origin-Opener-Policy"], "same-origin", pathname);
        assert.equal(headersFor(pathname)["Cross-Origin-Embedder-Policy"], "require-corp", pathname);
    }
    for (const file of manifest["/split"].scripts) {
        assert.equal(headersFor(`/${file}`)["Cross-Origin-Resource-Policy"], "same-origin");
        assert.match(headersFor(`/${file}`)["Cache-Control"], /immutable/);
    }
});
