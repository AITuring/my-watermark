import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const source = await readFile(new URL('../src/pages/watermark/preview-zoom.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
const api = {}; vm.runInNewContext(code, {exports: api});

test('zoom keeps the same image point in the viewport center, including after panning', () => {
    const before = {x: -120, y: 60}, width = 800, height = 500;
    const after = api.zoomAroundCenter(before, 1.5, 3, width, height);
    assert.equal((width / 2 - before.x) / 1.5, (width / 2 - after.x) / 3);
    assert.equal((height / 2 - before.y) / 1.5, (height / 2 - after.y) / 3);
    const reset = api.zoomAroundCenter(after, 3, 1, width, height);
    assert.equal(reset.x, 0); assert.equal(reset.y, 0);
});
