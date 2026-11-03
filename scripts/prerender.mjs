import { build } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.resolve(root, process.argv[2] || "dist");
const template = await readFile(path.join(dist, "index.html"), "utf8");
const manifest = JSON.parse(await readFile(path.join(dist, "prerender-manifest.json"), "utf8"));
const routes = JSON.parse(await readFile(new URL("./prerender-routes.json", import.meta.url), "utf8"));

// Keep the SSR bundle under this project's node_modules so external React
// resolves to the same installed version used for the browser build.
const cache = path.join(root, "node_modules/.cache");
await mkdir(cache, { recursive: true });
const temporary = await mkdtemp(path.join(cache, "prerender-"));
try {
    await build({
        configFile: false,
        root,
        publicDir: false,
        logLevel: "warn",
        plugins: [react()],
        resolve: { alias: { "@": path.join(root, "src") } },
        build: {
            ssr: path.join(root, "src/entry-server.tsx"),
            outDir: temporary,
            minify: false,
        },
    });
    const { render } = await import(pathToFileURL(path.join(temporary, "entry-server.js")).href);
    // Other routes retain their normal client entry, without the home page's
    // markup being mistakenly hydrated on a different URL.
    await writeFile(path.join(dist, "app.html"), template);
    for (const page of routes) {
        const { scripts: js, styles: css } = manifest[page.route];
        let styles = "";
        for (const file of css) {
            const source = (await readFile(path.join(dist, file), "utf8")).replace(/<\/style/gi, "<\\/style");
            // Disabled links mark CSS as present for Vite's lazy preload helper;
            // the identical inline stylesheet is already applied and costs no
            // extra blocking request. New routes can still load their own CSS.
            styles += `<style data-prerender-css="${file}">${source}</style>\n<link rel="stylesheet" href="/${file}" disabled>\n`;
        }
        const html = await render(page.route);
        if (!html || html.includes("正在加载页面...")) throw new Error(`Unresolved prerender: ${page.route}`);
        let document = template
            .replace(/\s*<link\b[^>]*rel="(?:stylesheet|modulepreload)"[^>]*>/g, "")
            .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
            .replace("</head>", `${styles}${[...js].map(file => `<link rel="modulepreload" crossorigin href="/${file}">`).join("\n")}\n</head>`)
            .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${html}</div>`);
        if (!document.includes('data-prerendered="true"')) throw new Error("Root template changed");
        await writeFile(path.join(dist, page.file), document);
        await writeFile(path.join(dist, `${page.file}.gz`), gzipSync(document));
        console.log(`Prerendered ${page.route}: ${Buffer.byteLength(document)} bytes / ${gzipSync(document).length} gzip, ${js.length} initial scripts`);
    }
} finally {
    await rm(temporary, { recursive: true, force: true });
}
