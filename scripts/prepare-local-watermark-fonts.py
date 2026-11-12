"""Bundle user-supplied fonts as lazy Unicode subsets and real gallery previews.

Usage: python scripts/prepare-local-watermark-fonts.py /path/to/fonts [--match FZ*.TTF]
Requires fonttools, brotli and pillow. Original downloads are never modified.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import hashlib
import json
import logging
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/fonts/watermark/founder'
CATALOG = ROOT / 'src/pages/watermark/fonts/catalog.json'
MANIFEST = OUT / 'sources.json'
SAMPLE = '永和九年'


def font_name(font, name_id):
    names = [name for name in font['name'].names if name.nameID == name_id]
    names.sort(key=lambda name: (name.langID != 0x804, name.langID != 0x409))
    return names[0].toUnicode() if names else ''


def category(name):
    if any(word in name for word in ('刻本', '刻宋', '字典')):
        return '古籍刻本'
    if any(word in name for word in ('篆', '甲骨')):
        return '篆书'
    if any(word in name for word in ('隶', '帛书')):
        return '隶书'
    if any(word in name for word in ('宋', '金陵')):
        return '宋体'
    if '黑' in name:
        return '黑体'
    if any(word in name for word in ('草',)):
        return '草书'
    if any(word in name for word in ('楷', '瘦金')):
        return '楷书'
    return '行书' if '行' in name else '手写'


def normalize_feature_parameters(font):
    # Some source fonts attach an invalid generic FeatureParams to vrt2. It has
    # no parameters in OpenType; keep its vertical substitutions themselves.
    repaired = []
    for table in ('GSUB', 'GPOS'):
        if table not in font or not font[table].table.FeatureList:
            continue
        for record in font[table].table.FeatureList.FeatureRecord:
            if record.Feature.FeatureParams is not None and record.FeatureTag not in {'size'} and not record.FeatureTag.startswith(('ss', 'cv')):
                record.Feature.FeatureParams = None
                repaired.append(f'{table}:{record.FeatureTag}')
    return repaired


def build(path):
    logging.getLogger('fontTools.subset').setLevel(logging.ERROR)
    font = TTFont(path)
    codes = sorted(font.getBestCmap())
    identity = path.stem.lower()
    name = font_name(font, 1)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    copyright_text = font_name(font, 0)
    repaired = normalize_feature_parameters(font)
    header = f'/* {name}; source SHA256: {digest}. Original metadata: sources.json */\n'
    css = header
    assets = []
    total = 0
    for start in range(0, len(codes), 256):
        chars = codes[start:start + 256]
        part_name = f'{identity}-{digest[:12]}-{start // 256}.woff2'
        target = OUT / part_name
        if not target.exists():
            part = TTFont(path)
            normalize_feature_parameters(part)
            options = subset.Options()
            options.flavor = 'woff2'
            options.name_IDs = ['*']
            options.name_legacy = True
            options.name_languages = ['*']
            options.layout_features = ['*']
            worker = subset.Subsetter(options=options)
            worker.populate(unicodes=chars)
            worker.subset(part)
            part.flavor = 'woff2'
            part.save(target)
            part.close()
        total += target.stat().st_size
        assets.append(part_name)
        unicode_range = ','.join(f'U+{code:X}' for code in chars)
        css += (f'@font-face {{font-family:"WM_{identity}";'
                f'src:url("/fonts/watermark/founder/{part_name}") format("woff2");'
                f'font-style:normal;font-weight:400;unicode-range:{unicode_range};}}\n')
    css_name = f'{identity}-{digest[:12]}.css'
    (OUT / css_name).write_text(css)

    # Draw the source font directly, without a system-font substitution. Ancient
    # scripts may not cover the standard four-character sample; use real glyphs.
    available = ''.join(char for char in SAMPLE if ord(char) in codes)
    if len(available) < 4:
        available += ''.join(chr(code) for code in codes if 0x4E00 <= code <= 0x9FFF and chr(code) not in available)[:4 - len(available)]
    preview = Image.new('RGBA', (360, 110))
    draw = ImageDraw.Draw(preview)
    face = ImageFont.truetype(str(path), 72)
    draw.text((180, 55), available, font=face, fill='#111111', anchor='mm')
    preview.save(ROOT / f'public/fonts/watermark/preview-{identity}.png')

    aliases = name.replace('孫過庭', '孙过庭').replace('李陽冰', '李阳冰').replace('篆書', '篆书').replace('草書', '草书').replace('文征明', '文徵明')
    font_category = category(name)
    maker = '方正' if name.startswith('方正') else '书体坊' if any(word in name for word in ('书体坊', '書體坊')) else ''
    grouping = '名家' if font_category in {'篆书', '隶书', '楷书', '行书', '草书'} else font_category
    entry = dict(id=identity, name=name, category=font_category,
                 cssUrl=f'/fonts/watermark/founder/{css_name}',
                 metadataUrl=f'/fonts/watermark/founder/{css_name}', source='',
                 tags=f'{grouping} 本地字体 {maker} {aliases} {path.stem}')
    source = dict(id=identity, file=path.name, sha256=digest, name=name,
                  postScriptName=font_name(font, 6), copyright=copyright_text,
                  trademark=font_name(font, 7), license=font_name(font, 13),
                  licenseUrl=font_name(font, 14), embeddingFlags=font['OS/2'].fsType,
                  glyphs=len(codes), sourceBytes=path.stat().st_size,
                  subsetBytes=total, subsets=assets, previewText=available,
                  normalizedFeatureParameters=repaired)
    font.close()
    return entry, source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--match', default='FZ*.TTF')
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--skip-existing', action='store_true', help='Skip known file hashes or internal PostScript names')
    args = parser.parse_args()
    paths = sorted(path for path in args.directory.glob(args.match) if path.is_file())
    if not paths:
        raise SystemExit('No matching fonts')
    if args.skip_existing:
        known = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
        hashes = {source['sha256'] for source in known}
        names = {source['postScriptName'] for source in known if source.get('postScriptName')}
        selected = []
        for path in paths:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            with TTFont(path) as font:
                postscript = font_name(font, 6)
            if digest in hashes or postscript and postscript in names:
                print(f'Skip existing: {path.name}', flush=True)
                continue
            selected.append(path)
            hashes.add(digest)
            if postscript:
                names.add(postscript)
        paths = selected
        if not paths:
            print('No new fonts to bundle', flush=True)
            return
    OUT.mkdir(parents=True, exist_ok=True)
    entries, sources = [], []
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for future in as_completed([pool.submit(build, path) for path in paths]):
            entry, source = future.result()
            entries.append(entry)
            sources.append(source)
            print(f'{entry["name"]}: {source["glyphs"]} glyphs, {len(source["subsets"])} parts, {source["subsetBytes"] // 1024} KiB', flush=True)
    # Merge after every selected font succeeds, preserving unrelated font entries.
    catalog = json.loads(CATALOG.read_text())
    replacement_ids = {entry['id'] for entry in entries}
    catalog = [font for font in catalog if font['id'] not in replacement_ids]
    catalog.extend(sorted(entries, key=lambda entry: (entry['category'], entry['id'])))
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    old_sources = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    sources.extend(source for source in old_sources if source['id'] not in replacement_ids)
    MANIFEST.write_text(json.dumps(sorted(sources, key=lambda source: source['id']), ensure_ascii=False, indent=2) + '\n')
    print(f'Added {len(entries)} fonts; compressed font bytes: {sum(source["subsetBytes"] for source in sources)}', flush=True)


if __name__ == '__main__':
    main()
