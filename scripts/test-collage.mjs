import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import sharp from 'sharp';

const compile = async (name) => ts.transpileModule(await readFile(new URL(`../src/pages/collage/${name}.ts`, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const geometryUrl = moduleUrl(await compile('geometry'));
const motifsUrl = moduleUrl((await compile('motifs')).replace("'./geometry'", JSON.stringify(geometryUrl)));
const growthUrl = moduleUrl((await compile('growth')).replace("'./geometry'", JSON.stringify(geometryUrl)));
const coverLayoutSource = ts.transpileModule(await readFile(new URL('../src/components/cover-collage-layout.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const coverLayoutUrl = moduleUrl(coverLayoutSource);
const coverUrl = moduleUrl((await compile('cover-wall')).replace("'../../components/cover-collage-layout'", JSON.stringify(coverLayoutUrl)));
const templatesUrl = moduleUrl((await compile('templates')).replaceAll("'./motifs'", JSON.stringify(motifsUrl)).replace("'./growth'", JSON.stringify(growthUrl)).replaceAll("'./cover-wall'", JSON.stringify(coverUrl)));
const { intersection, area } = await import(geometryUrl);
const { getAdaptiveSlots, getArtworkFraction, getSlots, MOTIF_COUNTS, RATIOS, TEMPLATES } = await import(templatesUrl);
const { renderCollage, renderCollageExport } = await import(moduleUrl((await compile('render')).replace("'./templates'", JSON.stringify(templatesUrl))));
globalThis.Path2D = class { constructor(path) { this.path = path; } };
globalThis.window = { setTimeout };
function makeCanvas(width, height) {
  const ownDraws = [], children = [], composites = [], strokes = [], fills = [];
  const ctx = {
    clearRect() {}, fillRect(...args) { fills.push(args); }, save() {}, restore() {}, scale() {}, translate() {}, rotate() {}, clip() {}, fillText() {},
    measureText(text) { return { width: text.length * 10 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }, fill() {},
    drawImage(...args) { ownDraws.push(args); if (args[0]?.getContext) composites.push({ alpha: this.globalAlpha, image: args[0] }); },
    stroke() { strokes.push(this.strokeStyle); },
  };
  return {
    width, height, getContext: () => ctx, strokes, fills, children, composites,
    ownerDocument: { createElement() { const child = makeCanvas(0, 0); children.push(child); return child; } },
    get draws() { return [...ownDraws.filter(args => !args[0]?.getContext), ...children.flatMap(child => child.draws)]; },
  };
}
const base = { columns: 0, rows: 0, gap: 3, background: '#eee7d8', title: '', subtitle: '', crops: {} };
const makeImages = (count) => Array.from({ length: count }, (_, i) => ({ naturalWidth: i % 2 ? 4032 : 900, naturalHeight: i % 2 ? 3024 : 3200, id: i }));

test('fixed templates retain their region counts and basic templates adapt through 30 images', () => {
  for (const { id } of TEMPLATES) for (const count of [0, 1, 2, 3, 5, 7, 9, 12, 18, 20, 24, 29, 30]) {
    for (const aspect of [.6, 1, 16 / 9, 9 / 16, 21 / 9]) {
      const slots = getAdaptiveSlots(id, count, aspect);
      assert.equal(slots.length, count ? id === 'fan' ? Math.min(count, MOTIF_COUNTS.fan) : MOTIF_COUNTS[id] ?? (id === 'wall' ? 18 : count) : 0, `${id} / ${count}`);
      for (const { box: [x, y, w, h], path } of slots) {
        assert.ok([x, y, w, h].every(Number.isFinite));
        assert.ok(w > 0 && h > 0);
        if (id !== 'wall') assert.ok(x >= -1e-5 && y >= -1e-5 && x + w <= 600 + 1e-5 && y + h <= 1000 + 1e-5);
        assert.ok(!/NaN|Infinity/.test(path));
      }
    }
  }
});

const pathPoints = path => path.slice(1, -1).split('L').map(point => point.split(' ').map(Number));
function physicalPoints(slot, aspect) { return pathPoints(slot.path).map(([x, y]) => [x, y * .6 / aspect]); }
function sideRatios(points) {
  const lengths = points.map((a, i) => { const b = points[(i + 1) % points.length]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }).sort((a, b) => a - b);
  return lengths.map(value => value / lengths.at(-1));
}

test('every count from 1 to 30 preserves similar triangles, regular hexagons and round circles across poster ratios', () => {
  for (const aspect of [.6, 1, 4 / 3, 16 / 9, 21 / 9, 9 / 16]) for (let count = 1; count <= 30; count++) {
    const expected = sideRatios([[0, 0], [600, 0], [0, 600 / aspect]]);
    for (const id of ['triangle', 'honeycomb', 'orbit']) {
      const slots = getAdaptiveSlots(id, count, aspect);
      assert.equal(slots.length, count, `${id}/${count}/${aspect}`);
      assert.equal(new Set(slots.map(slot => slot.rootId)).size, count);
      for (const slot of slots) {
        assert.ok(!slot.clips?.length && !slot.exclude?.length && !slot.rotation);
        if (id === 'orbit') {
          const values = slot.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
          assert.ok(Math.abs(values[2] - values[3] * .6 / aspect) < 1e-6, 'circle must stay round even when its outer edges extend beyond the poster');
        } else {
          const points = physicalPoints(slot, aspect);
          assert.equal(points.length, id === 'triangle' ? 3 : 6);
          const ratios = sideRatios(points);
          const target = id === 'triangle' ? expected : [1, 1, 1, 1, 1, 1];
          assert.ok(ratios.every((value, i) => Math.abs(value - target[i]) < 1e-5), `${id}/${count}: silhouette changed`);
        }
      }
    }
  }
});

test('every growing template paints the entire canvas, including corners, while keeping every source visible', async () => {
  for (const aspect of [.6, 1, 16 / 9, 9 / 16, 21 / 9]) for (let count = 1; count <= 30; count++) {
    for (const id of ['triangle', 'honeycomb', 'orbit']) {
      const slots = getAdaptiveSlots(id, count, aspect);
      const width = Math.round(240 * Math.min(1, aspect)), height = Math.round(240 * Math.min(1, 1 / aspect));
      // An independent SVG renderer verifies the actual mask AND image destination box.
      // Distinct solid photo colours reveal any fully obscured source, not just missing canvas coverage.
      const clips = slots.map((slot, i) => {
        const [x, y, w, h] = slot.box;
        return `<clipPath id="c${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`;
      }).join('');
      const paths = slots.map((slot, i) => `<path d="${slot.path}" clip-path="url(#c${i})" fill="rgb(${(i + 1) * 7},93,201)"/>`).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 600 1000" preserveAspectRatio="none"><defs>${clips}</defs><rect width="600" height="1000" fill="black"/>${paths}</svg>`;
      const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const visible = Array(count).fill(0);
      let blank = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) blank++;
        const source = data[i] / 7 - 1;
        if (Number.isInteger(source) && source >= 0 && source < count && data[i + 1] === 93 && data[i + 2] === 201) visible[source]++;
      }
      assert.equal(blank, 0, `${id}/${count}/${aspect}: exposed paper in the poster`);
      assert.ok(visible.every(value => value > width * height / count * .2), `${id}/${count}/${aspect}: a photo was obscured into a tiny filler fragment`);
      if (id === 'triangle') {
        assert.ok(Math.abs(slots.reduce((sum, slot) => sum + slot.area, 0) - 600000) < .1);
        if (count > 1) for (let a = 0; a < count; a++) for (let b = 0; b < a; b++) {
          assert.ok(area(intersection(pathPoints(slots[a].path), pathPoints(slots[b].path))) < .1);
        }
      }
    }
  }
});

test('reference poster outlines remain identical with partially filled or surplus photo lists', () => {
  for (const [id, capacity] of Object.entries(MOTIF_COUNTS)) {
    const reference = getSlots(id);
    assert.equal(reference.length, capacity);
    assert.ok(reference[0].area > 20000);
    assert.ok(reference.some(slot => slot.exclude?.length));
    assert.ok(Math.abs(reference.reduce((sum, slot) => sum + slot.area, 0) - 600000) < .1);
    for (const count of [1, 3, capacity, 20, 30]) {
      if (id !== 'fan' || count >= capacity) assert.deepEqual(getAdaptiveSlots(id, count), reference);
      else assert.equal(getAdaptiveSlots(id, count).length, count);
    }
  }
});

test('every photo is rendered once with valid, undistorted crops, including title-reserved layouts', () => {
  for (const { id } of TEMPLATES) for (const { w, h } of RATIOS) for (const count of [1, 3, 7, 20, 30]) {
    const images = makeImages(count);
    const canvas = makeCanvas(Math.round(2400 * Math.min(1, w / h)), Math.round(2400 * Math.min(1, h / w)));
    const crops = Object.fromEntries(images.map((_, i) => [i, { x: i % 2 ? 0 : 100, y: i % 2 ? 100 : 0, zoom: i % 2 ? 3 : 1 }]));
    const options = { ...base, template: id, crops, title: '作品集', subtitle: '每一张图片都参与排布' };
    renderCollage(canvas, images, options);
    const used = Math.min(count, MOTIF_COUNTS[id] ?? (id === 'wall' ? 18 : count));
    assert.equal(canvas.draws.length, id === 'wall' ? 18 : used);
    assert.equal(new Set(canvas.draws.map(([image]) => image.id)).size, used);
    const artworkHeight = canvas.height * getArtworkFraction(canvas.width / canvas.height, true, id);
    for (const [image, x, y, sw, sh, , , dw, dh] of canvas.draws) {
      assert.ok(x >= -1e-8 && y >= -1e-8);
      assert.ok(x + sw <= image.naturalWidth + 1e-8 && y + sh <= image.naturalHeight + 1e-8);
      assert.ok(Math.abs(sw / sh - (dw * canvas.width / 600) / (dh * artworkHeight / 1000)) < 1e-7);
    }
    assert.ok(!canvas.strokes.includes('#bb4c32'));
  }
});

test('manual grid rows or columns never omit or duplicate photos and fill the whole board', () => {
  for (const count of [1, 5, 19, 24, 30]) for (let density = 1; density <= 12; density++) {
    for (const [columns, rows] of [[density, 0], [0, density]]) {
      const slots = getAdaptiveSlots('grid', count, .6, columns, rows);
      assert.equal(slots.length, count);
      assert.ok(Math.abs(slots.reduce((sum, { box: [, , w, h] }) => sum + w * h, 0) - 600000) < 1e-5);
    }
  }
});

test('cover-wall frames retain portrait proportions at every density and output ratio', () => {
  for (const { w, h } of RATIOS) for (const count of [2, 19, 30]) {
    for (const { box: [, , sw, sh] } of getAdaptiveSlots('wall', count, w / h)) {
      assert.ok(Math.abs((sw * w / 600) / (sh * h / 1000) - .72) < 1e-8);
    }
  }
});

test('reference fans follow broad alternating arcs with a large central scene and no exposed paper at any count', async () => {
  const full = getSlots('fan');
  assert.equal(full.length, 10);
  assert.ok(full[1].area > 110000, 'central scene remains the largest visible fan');
  assert.ok(full[1].area > Math.max(...full.filter((_, i) => i !== 1).map(slot => slot.area)));
  // Independent reference landmarks: the arc crosses these points within two artboard pixels.
  const landmarks = [
    [1, [[0, 595], [375, 355], [600, 400]]],
    [2, [[170, 115], [420, 25], [600, 55]]],
    [3, [[0, 88], [170, 135], [296, 240]]],
    [4, [[180, 400], [390, 210], [600, 180]]],
    [7, [[0, 595], [240, 670], [400, 815]]],
    [9, [[235, 960], [410, 810], [600, 775]]],
  ];
  for (const [index, points] of landmarks) {
    const n = full[index].path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
    for (const [x, y] of points) assert.ok(Math.abs(Math.hypot(x - n[0], y - n[1]) - n[4]) < 2);
  }
  for (let count = 1; count <= 10; count++) {
    const slots = getAdaptiveSlots('fan', count);
    assert.equal(slots.length, count);
    assert.ok(Math.abs(slots.reduce((sum, slot) => sum + slot.area, 0) - 600000) < .1);
    let defs = '';
    const paths = slots.map((slot, i) => {
      const [x, y, w, h] = slot.box;
      const masks = [slot.path, ...(slot.exclude ?? []).map(path => `M0 0H600V1000H0Z${path}`)];
      const ids = masks.map((path, j) => {
        const id = `m${i}-${j}`;
        defs += `<clipPath id="${id}"><path d="${path}" clip-rule="${j ? 'evenodd' : 'nonzero'}"/></clipPath>`;
        return id;
      });
      return ids.map(id => `<g clip-path="url(#${id})">`).join('') + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgb(${(i + 1) * 20},93,201)"/>` + '</g>'.repeat(ids.length);
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500" viewBox="0 0 600 1000"><defs>${defs}</defs><rect width="600" height="1000" fill="black"/>${paths}</svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const visible = Array(count).fill(0);
    let blank = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (!data[i] && !data[i + 1] && !data[i + 2]) blank++;
      const source = data[i] / 20 - 1;
      if (Number.isInteger(source) && source >= 0 && source < count && data[i + 1] === 93 && data[i + 2] === 201) visible[source]++;
    }
    assert.equal(blank, 0, `fan/${count}: uncovered paper`);
    assert.ok(visible.every(pixels => pixels > 500), `fan/${count}: a source collapsed into a sliver`);
  }
});

test('classic covers recover the original positions, sizes and stacking instead of tightening a grid as sources increase', () => {
  const slots = getAdaptiveSlots('wall', 18, 16 / 9);
  const first = slots.find(slot => slot.rootId === 'cover-0');
  const [x,y,w,h] = first.box;
  assert.ok(Math.abs(x + w / 2 - 48) < 1e-6);
  assert.ok(Math.abs(y + h / 2 - 180) < 1e-6);
  assert.equal(h, 200); assert.equal(first.rotation, -8);
  const areaRatio = slots.reduce((sum, slot) => sum + slot.box[2] * slot.box[3], 0) / 600000;
  assert.ok(areaRatio < .55, 'classic cover keeps generous negative space');
  assert.equal(new Set(slots.map(slot => slot.box[3])).size > 5, true);
  for (const count of [1, 6, 18, 30]) {
    const current = getAdaptiveSlots('wall', count, 16 / 9);
    assert.deepEqual(current.map(slot => slot.box), slots.map(slot => slot.box));
    assert.equal(new Set(current.map(slot => slot.imageIndex)).size, Math.min(count, 18));
  }
});

test('classic cover exports cycle through sources in paint order and composite opacity once for the entire wall', async () => {
  const images = Array.from({length: 6}, (_, i) => ({ file: {id:i}, aspect:.72 }));
  const canvas = makeCanvas(1600,900);
  let active=0, disposed=0;
  await renderCollageExport(canvas, images, {...base,template:'wall',title:'山水之间'}, async file => {
    assert.equal(++active,1);
    return {image:{id:file.id,naturalWidth:720,naturalHeight:1000},dispose(){active--;disposed++;}};
  });
  assert.equal(disposed,18);
  assert.equal(canvas.draws.length,18);
  assert.equal(new Set(canvas.draws.map(([image])=>image.id)).size,6);
  assert.equal(canvas.composites.length,1);
  assert.equal(canvas.composites[0].alpha,.28);
  assert.equal(canvas.children[0].width,0,'release the intermediate wall after compositing');
  assert.equal(getArtworkFraction(16/9,true,'wall'),1,'cover title overlays the wall without squeezing its composition');
});

test('template examples remain independent from user photo counts', () => {
  const images = makeImages(8);
  for (const { id } of TEMPLATES) {
    const canvas = makeCanvas(120, 200);
    renderCollage(canvas, images, { ...base, columns: 3, rows: 3, template: id, referenceLayout: true });
    assert.equal(canvas.draws.length, getSlots(id).length);
  }
});

test('export reads original files one at a time, releases each source, and includes the last photo', async () => {
  const count = 30, canvas = makeCanvas(1440, 2400), progress = [];
  let active = 0, disposed = 0;
  const files = Array.from({ length: count }, (_, i) => ({ file: { id: i }, aspect: .75 }));
  await renderCollageExport(canvas, files, { ...base, template: 'grid' }, async (file, dimension) => {
    active++;
    assert.equal(active, 1);
    assert.ok(dimension > 0);
    return { image: { id: file.id, naturalWidth: 900, naturalHeight: 1200 }, dispose() { active--; disposed++; } };
  }, completed => progress.push(completed));
  assert.equal(disposed, count);
  assert.equal(active, 0);
  assert.equal(canvas.draws.at(-1)[0].id, count - 1);
  assert.deepEqual(progress, Array.from({ length: count }, (_, i) => i + 1));
});

test('partially filled fixed templates export only supplied originals and preserve empty regions', async () => {
  for (const [id, capacity] of Object.entries(MOTIF_COUNTS)) for (const count of [1, 3, capacity, capacity + 2]) {
    const canvas = makeCanvas(600, 1000), progress = [];
    const images = Array.from({ length: count }, (_, i) => ({ file: { id: i }, aspect: 1 }));
    await renderCollageExport(canvas, images, { ...base, template: id }, async file => ({
      image: { id: file.id, naturalWidth: 1000, naturalHeight: 1000 }, dispose() {},
    }), (completed, total) => progress.push([completed, total]));
    const used = Math.min(count, capacity);
    assert.equal(canvas.draws.length, used);
    assert.deepEqual(progress.at(-1), [used, used]);
  }
});

test('export releases a source if cancelled during decoding', async () => {
  const controller = new AbortController();
  let disposed = 0;
  await assert.rejects(renderCollageExport(makeCanvas(600, 1000), [{ file: {}, aspect: 1 }], { ...base, template: 'grid' }, async () => {
    controller.abort();
    return { image: { naturalWidth: 100, naturalHeight: 100 }, dispose() { disposed++; } };
  }, undefined, controller.signal), { name: 'AbortError' });
  assert.equal(disposed, 1);
});
