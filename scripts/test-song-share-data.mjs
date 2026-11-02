import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compile = (source) => ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const toDataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const statisticsUrl = toDataUrl(compile(await readFile(new URL("../src/pages/song-paintings/statistics.ts", import.meta.url), "utf8")));
const shareSource = compile(await readFile(new URL("../src/pages/song-paintings/shareData.ts", import.meta.url), "utf8"));
const { buildShareData, collapseShareGroups, SHARE_SCOPES } = await import(toDataUrl(shareSource.replace('from "./statistics"', `from ${JSON.stringify(statisticsUrl)}`)));
const catalog = JSON.parse(await readFile(new URL("../src/pages/song-paintings/catalog.json", import.meta.url), "utf8"));

const make = (id, overrides = {}) => ({
    id, sequence: 1, title: "秋江图", artist: "马远", period: "宋", volume: 1, book: 1,
    page: null, catalogPdfPage: null, collection: "故宫博物院藏", edition: "domestic", read: false,
    ...overrides,
});

test("all three share sources use edition boundaries, not collection location or visible table pages", () => {
    const artworks = catalog.artworks.map((artwork, index) => ({ ...artwork, read: index % 3 === 0 }));
    const snapshot = JSON.stringify(artworks);
    assert.deepEqual(SHARE_SCOPES.map((choice) => choice.value), ["all", "domestic", "overseas"]);
    for (const [scope, total] of [["all", 1098], ["domestic", 451], ["overseas", 647]]) {
        const data = buildShareData(artworks, scope);
        const expected = artworks.filter((artwork) => scope === "all" || artwork.edition === scope);
        assert.equal(data.stats.total, total);
        assert.equal(data.stats.read, expected.filter((artwork) => artwork.read).length);
        assert.equal(data.stats.unread + data.stats.read, total);
        for (const dimension of ["collections", "artists", "periods", "books", "editions"]) {
            assert.equal(data.stats[dimension].reduce((sum, group) => sum + group.total, 0), total, `${scope}:${dimension}`);
            assert.equal(data.stats[dimension].reduce((sum, group) => sum + group.read, 0), data.stats.read, `${scope}:${dimension}`);
        }
    }
    const volume8DomesticMuseum = artworks.find((artwork) => artwork.volume === 8 && artwork.collection === "故宫博物院藏");
    assert.ok(volume8DomesticMuseum, "fixture exercises the mixed domestic/foreign supplement volume");
    assert.equal(buildShareData([volume8DomesticMuseum], "domestic").stats.total, 0);
    assert.equal(buildShareData([volume8DomesticMuseum], "overseas").stats.total, 1);
    assert.equal(JSON.stringify(artworks), snapshot, "sharing never rewrites the catalog or reading flags");
});

test("collection suffixes merge without confusing private collections or missing metadata", () => {
    const artworks = [
        make("a", { read: true }),
        make("b", { collection: " 故宫博物院 " }),
        make("c", { collection: "私人藏", read: true }),
        make("d", { collection: "私人收藏" }),
        make("e", { collection: "", artist: null, read: true }),
    ];
    const data = buildShareData(artworks);
    assert.deepEqual(data.stats.collections.find((group) => group.label === "故宫博物院"), { id: "collection:故宫博物院", label: "故宫博物院", total: 2, read: 1, percent: 50 });
    assert.deepEqual(data.stats.collections.find((group) => group.label === "私人收藏"), { id: "collection:私人收藏", label: "私人收藏", total: 2, read: 1, percent: 50 });
    assert.deepEqual(data.collectionCoverage, { read: 2, total: 2 });
    assert.deepEqual(data.artistCoverage, { read: 1, total: 1 });
    assert.equal(data.stats.collections.find((group) => group.id === "collection:missing").read, 1);
    assert.equal(data.collections.reduce((sum, group) => sum + group.read, 0), 3, "missing metadata remains in chart denominators");
});

test("collection rankings prioritize read count, break ties by catalog size, and remain independent of stats order", () => {
    const artworks = [
        ...Array.from({ length: 5 }, (_, index) => make(`a${index}`, { collection: "甲馆", read: index === 0 })),
        ...Array.from({ length: 2 }, (_, index) => make(`b${index}`, { collection: "乙馆", read: true })),
        ...Array.from({ length: 3 }, (_, index) => make(`c${index}`, { collection: "丙馆", read: index === 0 })),
    ];
    const data = buildShareData(artworks);
    assert.deepEqual(data.collections.map((group) => group.label), ["乙馆", "甲馆", "丙馆"]);
    assert.deepEqual(data.stats.collections.map((group) => group.label), ["甲馆", "丙馆", "乙馆"]);
});

test("only the confirmed Nelson-Atkins dash aliases merge, including its 22 catalogued works", () => {
    const snapshot = JSON.stringify(catalog.artworks);
    const canonicalName = "纳尔逊—阿特金斯艺术博物馆";
    for (const scope of ["all", "overseas"]) {
        const museums = buildShareData(catalog.artworks, scope).collections.filter((group) => group.label.startsWith("纳尔逊"));
        assert.equal(museums.length, 1);
        assert.equal(museums[0].label, canonicalName);
        assert.equal(museums[0].total, 22, "the 18 volume-6 works and 4 volume-8 works share one denominator");
    }
    const fixtures = [
        ...["—", "－", "–", "-"].map((dash, index) => make(`museum-${index}`, { collection: `纳尔逊${dash}阿特金斯艺术博物馆藏`, read: index !== 0 })),
        make("other-1", { collection: "其他—馆" }),
        make("other-2", { collection: "其他-馆" }),
    ];
    const data = buildShareData(fixtures);
    assert.deepEqual(data.collections.find((group) => group.label === canonicalName), { id: `collection:${canonicalName}`, label: canonicalName, total: 4, read: 3, percent: 75 });
    assert.equal(data.collections.length, 3, "punctuation in unrelated collection names stays distinct");
    assert.equal(JSON.stringify(catalog.artworks), snapshot, "source spellings remain untouched");
});

test("top groups plus remainder retain exact totals and use a weighted completion rate", () => {
    const groups = [
        { id: "a", label: "甲馆", total: 100, read: 80, percent: 80 },
        { id: "share:remainder", label: "其他馆藏地", total: 20, read: 10, percent: 50 },
        { id: "c", label: "丙馆", total: 2, read: 2, percent: 100 },
    ];
    const snapshot = JSON.stringify(groups);
    const compact = collapseShareGroups(groups, 1);
    assert.equal(compact.length, 2);
    assert.deepEqual(compact[1], { id: "share:remainder:other", label: "其他馆藏地", total: 22, read: 12, percent: 12 / 22 * 100 });
    for (const field of ["total", "read"]) assert.equal(compact.reduce((sum, group) => sum + group[field], 0), groups.reduce((sum, group) => sum + group[field], 0));
    assert.deepEqual(collapseShareGroups(groups, 3), groups);
    assert.equal(collapseShareGroups(groups, 0)[0].total, 122);
    compact[0].read = 0;
    assert.equal(JSON.stringify(groups), snapshot, "drawing can safely adjust a returned group without mutating the input");
    assert.throws(() => collapseShareGroups(groups, -1));
    assert.throws(() => collapseShareGroups(groups, NaN));
});

test("empty, unread and complete snapshots remain finite in every selected source", () => {
    for (const scope of SHARE_SCOPES.map((choice) => choice.value)) {
        const data = buildShareData([], scope);
        assert.deepEqual([data.stats.total, data.stats.read, data.stats.percent], [0, 0, 0]);
        assert.deepEqual(data.collectionCoverage, { read: 0, total: 0 });
        assert.deepEqual(collapseShareGroups(data.collections, 6), []);
    }
    for (const read of [false, true]) {
        const data = buildShareData([make("a", { read }), make("b", { read, collection: "另一馆" })]);
        assert.equal(data.stats.percent, read ? 100 : 0);
        assert.ok(data.collections.every((group) => Number.isFinite(group.percent) && group.percent === (read ? 100 : 0)));
        assert.deepEqual(data.collectionCoverage, { read: read ? 2 : 0, total: 2 });
    }
    assert.throws(() => buildShareData([], "wrong"), /数据源/);
});
