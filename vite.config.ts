import path from "path";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import { VitePWA } from "vite-plugin-pwa";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type PluginOption } from "vite";

export default defineConfig({
    plugins: [
        react(),
        legacy(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
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
                globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
                runtimeCaching: [
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
    build: {
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom', 'scheduler'],
                    'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
                    'antd-vendor': ['antd'],
                    'ui-vendor': [
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-label',
                        '@radix-ui/react-progress',
                        '@radix-ui/react-scroll-area',
                        '@radix-ui/react-select',
                        '@radix-ui/react-separator',
                        '@radix-ui/react-slider',
                        '@radix-ui/react-slot',
                        '@radix-ui/react-switch',
                        '@radix-ui/react-tabs',
                        '@radix-ui/react-tooltip',
                        'lucide-react',
                        'framer-motion',
                        'gsap',
                        'class-variance-authority',
                        'clsx',
                        'tailwind-merge'
                    ],
                    'image-vendor': [
                        'html2canvas',
                        'konva',
                        'react-konva',
                        'stackblur-canvas',
                        'colorthief',
                        'chroma-js'
                    ],
                    'utils-vendor': ['p-limit', 'file-saver', 'jszip']
                }
            },
        },
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
        exclude: ["some-heavy-lib"], // Exclude large libs that don’t need pre-bundling
    },
});
