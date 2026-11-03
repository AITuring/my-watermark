import type { Plugin } from "vite";
import routes from "../scripts/prerender-routes.json";

// Vite preview should serve the same documents as the production rewrites.
export function prerenderPreview(): Plugin {
    return {
        name: "prerender-preview",
        generateBundle(_options, bundle) {
            const manifest = {};
            for (const page of routes) {
                const routeChunk = Object.values(bundle).find((chunk) => chunk.type === "chunk"
                    && Object.keys(chunk.modules).some((id) => id.replace(/\\/g, "/").endsWith(`/${page.entry}`)));
                if (!routeChunk) throw new Error(`Missing prerender route chunk: ${page.route}`);
                const scripts = new Set<string>();
                const styles = new Set<string>();
                const collect = (file: string) => {
                    if (scripts.has(file)) return;
                    const chunk = bundle[file];
                    if (!chunk || chunk.type !== "chunk") return;
                    scripts.add(file);
                    chunk.imports.forEach(collect);
                    (chunk as typeof chunk & { viteMetadata?: { importedCss: Set<string> } })
                        .viteMetadata?.importedCss.forEach((css) => styles.add(css));
                };
                Object.values(bundle).forEach((chunk) => {
                    if (chunk.type === "chunk" && chunk.isEntry) collect(chunk.fileName);
                });
                collect(routeChunk.fileName);
                manifest[page.route] = { scripts: [...scripts], styles: [...styles] };
            }
            this.emitFile({ type: "asset", fileName: "prerender-manifest.json", source: JSON.stringify(manifest, null, 2) });
        },
        configurePreviewServer(server) {
            server.middlewares.use((req, res, next) => {
                const pathname = (req.url || "/").split("?")[0];
                const alias = routes.find((page) => pathname === `/${page.file}`);
                if (alias) {
                    res.statusCode = 308;
                    res.setHeader("Location", alias.route + (req.url?.slice(pathname.length) || ""));
                    res.end();
                    return;
                }
                if (req.headers.accept?.includes("text/html") && !pathname.includes(".")) {
                    const route = pathname.replace(/\/$/, "") || "/";
                    req.url = `/${routes.find((page) => page.route === route)?.file || "app.html"}`;
                }
                next();
            });
        },
    };
}
