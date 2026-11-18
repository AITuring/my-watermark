import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/watermark/caption-corrections.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('correction lookup supports exact and normalized photo suffixes', () => {
    const file='3—6世纪秘鲁莫切文化-串珠-大都会艺术博物馆藏-DSC01364_1.jpg';
    let map=api.setCaptionCorrection({},file,{textLine1:'串珠',textLine2:'手动说明'});
    assert.deepEqual(api.getCaptionCorrection(map,file),{textLine1:'串珠',textLine2:'手动说明'});
    assert.deepEqual(api.getCaptionCorrection(map,'3—6世纪秘鲁莫切文化-串珠-大都会艺术博物馆藏-DSC09999.jpg'),{textLine1:'串珠',textLine2:'手动说明'});
});

test('corrections merge fields and can be cleared for reset-to-automatic', () => {
    const file='唐-凤凰头饰-大都会艺术博物馆藏-DSC01631.jpg';
    let map=api.setCaptionCorrection({},file,{textLine1:'凤凰头饰'});
    map=api.setCaptionCorrection(map,file,{textLine2:'唐·大都会艺术博物馆藏'});
    assert.deepEqual(api.getCaptionCorrection(map,file),{textLine1:'凤凰头饰',textLine2:'唐·大都会艺术博物馆藏'});
    assert.deepEqual(api.getCaptionCorrection(api.clearCaptionCorrection(map,file),file),undefined);
});
