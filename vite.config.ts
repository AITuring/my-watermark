import path from "path";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type PluginOption } from "vite";
import { localSplitPlugin } from './plugins/localSplit';
import { localSongCatalogPlugin } from './plugins/songCatalog';
import { routeChunks } from './plugins/routeChunks';
import { prerenderPreview } from './plugins/prerenderPreview';
import { inlineCriticalAssets } from './plugins/inlineCriticalAssets.mjs';

const enableLegacy = process.env.LEGACY_BUILD === "true";

export default defineConfig({
    plugins: [
        inlineCriticalAssets(),
        react(),
        localSplitPlugin(),
        localSongCatalogPlugin(),
        enableLegacy ? legacy() : null,
        prerenderPreview(),
        viteCompression({
            verbose: true,
            disable: false,
            threshold: 10240,
            algorithm: "gzip",
            ext: ".gz",
            deleteOriginFile: false, // Keep source files for servers that don't support gzip
        }) as unknown as PluginOption,
        process.env.ANALYZE === "true" ? (visualizer({ open: true }) as unknown as PluginOption) : null,
    ].filter(Boolean),
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 8123,
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    preview: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    worker: {
        format: "es",
    },
    build: {
        manifest: true,
        rollupOptions: { output: { manualChunks: routeChunks } },
        // Keep Vite's dependency preloads: the selected lazy route and its static
        // dependencies load together, while unrelated lazy routes remain deferred.
        sourcemap: false,
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true, // 生产环境自动删除console
                pure_funcs: ["console.log"], // 压缩的时候删除所有的console
            },
        },
    },
    optimizeDeps: {
        entries: ["./src/main.tsx"], // Specify entry file to improve pre-bundling
    },
});
