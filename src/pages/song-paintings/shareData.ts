import type { Artwork } from "./model";
import { buildReadingStats, type ReadingStatistics, type StatGroup } from "./statistics";

export type ShareScope = "all" | "domestic" | "overseas";

export const SHARE_SCOPES: readonly { value: ShareScope; label: string }[] = [
    { value: "all", label: "综合" },
    { value: "domestic", label: "国内版" },
    { value: "overseas", label: "海外版" },
];

export interface ShareCoverage {
    /** Number of named catalog groups containing at least one read artwork. */
    read: number;
    total: number;
}

export interface ShareData {
    scope: ShareScope;
    scopeLabel: string;
    stats: ReadingStatistics;
    /** Sorted by read count first, then by the number of catalogued artworks. */
    collections: StatGroup[];
    /** Only editions containing works in the selected source. */
    editionProgress: StatGroup[];
    collectionCoverage: ShareCoverage;
}

function collectionName(value: string | null | undefined): string {
    const label = typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
    // A collection's trailing 藏 is a catalog suffix, not a different institution.
    if (label === "私人藏") return "私人收藏";
    const name = label.endsWith("收藏") ? label : label.replace(/藏$/u, "");
    // Volumes 6 and 8 use different dashes for this same museum. Keep this
    // correction specific rather than merging punctuation in unrelated names.
    return /^纳尔逊[—－–-]阿特金斯艺术博物馆$/u.test(name) ? "纳尔逊—阿特金斯艺术博物馆" : name;
}

function coverage(groups: readonly StatGroup[], missingId: string): ShareCoverage {
    const named = groups.filter((group) => group.id !== missingId);
    return { read: named.filter((group) => group.read > 0).length, total: named.length };
}

function rankByRead(groups: readonly StatGroup[]): StatGroup[] {
    return [...groups].sort((a, b) => b.read - a.read || b.total - a.total || a.label.localeCompare(b.label, "zh-CN") || a.id.localeCompare(b.id));
}

/** Share scopes follow the catalog editions, including volume 8 in the overseas edition. */
export function buildShareData(artworks: readonly Artwork[], scope: ShareScope = "all"): ShareData {
    const choice = SHARE_SCOPES.find((item) => item.value === scope);
    if (!choice) throw new Error("请选择综合、国内版或海外版作为分享数据源。");
    const selected = artworks
        .filter((artwork) => scope === "all" || artwork.edition === scope)
        .map((artwork) => ({ ...artwork, collection: collectionName(artwork.collection) }));
    const stats = buildReadingStats(selected);

    return {
        scope,
        scopeLabel: choice.label,
        stats,
        collections: rankByRead(stats.collections),
        editionProgress: stats.editions.filter((group) => group.total > 0),
        collectionCoverage: coverage(stats.collections, "collection:missing"),
    };
}

/**
 * Keep the first `limit` groups in the caller's chosen order, plus one remainder.
 * The remainder is a weighted aggregate, never an average of group percentages.
 */
export function collapseShareGroups(groups: readonly StatGroup[], limit: number, otherLabel = "其他馆藏地"): StatGroup[] {
    if (!Number.isInteger(limit) || limit < 0) throw new Error("图表分组数量必须是非负整数。");
    const visible = groups.slice(0, limit).map((group) => ({ ...group }));
    if (groups.length <= limit) return visible;

    const remaining = groups.slice(limit);
    const total = remaining.reduce((sum, group) => sum + group.total, 0);
    const read = remaining.reduce((sum, group) => sum + group.read, 0);
    // Use a reserved, unique identity even if a source group is itself named “其他”.
    let id = "share:remainder";
    while (groups.some((group) => group.id === id)) id += ":other";
    visible.push({ id, label: otherLabel, total, read, percent: total === 0 ? 0 : read / total * 100 });
    return visible;
}
