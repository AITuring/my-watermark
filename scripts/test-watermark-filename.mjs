import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/pages/watermark/filename-watermark.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { extractWatermarkCaption: extract, analyzeWatermarkCaption: analyze } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('analysis reports high confidence for the reviewed cultural filename', () => {
    const result = analyze('3—6世纪秘鲁莫切文化-串珠-大都会艺术博物馆藏-DSC01364_1.jpg');
    assert.equal(result.confidence, 'high');
    assert.deepEqual(result.caption, {textLine1:'串珠',textLine2:'3—6世纪秘鲁莫切文化·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄'});
    assert.deepEqual(result.issues, []);
});

test('analysis marks ambiguous or incomplete names for review instead of hiding uncertainty', () => {
    assert.equal(analyze('唐-壁画.jpg').confidence, 'review');
    assert.ok(analyze('唐-壁画.jpg').issues.includes('没有找到明确的馆藏字段'));
    assert.equal(analyze('DSC01364_1.jpg').confidence, 'none');
    assert.equal(analyze('唐-作者甲-作者乙-供盘-大都会艺术博物馆藏.jpg').confidence, 'review');
});

// Expected captions were reviewed against every filename in Photos-1-001;
// keep them portable so regressions run without that local folder present.
const folderCases = JSON.parse(await readFile(new URL('./fixtures/watermark-filenames.json', import.meta.url), 'utf8'));
for (const {filename, title, details} of folderCases) {
    test(`Photos-1-001: ${filename}`, () => {
        assert.deepEqual(extract(filename), title === null ? null : {
            textLine1: title, textLine2: `${details} / 笑谈间气吐霓虹摄`,
        });
    });
}

test('combined date/culture fields keep ranges across different separators', () => {
    for (const era of ['3—6世纪秘鲁莫切文化', '19世纪印度', '约2—3世纪罗马帝国', '莫卧儿时期印度']) {
        for (const separator of ['-', '－', '—', '–', '_']) {
            assert.deepEqual(extract(`${era}${separator}串珠${separator}大都会艺术博物馆藏${separator}DSC01364_1.jpg`), {
                textLine1: '串珠', textLine2: `${era}·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
            });
        }
        assert.equal(extract(`${era}-大都会艺术博物馆藏-DSC01364_1.jpg`), null);
    }
});

test('region and culture suffix recognition does not consume an artwork name', () => {
    for (const title of ['19世纪印度风格匕首', '17世纪风格供盘', '罗马帝国风格护身符', '《莫切文化-串珠图》']) {
        assert.deepEqual(extract(`${title}-大都会艺术博物馆藏.jpg`), {
            textLine1: title, textLine2: '大都会艺术博物馆藏 / 笑谈间气吐霓虹摄',
        });
    }
});

test('date context is preserved without a geography dictionary or culture suffix requirement', () => {
    for (const context of ['坦桑尼亚', '巴布亚新几内亚', 'Tanzania', '未收录地点'.repeat(8),
        '未知考古传统', '某地区（高地-沿海）', '某地区《未收录文化名》']) {
        for (const separator of ['-', '－', '—', '–', '_']) {
            const era = `12—13世纪${context}`;
            assert.deepEqual(extract(`${era}${separator}串珠${separator}大都会艺术博物馆藏${separator}DSC01364_1.jpg`), {
                textLine1: '串珠', textLine2: `${era}·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
            }, era);
        }
    }
});

test('named periods use the artwork/collection structure with unrestricted trailing context', () => {
    for (const era of ['莫卧儿时期坦桑尼亚', '某个未收录王朝巴布亚新几内亚',
        '某个未收录文明Tanzania', `${'很长的名称'.repeat(8)}时期某个地点`]) {
        assert.deepEqual(extract(`${era}-作者：陈某某-《山水图》-大都会艺术博物馆藏.jpg`), {
            textLine1: '《山水图》', textLine2: `${era}·陈某某·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
        });
    }
});

test('missing artwork cannot be supplied by notes, camera IDs or fields beyond collection', () => {
    for (const era of ['12—13世纪坦桑尼亚', '12—13世纪Tanzania', '某未知时期某地']) {
        for (const remainder of ['DSC01364_1', '未标题-215', '作者：陈某某', '局部']) {
            assert.equal(extract(`${era}-${remainder}-大都会艺术博物馆藏-串珠-照片.jpg`), null);
        }
    }
    for (const title of ['12世纪坦桑尼亚风格供盘', '某文明风格串珠', '《某个未知文明-串珠图》']) {
        assert.deepEqual(extract(`${title}-大都会艺术博物馆藏-备注.jpg`), {
            textLine1: title, textLine2: '大都会艺术博物馆藏 / 笑谈间气吐霓虹摄',
        });
    }
});

test('Chinese dynasties, state subdivisions and dynasty ranges form a single era', () => {
    for (const era of ['唐', '宋', '战国-赵国', '五代-后唐', '唐-后唐', '唐-宋', '北宋-南宋',
        '战国—赵国', '五代－后梁', '五代_后晋', '五代-后汉', '五代十国-后周',
        '十国-南唐', '南北朝-北魏', '三国-吴国', '春秋时期-楚国', '唐至宋', '唐 — 后唐']) {
        assert.deepEqual(extract(`${era}-供盘-大都会艺术博物馆藏-备注-xxx.jpg`), {
            textLine1: '供盘', textLine2: `${era}·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
        }, era);
        assert.deepEqual(extract(`${era}-供盘.jpg`), {
            textLine1: '供盘', textLine2: `${era} / 笑谈间气吐霓虹摄`,
        }, era);
    }
});

test('BC, AD and calendar ranges match the user filename conventions', () => {
    for (const era of ['公元前221年', '公元1223年', '公元后1223年', '1223年',
        '12-13世纪', '1945-1949年', '公元前221年-公元220年', '公元前221-公元220年']) {
        assert.deepEqual(extract(`${era}-供盘-大都会艺术博物馆藏-xxx.jpg`), {
            textLine1: '供盘', textLine2: `${era}·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
        }, era);
    }
});

test('Chinese era matching stops before authors, titles, collections and notes', () => {
    for (const [prefix, title] of [
        ['战国', '赵国铜镜'], ['唐', '宋式供盘'], ['五代', '后唐风格供盘'],
        ['唐-后唐', '《唐-宋器物图》'], ['战国-赵国', '赵国铜镜'],
    ]) {
        assert.deepEqual(extract(`${prefix}-${title}-大都会艺术博物馆藏-明-清-xxx.jpg`), {
            textLine1: title, textLine2: `${prefix}·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
        });
    }
    assert.deepEqual(extract('唐-后唐-李唐《山水图》-故宫博物院藏.jpg'), {
        textLine1: '《山水图》', textLine2: '唐-后唐·李唐·故宫博物院藏 / 笑谈间气吐霓虹摄',
    });
    assert.deepEqual(extract('后唐风格供盘-大都会艺术博物馆藏.jpg'), {
        textLine1: '后唐风格供盘', textLine2: '大都会艺术博物馆藏 / 笑谈间气吐霓虹摄',
    });
    for (const era of ['战国-赵国', '五代-后唐', '唐-后唐']) {
        assert.equal(extract(`${era}-故宫博物院藏-备注-xxx.jpg`), null);
    }
});

test('century ranges are one era, not filename field separators', () => {
    for (const era of ['17—19世纪', '17-19世纪', '17－19世纪', '17–19世纪', '17——19世纪',
        '17～19世纪', '17至19世纪', '十七至十九世纪', '第十七至第十九世纪',
        '１７—１９世纪', '17世纪末—19世纪初', '公元前5—前3世纪', '约17—19世纪', '17 — 19世纪']) {
        for (const separator of ['-', '－', '—', '–', '_']) {
            assert.deepEqual(extract(`${era}${separator}供盘${separator}大都会艺术博物馆藏${separator}xxx.jpg`), {
                textLine1: '供盘',
                textLine2: `${era}·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
            }, `${era} with ${separator}`);
        }
    }
});

test('single dates and year ranges also stay in the description', () => {
    for (const era of ['19世纪', '19世纪末', '1700—1800年', '1700年—1800年', '公元前500—300年',
        '约1700年', '20世纪中期', '十八世纪', '二十世纪初', '1920年代', '1920—1930年代']) {
        assert.deepEqual(extract(`${era}-供盘-大都会艺术博物馆藏-备注-IMG_001.jpg`), {
            textLine1: '供盘', textLine2: `${era}·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄`,
        }, era);
    }
    assert.deepEqual(extract('17—19世纪-供盘.jpg'), {
        textLine1: '供盘', textLine2: '17—19世纪 / 笑谈间气吐霓虹摄',
    });
    assert.deepEqual(extract('19世纪-作者：陈某某-《山水图》-大都会艺术博物馆藏.jpg'), {
        textLine1: '《山水图》', textLine2: '19世纪·陈某某·大都会艺术博物馆藏 / 笑谈间气吐霓虹摄',
    });
});

test('date recognition respects field boundaries and does not consume title text', () => {
    assert.deepEqual(extract('17世纪风格供盘-大都会艺术博物馆藏.jpg'), {
        textLine1: '17世纪风格供盘', textLine2: '大都会艺术博物馆藏 / 笑谈间气吐霓虹摄',
    });
    assert.deepEqual(extract('《17—19世纪-供盘研究》-大都会艺术博物馆藏.jpg'), {
        textLine1: '《17—19世纪-供盘研究》', textLine2: '大都会艺术博物馆藏 / 笑谈间气吐霓虹摄',
    });
    assert.equal(extract('17—19世纪-大都会艺术博物馆藏-备注-xxx.jpg'), null);
    assert.equal(extract('1700-1800-001.jpg'), null);
});

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
