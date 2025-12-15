import path from "path";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import { VitePWA } from "vite-plugin-pwa";
// import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

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
        // viteCompression({
        //     verbose: true, // 是否在控制台中输出压缩结果
        //     disable: false,
        //     threshold: 10240, // 如果体积大于阈值，将被压缩，单位为b，体积过小时请不要压缩，以免适得其反
        //     algorithm: "gzip", // 压缩算法，可选['gzip'，' brotliccompress '，'deflate '，'deflateRaw']
        //     ext: ".gz",
        //     deleteOriginFile: true, // 源文件压缩后是否删除(我为了看压缩后的效果，先选择了true)
        // }),
        process.env.ANALYZE === "true" ? visualizer({ open: true }) : null,
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
                    'react-core': ['react', 'react-dom'],
                    'react-router': ['react-router-dom'],
                    'antd': ['antd'],
                    'html2canvas': ['html2canvas'],
                    // ... 更多细分
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
