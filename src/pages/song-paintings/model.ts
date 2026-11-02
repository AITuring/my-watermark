export type Edition = "domestic" | "overseas";

export interface Artwork {
    id: string;
    sequence: number;
    period: string;
    artist: string | null;
    title: string;
    volume: number;
    book: number;
    page: string | number | null;
    collection: string;
    catalogPdfPage: string | number | null;
    edition: Edition;
    read?: boolean;
}

export interface Catalog {
    schemaVersion: number;
    title: string;
    artworks: Artwork[];
}

export interface CatalogFilters {
    edition: "all" | Edition;
    volume: number | null;
    book: number | null;
    reading: "all" | "read" | "unread";
    query: string;
}

export interface ReadingProgress {
    schemaVersion: 1;
    catalog: "song-paintings";
    readIds: string[];
}

export const STORAGE_KEY = "song-paintings:reading:v1";
export const VISITOR_STORAGE_KEY = "song-paintings:visitor:v1";

function normalizeSearch(value: string): string {
    return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

export function filterArtworks(
    artworks: readonly Artwork[],
    filters: CatalogFilters,
    readIds: ReadonlySet<string>,
): Artwork[] {
    const words = normalizeSearch(filters.query).split(" ").filter(Boolean);

    return artworks.filter((artwork) => {
        if (filters.edition !== "all" && artwork.edition !== filters.edition) return false;
        if (filters.volume !== null && artwork.volume !== filters.volume) return false;
        if (filters.book !== null && artwork.book !== filters.book) return false;
        if (filters.reading === "read" && !readIds.has(artwork.id)) return false;
        if (filters.reading === "unread" && readIds.has(artwork.id)) return false;
        if (!words.length) return true;

        const searchable = normalizeSearch([
            artwork.title,
            artwork.artist ?? "",
            artwork.period,
            artwork.collection,
        ].join(" "));
        return words.every((word) => searchable.includes(word));
    });
}

export function createProgress(readIds: ReadonlySet<string>): ReadingProgress {
    return {
        schemaVersion: 1,
        catalog: "song-paintings",
        readIds: [...readIds].sort(),
    };
}

export function parseProgress(text: string, validIds: ReadonlySet<string>): Set<string> {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        throw new Error("文件不是有效的 JSON，请选择导出的阅读进度文件。");
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("阅读进度格式不正确，请选择导出的阅读进度文件。");
    }

    const progress = value as Record<string, unknown>;
    const keys = Object.keys(progress);
    if (keys.length !== 3 || !keys.every((key) => ["schemaVersion", "catalog", "readIds"].includes(key))) {
        throw new Error("阅读进度字段不正确，需要 schemaVersion、catalog 和 readIds。");
    }
    if (progress.schemaVersion !== 1 || progress.catalog !== "song-paintings") {
        throw new Error("这不是受支持的宋画全集阅读进度文件。");
    }
    if (!Array.isArray(progress.readIds) || !progress.readIds.every((id) => typeof id === "string" && id.length > 0)) {
        throw new Error("阅读进度中的作品编号格式不正确。");
    }

    const ids = new Set<string>(progress.readIds);
    if (ids.size !== progress.readIds.length) {
        throw new Error("阅读进度包含重复的作品编号，请检查文件。");
    }
    const unknownIds = [...ids].filter((id) => !validIds.has(id));
    if (unknownIds.length > 0) {
        throw new Error(`阅读进度包含 ${unknownIds.length} 个当前目录中不存在的作品编号，请检查文件版本。`);
    }

    return ids;
}
