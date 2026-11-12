import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const source = await readFile(new URL('../src/utils/preview-url-lease.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
const api = {};
vm.runInNewContext(code, {exports: api, URL, fetch, setTimeout, clearTimeout});
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
const makeUrl = () => URL.createObjectURL(new Blob(['original image bytes']));

test('effect cleanup/reconnect keeps every live preview available', async () => {
    const urls = Array.from({length: 24}, makeUrl);
    const lease = new api.PreviewUrlLease();
    lease.retain(urls);
    // StrictMode / Fast Refresh: cleanup followed by setup with preserved state.
    for (let i = 0; i < 3; i++) {
        lease.release();
        lease.retain(urls);
        await settle();
    }
    for (const url of urls) assert.equal(await api.isPreviewUrlAvailable(url), true);
    lease.release();
    await settle();
    for (const url of urls) assert.equal(await api.isPreviewUrlAvailable(url), false);
});

test('removing one image releases only its URL; changing selection releases none', async () => {
    const [first, second, third] = Array.from({length: 3}, makeUrl);
    const lease = new api.PreviewUrlLease();
    lease.retain([first, second, third]);
    lease.release();
    lease.retain([third, first, second]);
    assert.equal(await api.isPreviewUrlAvailable(second), true);
    lease.retain([first, third]);
    assert.equal(await api.isPreviewUrlAvailable(second), false);
    assert.equal(await api.isPreviewUrlAvailable(first), true);
    assert.equal(await api.isPreviewUrlAvailable(third), true);
    lease.release();
    await settle();
});

test('revoked previews are detected and a new URL from the retained file recovers bytes', async () => {
    const file = new Blob(['retained original']);
    const stale = URL.createObjectURL(file);
    URL.revokeObjectURL(stale);
    assert.equal(await api.isPreviewUrlAvailable(stale), false);
    const recovered = await api.recoverPreviewUrl(stale, async () => URL.createObjectURL(file));
    assert.equal(await api.isPreviewUrlAvailable(recovered), true);
    assert.equal(await (await fetch(recovered)).text(), 'retained original');
    assert.equal(await api.recoverPreviewUrl(recovered, async () => assert.fail('valid previews must be retained')), undefined);
    URL.revokeObjectURL(recovered);
    assert.equal(await api.isPreviewUrlAvailable('/large-image-service/preview/1'), true);
});
