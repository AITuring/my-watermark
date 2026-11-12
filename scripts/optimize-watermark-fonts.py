"""Build common-caption subsets and compact Unicode ranges without changing glyphs.

Run with the same fonttools/brotli environment as prepare-local-watermark-fonts.py.
Source fonts are read-only. Existing assets remain available to older clients.
"""
import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
import hashlib
import importlib.util
import json
import logging
from pathlib import Path
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUT = PUBLIC / 'fonts/watermark/founder'
CATALOG = ROOT / 'src/pages/watermark/fonts/catalog.json'
SOURCES = OUT / 'sources.json'


def codes_in(value):
    result = set()
    for part in value.split(','):
        bounds = part.strip().upper().removeprefix('U+').split('-')
        first = int(bounds[0].replace('?', '0'), 16)
        last = int(bounds[-1].replace('?', 'F'), 16)
        result.update(range(first, last + 1))
    return result


def compact_range(codes):
    runs = []
    for code in sorted(codes):
        if runs and code == runs[-1][1] + 1:
            runs[-1][1] = code
        else:
            runs.append([code, code])
    return ','.join(f'U+{first:X}' if first == last else f'U+{first:X}-{last:X}' for first, last in runs)


def common_characters():
    works = json.loads((ROOT / 'src/pages/song-paintings/catalog.json').read_text())['artworks']
    counts = Counter(''.join(str(work.get(key, '')) for work in works for key in ('period', 'artist', 'title', 'collection')))
    # Fixed credit and common metadata stay together even when absent in the art catalog.
    fixed = '永和九年北宋南宋元明清唐汉商周秦西东春秋战国五代十国民国现代未知佚名无款传摹造像青铜陶瓷石刻壁画卷轴图册页局部故宫博物院陕西历史博物馆国家中国上海南京台北台南藏笑谈间气吐霓虹摄收藏作者年代'
    return set(range(32, 127)) | {ord(char) for char in fixed + '《》〈〉·／，。；：（）【】、—…'} | {ord(char) for char, _ in counts.most_common(512)}


def build_common(job):
    source, path, wanted = job
    logging.getLogger('fontTools.subset').setLevel(logging.ERROR)
    if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
        raise ValueError(f'Source hash mismatch: {path}')
    font = TTFont(path)
    chars = wanted.intersection(font.getBestCmap())
    digest = hashlib.sha256((source['sha256'] + compact_range(chars)).encode()).hexdigest()[:12]
    name = f'{source["id"]}-common-{digest}.woff2'
    target = OUT / name
    if not target.exists():
        spec = importlib.util.spec_from_file_location('local_fonts', ROOT / 'scripts/prepare-local-watermark-fonts.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.normalize_feature_parameters(font)
        options = subset.Options()
        options.flavor = 'woff2'
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        options.layout_features = ['*']
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=chars)
        worker.subset(font)
        font.flavor = 'woff2'
        font.save(target)
    font.close()
    return source['id'], chars, name, target.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directories', nargs='+', type=Path)
    parser.add_argument('--jobs', type=int, default=4)
    args = parser.parse_args()
    files = {}
    for directory in args.directories:
        for path in directory.iterdir():
            if path.is_file():
                files.setdefault(path.name.lower(), []).append(path)
    sources = json.loads(SOURCES.read_text())
    wanted = common_characters()
    jobs = []
    for source in sources:
        matching = next((path for path in files.get(source['file'].lower(), [])
                         if hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']), None)
        if matching is None:
            raise ValueError(f'No matching original font: {source["file"]}')
        jobs.append((source, matching, wanted))
    common = {}
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for task in as_completed([pool.submit(build_common, job) for job in jobs]):
            identity, chars, name, size = task.result()
            common[identity] = (chars, name)
            print(f'{identity}: {len(chars)} common characters, {size} bytes', flush=True)
    fonts = json.loads(CATALOG.read_text())
    before = after = 0
    for font in fonts:
        old = font['metadataUrl']
        css = (PUBLIC / old.lstrip('/')).read_text()
        before += len(css.encode())
        # Remove any previous common rule before regenerating, making reruns idempotent.
        css = re.sub(r'@font-face\s*\{[^}]+-common-[^}]+\}\s*', '', css)
        chars, name = common.get(font['id'], (set(), ''))
        def rewrite(match):
            body = match[1]
            value = re.search(r'unicode-range\s*:\s*([^;]+)', body, re.I)
            if not value:
                return match[0]
            remaining = codes_in(value[1]) - chars
            if not remaining:
                return ''
            body = body[:value.start(1)] + compact_range(remaining) + body[value.end(1):]
            return '@font-face {' + body + '}'
        css = re.sub(r'@font-face\s*\{([^}]+)\}', rewrite, css)
        css = css.rstrip() + '\n'
        if chars:
            css += (f'\n@font-face {{font-family:"WM_{font["id"]}";'
                    f'src:url("/fonts/watermark/founder/{name}") format("woff2");'
                    f'font-style:normal;font-weight:400;unicode-range:{compact_range(chars)};}}\n')
        css = '\n'.join(line.rstrip() for line in css.splitlines()) + '\n'
        digest = hashlib.sha256(css.encode()).hexdigest()[:12]
        new = str(Path(old).with_name(f'{font["id"]}-{digest}.css'))
        (PUBLIC / new.lstrip('/')).write_text(css)
        font['metadataUrl'] = new
        if font['cssUrl'] == old:
            font['cssUrl'] = new
        after += len(css.encode())
    CATALOG.write_text(json.dumps(fonts, ensure_ascii=False, indent=2) + '\n')
    print(f'Metadata: {before} -> {after} bytes', flush=True)


if __name__ == '__main__':
    main()
