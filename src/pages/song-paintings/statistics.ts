import type { Artwork } from "./model";

export interface StatGroup {
    id: string;
    label: string;
    total: number;
    read: number;
    /** A percentage between 0 and 100; display rounding belongs to the caller. */
    percent: number;
}

export interface ReadingStatistics {
    total: number;
    read: number;
    unread: number;
    percent: number;
    editions: StatGroup[];
    volumes: StatGroup[];
    artists: StatGroup[];
    collections: StatGroup[];
    periods: StatGroup[];
    books: StatGroup[];
}

type GroupMap = Map<string, StatGroup>;

const percent = (read: number, total: number) => total === 0 ? 0 : read / total * 100;
const newGroup = (id: string, label: string): StatGroup => ({ id, label, total: 0, read: 0, percent: 0 });

function add(groups: GroupMap, id: string, label: string, read: boolean) {
    let group = groups.get(id);
    if (!group) {
        group = newGroup(id, label);
        groups.set(id, group);
    }
    group.total += 1;
    if (read) group.read += 1;
}

function addText(groups: GroupMap, kind: string, value: string | null | undefined, fallback: string, read: boolean) {
    const label = typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
    add(groups, label ? `${kind}:${label}` : `${kind}:missing`, label || fallback, read);
}

function finish(groups: GroupMap): StatGroup[] {
    return [...groups.values()].map((group) => ({ ...group, percent: percent(group.read, group.total) }));
}

export function sortByTotal(groups: readonly StatGroup[]): StatGroup[] {
    return [...groups].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "zh-CN") || a.id.localeCompare(b.id));
}

/** Aggregate the complete catalog; callers should not pass a filtered table page. */
export function buildReadingStats(artworks: readonly Artwork[]): ReadingStatistics {
    const editions: GroupMap = new Map([
        ["domestic", newGroup("domestic", "国内版")],
        ["overseas", newGroup("overseas", "海外版")],
    ]);
    const volumes: GroupMap = new Map(Array.from({ length: 8 }, (_, index) => {
        const volume = index + 1;
        return [String(volume), newGroup(String(volume), `第 ${volume} 卷`)];
    }));
    const artists: GroupMap = new Map();
    const collections: GroupMap = new Map();
    const periods: GroupMap = new Map();
    const books: GroupMap = new Map();
    let read = 0;

    for (const artwork of artworks) {
        const hasRead = artwork.read === true;
        if (hasRead) read += 1;
        add(editions, artwork.edition, artwork.edition === "domestic" ? "国内版" : "海外版", hasRead);
        add(volumes, String(artwork.volume), `第 ${artwork.volume} 卷`, hasRead);
        addText(artists, "artist", artwork.artist, "未标注作者", hasRead);
        addText(collections, "collection", artwork.collection, "未标注馆藏", hasRead);
        addText(periods, "period", artwork.period, "未标注年代", hasRead);
        add(books, `${artwork.volume}-${artwork.book}`, `第 ${artwork.volume} 卷 · 第 ${artwork.book} 册`, hasRead);
    }

    return {
        total: artworks.length,
        read,
        unread: artworks.length - read,
        percent: percent(read, artworks.length),
        editions: finish(editions),
        volumes: finish(volumes).sort((a, b) => Number(a.id) - Number(b.id)),
        artists: sortByTotal(finish(artists)),
        collections: sortByTotal(finish(collections)),
        periods: sortByTotal(finish(periods)),
        books: finish(books).sort((a, b) => {
            const [aVolume, aBook] = a.id.split("-").map(Number);
            const [bVolume, bBook] = b.id.split("-").map(Number);
            return aVolume - bVolume || aBook - bBook;
        }),
    };
}
