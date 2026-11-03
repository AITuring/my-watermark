import { readFile } from "node:fs/promises";

// Use the same bytes and URL in the browser and prerender builds. Only explicit
// imports opt in, so repeated thumbnails below the fold keep cacheable URLs.
export function inlineCriticalAssets() {
    return {
        name: "inline-critical-assets",
        enforce: "pre",
        async load(id) {
            const query = id.indexOf("?");
            if (query < 0 || !new URLSearchParams(id.slice(query + 1)).has("inline-critical")) return null;
            const file = id.slice(0, query);
            if (!file.endsWith(".webp")) throw new Error(`Critical inline asset must be WebP: ${file}`);
            this.addWatchFile(file);
            const source = await readFile(file);
            return `export default ${JSON.stringify(`data:image/webp;base64,${source.toString("base64")}`)};`;
        },
    };
}
