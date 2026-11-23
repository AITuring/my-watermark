import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/pages/puzzle/import-files.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const {isPuzzleImageFile} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
for (const name of ['成片.jpg','DSC00296.JPG','成片.jpeg','透明.png','大图.TIFF','图片.webp']) {
    assert.equal(isPuzzleImageFile({name,type:''}),true);
    assert.equal(isPuzzleImageFile({name,type:'application/octet-stream'}),true);
}
for (const name of ['._成片.jpg','目录/._DSC00296.JPG','__MACOSX/图片.jpg','文件.txt','文件.pdf']) assert.equal(isPuzzleImageFile({name}),false);
console.log('Puzzle import file checks passed');
