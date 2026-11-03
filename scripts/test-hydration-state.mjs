import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = async (path) => ts.transpileModule(
    (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("import.meta.env.DEV", "false"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const [modelCode, catalogCode, themeCode] = await Promise.all([
    compile("../src/pages/song-paintings/model.ts"),
    compile("../src/pages/song-paintings/useCatalog.ts"),
    compile("../src/hooks/useDark/index.ts"),
]);
const model = {};
vm.runInNewContext(modelCode, { exports: model, Error });
const fixture = { schemaVersion: 1, artworks: [{ id: "a", read: true }, { id: "b", read: false }] };

// Exercise the hook's render/effect boundary without adding a DOM test runtime.
function environment(code, { saved = new Map(), storageError = null } = {}) {
    const slots = [];
    let cursor = 0;
    let pending = [];
    const counts = { reads: 0, writes: 0, transitions: 0 };
    const browserWindow = new EventTarget();
    const document = new EventTarget();
    const classes = new Set();
    document.documentElement = { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } };
    const changed = (before, next) => !before || before.length !== next.length || before.some((value, index) => !Object.is(value, next[index]));
    const react = {
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
            return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
        },
        useRef(initial) {
            const index = cursor++;
            return slots[index] ??= { current: initial };
        },
        useEffect(effect, deps) {
            const index = cursor++;
            if (changed(slots[index]?.deps, deps)) {
                pending.push(() => {
                    slots[index]?.cleanup?.();
                    slots[index] = { deps, cleanup: effect() };
                });
            }
        },
        useCallback(callback, deps) {
            const index = cursor++;
            if (changed(slots[index]?.deps, deps)) slots[index] = { deps, callback };
            return slots[index].callback;
        },
        startTransition(callback) { counts.transitions += 1; callback(); },
    };
    const exports = {};
    vm.runInNewContext(code, {
        exports, Error, Date,
        require: (name) => name === "react" ? react : model,
        window: browserWindow, document, navigator: {},
        setInterval: () => 1, clearInterval: () => {},
        localStorage: {
            getItem(key) { counts.reads += 1; if (storageError) throw storageError; return saved.get(key) ?? null; },
            setItem(key, value) { counts.writes += 1; if (storageError) throw storageError; saved.set(key, value); },
        },
    });
    return {
        exports, counts, saved, classes,
        render(callback) { cursor = 0; return callback(exports); },
        effects() { const effects = pending; pending = []; effects.forEach((effect) => effect()); },
        storageEvent(key = model.VISITOR_STORAGE_KEY) {
            const event = new Event("storage");
            event.key = key;
            browserWindow.dispatchEvent(event);
        },
    };
}

test("visitor hydration starts without storage and restores progress before enabling edits", async () => {
    const saved = new Map([[model.VISITOR_STORAGE_KEY, JSON.stringify(model.createProgress(new Set(["b"])))]]);
    const env = environment(catalogCode, { saved });
    const render = (source = fixture) => env.render(({ useCatalog }) => useCatalog(source, "visitor"));
    let result = render();
    assert.deepEqual([...result.readIds], []);
    assert.equal(result.warning, "");
    assert.equal(result.canEditReading, false);
    assert.equal(await result.toggleRead("a", true), false);
    assert.equal(await result.mergeProgress(new Set(["a"])), false);
    assert.deepEqual(env.counts, { reads: 0, writes: 0, transitions: 0 });
    env.effects();
    result = render();
    assert.deepEqual([...result.readIds], ["b"]);
    assert.equal(result.canEditReading, true);
    assert.equal(env.counts.writes, 0);
    await result.toggleRead("a", true);
    assert.deepEqual([...render().readIds].sort(), ["a", "b"]);
    assert.deepEqual(JSON.parse(saved.get(model.VISITOR_STORAGE_KEY)).readIds.sort(), ["a", "b"]);
    const updated = { ...fixture, artworks: fixture.artworks.map((artwork) => ({ ...artwork, title: "updated" })) };
    render(updated);
    env.effects();
    assert.deepEqual([...render(updated).readIds].sort(), ["a", "b"]);
    saved.set(model.VISITOR_STORAGE_KEY, JSON.stringify(model.createProgress(new Set(["a"]))));
    env.storageEvent();
    assert.deepEqual([...render(updated).readIds], ["a"]);
});

test("corrupt saved progress stays untouched and blocks reading edits after restoration", async () => {
    const saved = new Map([[model.VISITOR_STORAGE_KEY, "invalid json"]]);
    const env = environment(catalogCode, { saved });
    const render = () => env.render(({ useCatalog }) => useCatalog(fixture, "visitor"));
    assert.equal(render().warning, "");
    env.effects();
    const result = render();
    assert.equal(result.canEditReading, false);
    assert.match(result.warning, /无法读取/);
    assert.equal(await result.toggleRead("a", true), false);
    assert.equal(saved.get(model.VISITOR_STORAGE_KEY), "invalid json");
    assert.equal(env.counts.writes, 0);
});

test("denied storage preserves in-memory edits when another tab changes progress", async () => {
    const storageError = new Error("denied");
    storageError.name = "SecurityError";
    const env = environment(catalogCode, { storageError });
    const render = () => env.render(({ useCatalog }) => useCatalog(fixture, "visitor"));
    render();
    env.effects();
    let result = render();
    assert.equal(result.canEditReading, true);
    assert.match(result.warning, /无法保存/);
    assert.equal(await result.toggleRead("b", true), true);
    env.storageEvent();
    result = render();
    assert.deepEqual([...result.readIds], ["b"]);
    assert.match(result.warning, /未保存/);
});

test("theme hydration defers saved preferences without writing the default over them", () => {
    const saved = new Map([["theme_preference", "dark"], ["theme_preference_time", String(Date.now() + 1000)]]);
    const env = environment(themeCode, { saved });
    const render = () => env.render(({ default: useDark }) => useDark());
    assert.equal(render()[0], false);
    assert.equal(env.counts.reads, 0);
    env.effects();
    assert.equal(render()[0], true);
    env.effects();
    assert.equal(env.classes.has("dark"), true);
    assert.equal(env.counts.transitions, 1);
    assert.equal(env.counts.writes, 0);
    assert.equal(saved.get("theme_preference"), "dark");
});

test("theme preference failures do not prevent the page mounting or toggling", () => {
    const env = environment(themeCode, { storageError: new Error("denied") });
    const render = () => env.render(({ default: useDark }) => useDark());
    render();
    assert.doesNotThrow(() => env.effects());
    const [before, toggle] = render();
    assert.doesNotThrow(toggle);
    assert.equal(render()[0], !before);
});
