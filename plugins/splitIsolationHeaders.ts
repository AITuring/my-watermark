import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const SPLIT_DOCUMENT_PATH = /^\/split(?:\/|\.html|\/index\.html)?$/;
const CORP_ASSET_PATH = /^\/(?:assets|wasm-vips|fonts\/watermark|src\/workers)\//;

function isDocumentRequest(pathname: string, req: Pick<IncomingMessage, "headers">): boolean {
    if (pathname === "/" || pathname.endsWith(".html")) return true;
    const accept = req.headers?.accept || "";
    const dest = req.headers?.["sec-fetch-dest"];
    return dest === "document" || (accept.includes("text/html") && !pathname.includes("."));
}

export function applySplitIsolationHeaders(
    req: Pick<IncomingMessage, "url" | "headers">,
    res: Pick<ServerResponse, "setHeader">,
): void {
    const pathname = (req.url || "/").split("?")[0];
    if (SPLIT_DOCUMENT_PATH.test(pathname)) {
        delete req.headers?.["if-none-match"];
        delete req.headers?.["if-modified-since"];
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    } else if (CORP_ASSET_PATH.test(pathname)) {
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    } else if (isDocumentRequest(pathname, req)) {
        // Prevent 304 Not Modified from retaining stale COOP/COEP headers in
        // browser disk cache, and explicitly reset isolation policies.
        delete req.headers?.["if-none-match"];
        delete req.headers?.["if-modified-since"];
        res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
        res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    }
}

// Match production routing (vercel.json / public/sw.js): only /split requires
// COOP/COEP for SharedArrayBuffer + wasm-vips. Sending COEP globally blocks
// cross-origin map scripts (e.g. AMap on /photo-exif, /museum-events, /wenwu).
export function splitIsolationHeaders(): Plugin {
    const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        applySplitIsolationHeaders(req, res);
        next();
    };
    return {
        name: "split-isolation-headers",
        configureServer(server) {
            server.middlewares.use(middleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware);
        },
    };
}
