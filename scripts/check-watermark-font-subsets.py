"""Verify optimized common subsets against the existing shipped WOFF2 glyphs."""
from concurrent.futures import ProcessPoolExecutor
import json
from pathlib import Path
import re
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'


def check(job):
    source, subset_path = job
    part = TTFont(subset_path)
    cmap = part.getBestCmap()
    glyphs = part.getGlyphSet()
    checked = set()
    for name in source['subsets']:
        original = TTFont(PUBLIC / 'fonts/watermark/founder' / name)
        original_cmap = original.getBestCmap()
        shared = set(cmap).intersection(original_cmap)
        if shared:
            for table, fields in [('head', ['unitsPerEm']), ('hhea', ['ascent', 'descent', 'lineGap'])]:
                for field in fields:
                    assert getattr(original[table], field) == getattr(part[table], field), (source['id'], field)
            original_glyphs = original.getGlyphSet()
            for code in shared:
                before, after = original_glyphs[original_cmap[code]], glyphs[cmap[code]]
                assert before.width == after.width, (source['id'], code, 'advance')
                before_pen, after_pen = DecomposingRecordingPen(original_glyphs), DecomposingRecordingPen(glyphs)
                before.draw(before_pen)
                after.draw(after_pen)
                assert before_pen.value == after_pen.value, (source['id'], code, 'outline')
                checked.add(code)
        original.close()
    assert checked == set(cmap), source['id']
    part.close()
    return len(checked)


def main():
    sources = json.loads((PUBLIC / 'fonts/watermark/founder/sources.json').read_text())
    catalog = {font['id']: font for font in json.loads((ROOT / 'src/pages/watermark/fonts/catalog.json').read_text())}
    jobs = []
    for source in sources:
        css = (PUBLIC / catalog[source['id']]['metadataUrl'].lstrip('/')).read_text()
        url = re.search(r'url\("([^"\n]+-common-[^"\n]+)"\)', css)[1]
        jobs.append((source, PUBLIC / url.lstrip('/')))
    with ProcessPoolExecutor(max_workers=4) as pool:
        count = sum(pool.map(check, jobs))
    print(f'PASS: {len(jobs)} fonts, {count} common glyph outlines and advances; existing line metrics preserved.')


if __name__ == '__main__':
    main()
