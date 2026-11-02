import path from "path";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import { VitePWA } from "vite-plugin-pwa";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type Plugin, type PluginOption } from "vite";
import { localSplitPlugin } from './plugins/localSplit';
import { localSongCatalogPlugin } from './plugins/songCatalog';

const enableLegacy = process.env.LEGACY_BUILD === "true";

// Install only the application shell. Following static imports keeps the shell
// complete without downloading every lazy page and image-processing engine.
const shellAssets = new Set<string>();
const collectShellAssets: Plugin = {
    name: "collect-shell-precache-assets",
    apply: "build",
    enforce: "post",
    buildStart() {
        shellAssets.clear();
    },
    generateBundle(_options, bundle) {
        const visited = new Set<string>();
        const collect = (fileName: string) => {
            if (visited.has(fileName)) return;
            visited.add(fileName);
            const chunk = bundle[fileName];
            if (!chunk || chunk.type !== "chunk") return;
            shellAssets.add(fileName);
            const metadata = (chunk as typeof chunk & {
                viteMetadata?: { importedCss: Set<string> };
            }).viteMetadata;
            metadata?.importedCss.forEach((css) => shellAssets.add(css));
            chunk.imports.forEach(collect);
        };
        Object.values(bundle).forEach((output) => {
            if (output.type === "chunk" && output.isEntry) collect(output.fileName);
        });
    },
};

export default defineConfig({
    plugins: [
        react(),
        localSplitPlugin(),
        localSongCatalogPlugin(),
        enableLegacy ? legacy() : null,
        collectShellAssets,
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: false,
            includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg", "dragon1.png"],
            manifest: {
                name: "MyTools - 轻量工具集",
                short_name: "MyTools",
                description: "一站式图片处理工具集，支持离线使用",
                theme_color: "#020617",
                icons: [
                    {
                        src: "/dragon1.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/dragon1.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            },
            workbox: {
                maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
                // Route chunks are cached when used, not all at once during SW install.
                globPatterns: ["**/*.{js,css,html,ico}"],
                manifestTransforms: [async (entries) => ({
                    manifest: entries.filter(({ url }) => {
                        const fileName = url.replace(/^\/+/, "");
                        return fileName === "index.html" || fileName.endsWith(".ico") || shellAssets.has(fileName);
                    }),
                    warnings: [],
                })],
                navigateFallbackDenylist: [/^\/split(?:\/|$)/],
                runtimeCaching: [
                    {
                        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.+-[\w-]{8,}\.(?:js|css)$/.test(url.pathname),
                        handler: "CacheFirst",
                        options: {
                            cacheName: "page-assets-cache",
                            expiration: {
                                maxEntries: 160,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                            cacheableResponse: {
                                statuses: [200],
                            },
                        },
                    },
                    {
                        urlPattern: /\.(?:png|jpe?g|webp|svg|hdr)$/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "image-assets-cache",
                            expiration: {
                                maxEntries: 120,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-cache",
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "gstatic-fonts-cache",
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
        }),
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
    build: {
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
