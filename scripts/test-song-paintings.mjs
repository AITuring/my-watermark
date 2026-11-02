import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

// Compile the dependency-free model in memory so this also runs on Node 22,
// without installing a TypeScript test runner or emitting build files.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../src/pages/song-paintings/model.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { filterArtworks, parseProgress, createProgress } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const catalog = JSON.parse(await readFile(new URL("../src/pages/song-paintings/catalog.json", import.meta.url), "utf8"));
const all = { edition: "all", volume: null, book: null, reading: "all", query: "" };
const validIds = new Set(catalog.artworks.map((artwork) => artwork.id));

test("catalog preserves all 1,098 records and the requested domestic/overseas partition", () => {
    assert.equal(catalog.schemaVersion, 1);
    assert.equal(catalog.artworks.length, 1098);
    assert.equal(validIds.size, 1098);
    const domestic = filterArtworks(catalog.artworks, { ...all, edition: "domestic" }, new Set());
    const overseas = filterArtworks(catalog.artworks, { ...all, edition: "overseas" }, new Set());
    assert.equal(domestic.length, 451);
    assert.equal(overseas.length, 647);
    assert.deepEqual([...new Set(domestic.map((artwork) => artwork.volume))].sort(), [1, 2, 3, 5]);
    assert.deepEqual([...new Set(overseas.map((artwork) => artwork.volume))].sort(), [4, 6, 7, 8]);
    assert.equal(new Set(catalog.artworks.map((artwork) => `${artwork.volume}-${artwork.book}`)).size, 31);
    assert.equal(catalog.artworks.filter((artwork) => artwork.volume === 1).length, 254);
});

test("volume and book filters intersect with edition without changing source order", () => {
    const expected = catalog.artworks.filter((artwork) => artwork.volume === 1 && artwork.book === 2);
    assert.ok(expected.length > 0);
    assert.deepEqual(filterArtworks(catalog.artworks, { ...all, volume: 1, book: 2 }, new Set()), expected);
    assert.deepEqual(filterArtworks(catalog.artworks, { ...all, edition: "overseas", volume: 1 }, new Set()), []);
    assert.deepEqual(filterArtworks(catalog.artworks, { ...all, volume: 999 }, new Set()), []);
});

test("search matches all query words across title, artist, period and collection", () => {
    const fixture = [{
        id: "a", sequence: 1, title: "秋 江图", artist: "马远", period: "南宋",
        collection: "Museum A", volume: 1, book: 1, page: null, catalogPdfPage: null, edition: "domestic",
    }, {
        id: "b", sequence: 2, title: "春江图", artist: "马远", period: "南宋",
        collection: "Museum B", volume: 4, book: 1, page: null, catalogPdfPage: null, edition: "overseas",
    }];
    assert.deepEqual(filterArtworks(fixture, { ...all, query: "  马远\t秋\nＭＵＳＥＵＭ  " }, new Set()).map((artwork) => artwork.id), ["a"]);
    assert.equal(filterArtworks(fixture, { ...all, query: "南宋" }, new Set()).length, 2);
    assert.equal(filterArtworks(fixture, { ...all, query: "\n \t" }, new Set()).length, 2);
    assert.deepEqual(filterArtworks(fixture, { ...all, query: "秋 Museum B" }, new Set()), []);
});

test("reading filters follow stable IDs across searches and export/import round trips", () => {
    const read = new Set([catalog.artworks[0].id, catalog.artworks.at(-1).id]);
    assert.deepEqual(filterArtworks(catalog.artworks, { ...all, reading: "read" }, read).map((artwork) => artwork.id), [...read]);
    assert.equal(filterArtworks(catalog.artworks, { ...all, reading: "unread" }, read).length, 1096);
    assert.equal(filterArtworks(catalog.artworks, { ...all, reading: "read" }, new Set()).length, 0);
    assert.deepEqual(parseProgress(JSON.stringify(createProgress(read)), validIds), read);
    assert.deepEqual(parseProgress(JSON.stringify(createProgress(new Set())), validIds), new Set());
});

test("invalid or foreign progress is rejected instead of silently losing saved records", () => {
    const valid = createProgress(new Set([catalog.artworks[0].id]));
    assert.throws(() => parseProgress("not json", validIds), /有效的 JSON/);
    for (const value of [null, [], false, 1, "text"]) {
        assert.throws(() => parseProgress(JSON.stringify(value), validIds), /格式不正确/);
    }
    assert.throws(() => parseProgress(JSON.stringify({ ...valid, extra: 1 }), validIds), /字段不正确/);
    assert.throws(() => parseProgress(JSON.stringify({ ...valid, schemaVersion: 2 }), validIds), /不支持|受支持/);
    assert.throws(() => parseProgress(JSON.stringify({ ...valid, catalog: "other" }), validIds), /受支持/);
    assert.throws(() => parseProgress(JSON.stringify({ ...valid, readIds: [12] }), validIds), /编号格式/);
    assert.throws(() => parseProgress(JSON.stringify({ ...valid, readIds: [""] }), validIds), /编号格式/);
    assert.throws(() => parseProgress(JSON.stringify({ ...valid, readIds: [valid.readIds[0], valid.readIds[0]] }), validIds), /重复/);
    assert.throws(() => parseProgress(JSON.stringify({ ...valid, readIds: ["missing-artwork"] }), validIds), /不存在/);
});
