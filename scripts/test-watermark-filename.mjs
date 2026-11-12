import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/pages/watermark/filename-watermark.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { extractWatermarkCaption: extract } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('韩休墓 filename keeps only the artwork name and formats the requested caption', () => {
    assert.deepEqual(extract('唐-韩休墓北壁《山水图》-2013年西安少陵原唐韩休墓出土-陕西历史博物馆藏-未标题-215.jpg'), {
        textLine1: '韩休墓北壁《山水图》',
        textLine2: '唐·陕西历史博物馆藏 / 笑谈间气吐霓虹摄',
    });
});

test('separator variants and export suffixes keep the same caption', () => {
    for (const separator of ['-', '－', '—', '–', '_']) {
        for (const suffix of ['未标题-215', '未命名 215', '无标题', '215', '215logo-split-3', 'DSC_0215']) {
            assert.deepEqual(extract(['唐', '韩休墓北壁《山水图》', '2013年西安少陵原唐韩休墓出土', '陕西历史博物馆藏', suffix].join(separator) + '.JPG'), {
                textLine1: '韩休墓北壁《山水图》',
                textLine2: '唐·陕西历史博物馆藏 / 笑谈间气吐霓虹摄',
            });
        }
    }
});

test('provenance and placeholders do not leak into a title on either side of the collection', () => {
    assert.deepEqual(extract('汉-陶俑-未标题-215-陕西历史博物馆藏-出土地：西安-1956年发掘.jpg'), {
        textLine1: '陶俑',
        textLine2: '汉·陕西历史博物馆藏 / 笑谈间气吐霓虹摄',
    });
});

test('explicit photographer overrides the default without duplicating the credit', () => {
    for (const credit of ['张三摄', '张三摄影', '摄影：张三', '拍摄: 张三']) {
        assert.deepEqual(extract(`唐-壁画-陕西历史博物馆藏-${credit}.jpg`), {
            textLine1: '壁画', textLine2: '唐·陕西历史博物馆藏 / 张三摄',
        });
    }
});

test('explicit artist belongs in the description and title punctuation stays intact', () => {
    assert.deepEqual(extract('南宋-作者：马远-《梅石-溪凫图》-故宫博物院藏.jpg'), {
        textLine1: '《梅石-溪凫图》',
        textLine2: '南宋·马远·故宫博物院藏 / 笑谈间气吐霓虹摄',
    });
});

test('missing era or collection does not leave dangling punctuation or invent metadata', () => {
    assert.deepEqual(extract('唐-壁画.jpg'), { textLine1: '壁画', textLine2: '唐 / 笑谈间气吐霓虹摄' });
    assert.deepEqual(extract('壁画-陕西历史博物馆藏.jpg'), {
        textLine1: '壁画', textLine2: '陕西历史博物馆藏 / 笑谈间气吐霓虹摄',
    });
    assert.deepEqual(extract('唐-未标题图卷-215.jpg'), { textLine1: '未标题图卷', textLine2: '唐 / 笑谈间气吐霓虹摄' });
});

test('camera names, placeholders and metadata alone do not create artwork captions', () => {
    for (const filename of ['DSC_0215.jpg', 'IMG-20261112-001.jpg', 'PXL_20261112.jpg', 'DSCF1234.jpg',
        '2026-11-12.jpg', '普通照片.jpg', '唐-陕西历史博物馆藏-未标题-215.jpg', '唐-2013年西安出土-215.jpg']) {
        assert.equal(extract(filename), null, filename);
    }
});

test('collection is a hard title boundary, including arbitrary notes and unknown photo names', () => {
    for (const suffix of ['合成图层清晰度差一些-tm_20261112_001', '颜色好但尺寸小-原始照片',
        '高清修复版-扫描01', 'tm i n', '底片翻拍-任意命名', 'DSC_1234', 'IMG-2026-11-12', '']) {
        assert.deepEqual(extract(`北宋-祁序《江山放牧图卷》-故宫博物院藏-${suffix}.jpg`), {
            textLine1: '《江山放牧图卷》',
            textLine2: '北宋·祁序·故宫博物院藏 / 笑谈间气吐霓虹摄',
        }, suffix);
    }
});

test('author can precede a quoted title in the same field or a separate field', () => {
    for (const name of ['祁序《江山放牧图卷》', '祁序-《江山放牧图卷》', '祁序-江山放牧图卷', '祁序江山放牧图卷']) {
        assert.deepEqual(extract(`北宋-${name}-故宫博物院藏-备注-原始照片.jpg`), {
            textLine1: name.includes('《') ? '《江山放牧图卷》' : '江山放牧图卷',
            textLine2: '北宋·祁序·故宫博物院藏 / 笑谈间气吐霓虹摄',
        }, name);
    }
});

test('optional author does not remove architectural context or append remarks to a title', () => {
    for (const title of ['韩休墓北壁《山水图》', '墓室北壁《山水图》', '北壁《山水图》', '《山水图》', '山水图', '陶俑']) {
        assert.deepEqual(extract(`唐-${title}-陕西历史博物馆藏-合成图层清晰度差一些-tmp1234.jpg`), {
            textLine1: title, textLine2: '唐·陕西历史博物馆藏 / 笑谈间气吐霓虹摄',
        }, title);
    }
    assert.equal(extract('汉-陶俑-局部-陕西历史博物馆藏-IMG_001.jpg').textLine1, '陶俑');
});

test('quoted and separately delimited artists do not require a hardcoded artist name', () => {
    for (const work of ['陈某某《松林图》', '陈某某-《松林图》', '陈某某-松林图']) {
        const result = extract(`明-${work}-上海博物馆藏-DSC_0001.jpg`);
        assert.equal(result.textLine1, work.includes('《') ? '《松林图》' : '松林图');
        assert.equal(result.textLine2, '明·陈某某·上海博物馆藏 / 笑谈间气吐霓虹摄');
    }
});

test('unquoted combined artists, attribution and different periods are supported', () => {
    for (const [period, work, artist, title] of [
        ['南宋', '马远梅石溪凫图', '马远', '梅石溪凫图'],
        ['元', '赵孟頫《秋声赋卷》', '赵孟頫', '《秋声赋卷》'],
        ['明', '文徵明山水图', '文徵明', '山水图'],
        ['清', '八大山人《荷花图》', '八大山人', '《荷花图》'],
        ['五代', '顾闳中（传）《韩熙载夜宴图》', '顾闳中（传）', '《韩熙载夜宴图》'],
        ['南宋', '马远（传）梅石溪凫图', '马远（传）', '梅石溪凫图'],
    ]) {
        assert.deepEqual(extract(`${period}-${work}-故宫博物院藏-照片.jpg`), {
            textLine1: title, textLine2: `${period}·${artist}·故宫博物院藏 / 笑谈间气吐霓虹摄`,
        });
    }
});

test('collection and author without a work do not invent titles from later remarks', () => {
    for (const work of ['', '祁序', '祁序（传）', '未标题', 'DSC_0001']) {
        assert.equal(extract(`北宋-${work}-故宫博物院藏-合成图层清晰度差一些-真实照片.jpg`), null);
    }
});
