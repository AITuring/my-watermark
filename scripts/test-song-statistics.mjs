import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../src/pages/song-paintings/statistics.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { buildReadingStats, sortByTotal } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const catalog = JSON.parse(await readFile(new URL("../src/pages/song-paintings/catalog.json", import.meta.url), "utf8"));
const make = (id, override = {}) => ({
    id, sequence: 1, title: "秋江图", artist: "马远", period: "南宋", volume: 1, book: 1,
    page: null, collection: "故宫博物院藏", catalogPdfPage: null, edition: "domestic", ...override,
});
const fixture = [
    make("a", { read: true }),
    make("b", { volume: 1, book: 2, read: false }),
    make("c", { volume: 4, book: 1, edition: "overseas", artist: "马远", collection: "海外馆藏", read: true }),
    make("d", { volume: 4, book: 1, edition: "overseas", artist: null, period: "", collection: "", read: true }),
    make("e", { volume: 4, book: 2, edition: "overseas", artist: "  ", period: null, collection: null, read: "true" }),
    make("f", { volume: 1, book: 2, artist: "夏圭", read: 1 }),
];

test("only boolean true counts as read; totals and every dimension reconcile", () => {
    const snapshot = JSON.stringify(fixture);
    const stats = buildReadingStats(fixture);
    assert.deepEqual({ total: stats.total, read: stats.read, unread: stats.unread, percent: stats.percent }, { total: 6, read: 3, unread: 3, percent: 50 });
    for (const dimension of ["editions", "volumes", "artists", "collections", "periods", "books"]) {
        assert.equal(stats[dimension].reduce((sum, group) => sum + group.total, 0), stats.total, dimension);
        assert.equal(stats[dimension].reduce((sum, group) => sum + group.read, 0), stats.read, dimension);
        assert.ok(stats[dimension].every((group) => Number.isFinite(group.percent) && group.percent >= 0 && group.percent <= 100));
    }
    assert.equal(JSON.stringify(fixture), snapshot, "statistics must not mutate the source catalog");
});

test("same author merges across volumes; missing labels remain explicit groups", () => {
    const stats = buildReadingStats(fixture);
    assert.deepEqual(stats.artists.find((group) => group.label === "马远"), { id: "artist:马远", label: "马远", total: 3, read: 2, percent: 2 / 3 * 100 });
    assert.deepEqual(stats.artists.find((group) => group.id === "artist:missing"), { id: "artist:missing", label: "未标注作者", total: 2, read: 1, percent: 50 });
    assert.equal(stats.collections.find((group) => group.id === "collection:missing").total, 2);
    assert.equal(stats.periods.find((group) => group.id === "period:missing").total, 2);
    assert.equal(stats.artists[0].label, "马远");
});

test("book identity includes the volume and sorting follows numeric volume/book order", () => {
    const stats = buildReadingStats(fixture);
    assert.deepEqual(stats.books.map((group) => [group.id, group.total, group.read]), [["1-1", 1, 1], ["1-2", 2, 0], ["4-1", 2, 2], ["4-2", 1, 0]]);
    assert.equal(stats.volumes.length, 8);
    assert.deepEqual(stats.volumes.map((group) => group.id), ["1", "2", "3", "4", "5", "6", "7", "8"]);
    assert.deepEqual(stats.editions.map((group) => [group.id, group.total, group.read]), [["domestic", 3, 1], ["overseas", 3, 2]]);
});

test("empty catalog and zero-read/all-read boundaries never produce NaN or a wrong ring fraction", () => {
    const empty = buildReadingStats([]);
    assert.deepEqual([empty.total, empty.read, empty.unread, empty.percent], [0, 0, 0, 0]);
    assert.ok([...empty.editions, ...empty.volumes].every((group) => group.total === 0 && group.read === 0 && group.percent === 0));
    assert.deepEqual(empty.artists, []);
    for (const read of [false, true]) {
        const stats = buildReadingStats(fixture.map((artwork) => ({ ...artwork, read })));
        assert.equal(stats.read, read ? fixture.length : 0);
        assert.equal(stats.percent, read ? 100 : 0);
        for (const dimension of ["editions", "volumes", "artists", "collections", "periods", "books"]) {
            assert.ok(stats[dimension].every((group) => group.percent === (read && group.total ? 100 : 0)));
        }
    }
});

test("rankings use total catalog coverage, preserve every group, and do not mutate ordered book rows", () => {
    const stats = buildReadingStats(fixture);
    const before = stats.books.map((group) => group.id);
    const ranked = sortByTotal(stats.books);
    assert.deepEqual(ranked.map((group) => group.total), [2, 2, 1, 1]);
    assert.deepEqual(stats.books.map((group) => group.id), before);
    assert.deepEqual(new Set(ranked.map((group) => group.id)), new Set(before));
});

test("real catalog keeps the 451/647 split, eight volumes and 31 separate books", () => {
    const stats = buildReadingStats(catalog.artworks.map((artwork, index) => ({ ...artwork, read: index === 0 || index === 1097 })));
    assert.deepEqual([stats.total, stats.read, stats.unread], [1098, 2, 1096]);
    assert.deepEqual(stats.editions.map((group) => group.total), [451, 647]);
    assert.equal(stats.volumes.length, 8);
    assert.equal(stats.books.length, 31);
    assert.equal(stats.artists.find((group) => group.id === "artist:missing").total, 2);
    assert.equal(stats.volumes.reduce((sum, group) => sum + group.read, 0), 2);
    assert.equal(stats.books.reduce((sum, group) => sum + group.read, 0), 2);
});
