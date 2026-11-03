/**
 * Keep small shared modules in a few cacheable files. Automatic chunking used
 * to emit individual icons and Radix helpers, making tool startup require many
 * network round trips. Do not use an all-node_modules vendor chunk: image/3D
 * engines must stay behind their existing dynamic imports.
 */
export function routeChunks(id: string): string | undefined {
    const normalized = id.replace(/\\/g, "/");
    if (normalized.includes("vite/preload-helper") || normalized.includes("commonjsHelpers")
        || /\/node_modules\/(?:react|react-dom|react-router|react-router-dom|scheduler|@remix-run\/router)\//.test(normalized)
        || /\/src\/(?:context\/|hooks\/(?:index\.ts|useDark\/|useDeviceDetect\/))/.test(normalized)
        || /\/src\/utils\/(?:cache-import|import-recovery)\.ts$/.test(normalized)) {
        return "app-runtime";
    }
    // These controls are not part of the landing page's initial navigation.
    // Keep their implementation out of the shell while grouping tool controls.
    if (/\/node_modules\/@radix-ui\/react-(?:dialog|select|slider|tabs|progress|switch|separator|scroll-area|label|hover-card)\//.test(normalized)
        || /\/src\/components\/ui\/(?:dialog|select|slider|tabs|progress|switch|separator|scroll-area|label|hover-card)\.tsx$/.test(normalized)) {
        return "ui-controls";
    }
    if (/\/node_modules\/(?:@radix-ui\/[^/]+|@floating-ui\/[^/]+|lucide-react|class-variance-authority|clsx|tailwind-merge|aria-hidden|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|get-nonce|detect-node-es|tslib)\//.test(normalized)
        || /\/src\/components\/ui\//.test(normalized)
        || /\/src\/lib\/utils\.ts$/.test(normalized)) {
        return "ui-primitives";
    }
    if (/\/src\/utils\/(?:download-files|lazy-deps|file-storage|crop-transfer)\.ts$/.test(normalized)
        || /\/src\/components\/ImagePreview\.tsx$/.test(normalized)) {
        return "image-tool-common";
    }
    return undefined;
}
