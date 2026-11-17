import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true},
}).outputText;
const names = {};
vm.runInNewContext(await compile('../src/pages/watermark/export-names.ts'), {exports: names});
const api = {};
let zipLoads = 0;
vm.runInNewContext(await compile('../src/pages/watermark/export-downloads.ts'), {
    exports: api, File, setTimeout,
    require: name => {
        if (name === './export-names') return names;
        if (name === '@/utils/import-recovery') return {importWithRecovery: loader => loader()};
        if (name === 'jszip') {zipLoads++; return require(name);}
        throw new Error(`Unexpected import ${name}`);
    },
});
const makeFile = (name, content, type = 'image/jpeg') => new File([content], name, {type});

test('ZIP mode emits one readable archive with every file and collision-safe names', async () => {
    const files = [makeFile('作品-mark.jpg', 'first'), makeFile('作品-mark.jpg', 'second')];
    const downloads = [], progress = [];
    await api.downloadWatermarkOutputs(files, 'zip', file => downloads.push(file), value => progress.push(value));
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, 'watermarks-2.zip');
    assert.equal(downloads[0].type, 'application/zip');
    const archive = await JSZip.loadAsync(await downloads[0].arrayBuffer());
    assert.deepEqual(Object.keys(archive.files), ['作品-mark.jpg', '作品-mark (2).jpg']);
    assert.equal(await archive.file('作品-mark.jpg').async('string'), 'first');
    assert.equal(await archive.file('作品-mark (2).jpg').async('string'), 'second');
    assert.equal(progress.at(-1), 100);
});

test('separate mode emits original image files without loading ZIP code or mutating the input', async () => {
    const before = zipLoads;
    const files = [makeFile('2-mark.webp', 'webp bytes', 'image/webp'), makeFile('1-mark.jpg', 'jpeg bytes')];
    const downloads = [], progress = [];
    await api.downloadWatermarkOutputs(files, 'files', file => downloads.push(file), value => progress.push(value));
    assert.deepEqual(downloads.map(file => [file.name, file.type]), [['1-mark.jpg', 'image/jpeg'], ['2-mark.webp', 'image/webp']]);
    assert.equal(await downloads[0].text(), 'jpeg bytes');
    assert.equal(await downloads[1].text(), 'webp bytes');
    assert.equal(files[0].name, '2-mark.webp');
    assert.equal(progress.at(-1), 100);
    assert.equal(zipLoads, before);
});

test('separate downloads also receive distinct filenames when originals have the same name', async () => {
    const downloads = [];
    await api.downloadWatermarkOutputs([makeFile('same.jpg', 'a'), makeFile('same.jpg', 'b')], 'files', file => downloads.push(file), () => {});
    assert.deepEqual(downloads.map(file => file.name), ['same.jpg', 'same (2).jpg']);
    assert.equal(await downloads[1].text(), 'b');
});

test('a single image stays a direct download in ZIP mode', async () => {
    const file = makeFile('single-mark.jpg', 'image');
    const downloads = [];
    await api.downloadWatermarkOutputs([file], 'zip', output => downloads.push(output), () => {});
    assert.equal(downloads[0], file);
});

test('empty output does not trigger a download', async () => {
    for (const mode of ['zip', 'files']) await api.downloadWatermarkOutputs([], mode, () => assert.fail('unexpected download'), () => {});
});
