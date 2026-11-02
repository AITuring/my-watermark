import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const ENDPOINT = "/__song_catalog";
const RELATIVE_CATALOG_PATH = "src/pages/song-paintings/catalog.json";
const MAX_BODY_BYTES = 128 * 1024;
const DOMESTIC_VOLUMES = new Set([1, 2, 3, 5]);
const LOOPBACK_CLIENTS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const EDITABLE_FIELDS = new Set([
    "read", "title", "artist", "period", "collection", "volume", "book",
    "sequence", "page", "catalogPdfPage",
]);

type JsonRecord = Record<string, unknown>;
type StoredArtwork = JsonRecord & { id: string; volume: number; book: number; sequence: number };
type StoredCatalog = JsonRecord & { schemaVersion: number; artworks: StoredArtwork[] };
type Snapshot = { catalog: StoredCatalog; revision: string };
type RequestIdentity = Pick<IncomingMessage, "headers" | "socket">;

export class CatalogApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = "CatalogApiError";
    }
}

function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, expected: string[]) {
    const keys = Object.keys(value);
    return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function reject(message: string): never {
    throw new CatalogApiError(400, message);
}

function validText(value: unknown, maxLength: number, allowBlank = true): value is string {
    return typeof value === "string" && value.length <= maxLength &&
        [...value].every((character) => {
            const code = character.charCodeAt(0);
            return (code >= 32 && code !== 127) || [9, 10, 13].includes(code);
        }) &&
        (allowBlank || value.trim().length > 0);
}

function validateChanges(value: unknown): JsonRecord {
    if (!isRecord(value) || Object.keys(value).length === 0) reject("请提供需要修改的字段。");
    for (const [field, item] of Object.entries(value)) {
        if (!EDITABLE_FIELDS.has(field)) reject(`不允许修改字段：${field}。`);
        if (field === "read") {
            if (typeof item !== "boolean") reject("阅读状态必须是布尔值。");
        } else if (["volume", "book", "sequence"].includes(field)) {
            const maximum = field === "volume" ? 8 : field === "book" ? 99 : 999999;
            if (typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > maximum) reject(`${field} 必须是 1–${maximum} 之间的整数。`);
        } else if (field === "page" || field === "catalogPdfPage") {
            const validNumber = typeof item === "number" && Number.isSafeInteger(item) && item >= 0;
            const validString = validText(item, 80) && !/^\s*-\d/u.test(item);
            if (item !== null && !validNumber && !validString) reject("页码必须是非负整数、文字或空值。");
        } else if (field === "artist") {
            if (item !== null && !validText(item, 300)) reject("作者必须是文字或空值，且不超过 300 字。");
        } else {
            const maximum = field === "period" ? 100 : 500;
            if (!validText(item, maximum, field !== "title")) reject(`${field} 文字格式无效或超过 ${maximum} 字。`);
        }
    }
    return value;
}

/** Fixed-file store. The root is a Vite/server configuration, never a request parameter. */
export function createSongCatalogStore(root: string) {
    const filename = path.resolve(root, RELATIVE_CATALOG_PATH);
    let queue: Promise<unknown> = Promise.resolve();
    const read = async (): Promise<Snapshot> => {
        const contents = await fs.readFile(filename, "utf8");
        let catalog: unknown;
        try { catalog = JSON.parse(contents); } catch { throw new CatalogApiError(500, "目录 JSON 无法解析，请先修复本地文件。"); }
        if (!isRecord(catalog) || catalog.schemaVersion !== 1 || !Array.isArray(catalog.artworks) ||
            !catalog.artworks.every((item) => isRecord(item) && typeof item.id === "string")) {
            throw new CatalogApiError(500, "本地目录格式无效，未进行写入。");
        }
        if (new Set(catalog.artworks.map((item) => (item as JsonRecord).id)).size !== catalog.artworks.length) {
            throw new CatalogApiError(500, "本地目录有重复作品编号，未进行写入。");
        }
        return { catalog: catalog as StoredCatalog, revision: createHash("sha256").update(contents).digest("hex") };
    };

    const update = (payload: unknown): Promise<Snapshot> => {
        const operation = queue.then(async () => {
            if (!isRecord(payload) || typeof payload.revision !== "string" || !/^[a-f0-9]{64}$/u.test(payload.revision)) reject("缺少有效的目录版本，请刷新页面后重试。");
            const single = exactKeys(payload, ["revision", "id", "changes"]);
            const batch = exactKeys(payload, ["revision", "readIds"]);
            if (!single && !batch) reject("请求字段不正确。");
            const current = await read();
            if (payload.revision !== current.revision) throw new CatalogApiError(409, "目录已被其他页面或编辑器更新，请刷新后再保存。");
            const catalog = current.catalog;
            if (single) {
                if (typeof payload.id !== "string") reject("作品编号格式不正确。");
                const index = catalog.artworks.findIndex((item) => item.id === payload.id);
                if (index < 0) reject("目录中不存在该作品。");
                const changes = validateChanges(payload.changes);
                const updated = { ...catalog.artworks[index], ...changes } as StoredArtwork;
                // IDs remain stable, even when their original printed coordinates are corrected.
                if (catalog.artworks.some((item, candidate) => candidate !== index && item.volume === updated.volume && item.book === updated.book && item.sequence === updated.sequence)) {
                    reject("该卷、册、原序号已被其他作品使用，请核对后再保存。");
                }
                if (Object.hasOwn(changes, "volume")) updated.edition = DOMESTIC_VOLUMES.has(updated.volume) ? "domestic" : "overseas";
                catalog.artworks[index] = updated;
            } else {
                if (!Array.isArray(payload.readIds) || !payload.readIds.every((id) => typeof id === "string") || payload.readIds.length > catalog.artworks.length) reject("阅读记录中的作品编号格式不正确。");
                const ids = new Set(payload.readIds as string[]);
                if (ids.size !== payload.readIds.length) reject("阅读记录包含重复作品编号。");
                const known = new Set(catalog.artworks.map((item) => item.id));
                if ([...ids].some((id) => !known.has(id))) reject("阅读记录包含当前目录中不存在的作品。");
                catalog.artworks = catalog.artworks.map((item) => ids.has(item.id) ? { ...item, read: true } : item);
            }
            const nextContents = JSON.stringify(catalog, null, 2) + "\n";
            const temporary = `${filename}.${randomUUID()}.tmp`;
            try {
                const mode = (await fs.stat(filename)).mode;
                await fs.writeFile(temporary, nextContents, { encoding: "utf8", flag: "wx", mode });
                // Check at the last asynchronous step before replacement. This detects
                // external edits made while preparing the file, but is not a cross-process lock.
                if ((await read()).revision !== current.revision) throw new CatalogApiError(409, "目录已更新，请刷新后再保存。");
                await fs.rename(temporary, filename);
            } finally {
                await fs.rm(temporary, { force: true });
            }
            return { catalog, revision: createHash("sha256").update(nextContents).digest("hex") };
        });
        queue = operation.catch(() => undefined);
        return operation;
    };
    return { read, update };
}

/** The same validation is used for every method, including token discovery. */
export function assertLocalSongRequest(request: RequestIdentity, writing: boolean, token: string, protocol: "http:" | "https:") {
    if (!LOOPBACK_CLIENTS.has(request.socket.remoteAddress || "")) throw new CatalogApiError(403, "仅允许本机访问目录编辑服务。");
    const host = request.headers.host;
    if (typeof host !== "string") throw new CatalogApiError(403, "本地访问地址无效。");
    let expectedOrigin: string;
    try {
        const address = new URL(`${protocol}//${host}`);
        if (!LOOPBACK_HOSTS.has(address.hostname) || address.username || address.password || address.pathname !== "/" || address.search || address.hash) throw new Error();
        expectedOrigin = address.origin;
    } catch { throw new CatalogApiError(403, "仅允许 localhost 或回环地址访问。"); }
    const origin = request.headers.origin;
    if ((writing || origin !== undefined) && origin !== expectedOrigin) throw new CatalogApiError(403, "目录编辑请求必须来自同一个本地页面。");
    const site = request.headers["sec-fetch-site"];
    if (site !== undefined && site !== "same-origin" && site !== "none") throw new CatalogApiError(403, "不允许跨站访问目录编辑服务。");
    if (writing) {
        const provided = request.headers["x-song-catalog-token"];
        if (typeof provided !== "string" || !/^[a-f0-9]{64}$/u.test(provided) || provided.length !== token.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(token))) throw new CatalogApiError(403, "本地编辑会话已失效，请刷新页面。");
        if (typeof request.headers["content-type"] !== "string" || !/^application\/json(?:\s*;|$)/iu.test(request.headers["content-type"])) throw new CatalogApiError(415, "请使用 JSON 格式提交修改。");
    }
}

async function readBody(request: IncomingMessage) {
    const declared = Number(request.headers["content-length"] || 0);
    if (!Number.isFinite(declared) || declared < 0 || declared > MAX_BODY_BYTES) throw new CatalogApiError(413, "修改请求过大。");
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const part of request) {
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
        length += chunk.length;
        if (length > MAX_BODY_BYTES) throw new CatalogApiError(413, "修改请求过大。");
        chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new CatalogApiError(400, "请求不是有效的 JSON。"); }
}

export function createSongCatalogMiddleware(root: string, protocol: "http:" | "https:" = "http:") {
    const token = randomBytes(32).toString("hex");
    const store = createSongCatalogStore(root);
    return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
        let pathname: string;
        try { pathname = new URL(request.url || "/", "http://localhost").pathname; } catch { return next(); }
        if (pathname !== ENDPOINT) return next();
        const send = (status: number, value: unknown) => {
            response.writeHead(status, {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            });
            response.end(JSON.stringify(value));
        };
        try {
            const writing = request.method === "POST";
            assertLocalSongRequest(request, writing, token, protocol);
            if (request.method === "GET") return send(200, { ...await store.read(), token });
            if (writing) return send(200, await store.update(await readBody(request)));
            response.setHeader("Allow", "GET, POST");
            send(405, { error: "不支持的请求方法。" });
        } catch (error) {
            const status = error instanceof CatalogApiError ? error.status : 500;
            const message = error instanceof CatalogApiError ? error.message : "无法读取或保存本地目录，请检查文件权限后重试。";
            if (!response.headersSent) send(status, { error: message });
        }
    };
}

export function localSongCatalogPlugin(): Plugin {
    return {
        name: "local-song-catalog-editor",
        apply: "serve",
        configureServer(server) {
            server.middlewares.use(createSongCatalogMiddleware(server.config.root, server.config.server.https ? "https:" : "http:"));
        },
    };
}
