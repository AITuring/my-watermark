#!/usr/bin/env python3
"""Build reviewed thumbnails from the user's local book scans.

Requires Pillow and pypdf. The manifest stores manually reviewed rectangles in
original embedded-image pixels, not PDF points or rendered-preview pixels.

    python3 scripts/build-song-thumbnails.py --source-dir '/path/to/宋画全集'
    python3 scripts/build-song-thumbnails.py --check

Original PDFs and catalog data are never modified. Changing a crop requires a
reviewed manifest entry; this script intentionally does not infer crop regions.
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = ROOT / "scripts/data"
RUNTIME_MANIFEST = ROOT / "src/pages/song-paintings/thumbnails.json"
PUBLIC = ROOT / "public"
ASSET_PREFIX = "/song-paintings/thumbnails/"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def resized_size(size, limit):
    scale = min(1, limit / max(size))
    return tuple(round(edge * scale) for edge in size)


def asset_path(value):
    require(isinstance(value, str) and value.startswith(ASSET_PREFIX), "Invalid asset URL")
    path = (PUBLIC / value.lstrip("/")).resolve()
    require(path.is_relative_to((PUBLIC / ASSET_PREFIX.lstrip("/")).resolve()), "Invalid asset path")
    return path


def validate_manifest(manifest, volume):
    require(volume in range(1, 9), "Invalid catalog volume")
    require(manifest.get("schemaVersion") == 1, "Unsupported thumbnail manifest version")
    catalog = json.loads((ROOT / "src/pages/song-paintings/catalog.json").read_text())
    artworks = {item["id"]: item for item in catalog["artworks"]}
    volume_books = {item["book"] for item in artworks.values() if item["volume"] == volume}
    covered_books = manifest.get("coveredBooks", sorted(volume_books))
    require(isinstance(covered_books, list) and bool(covered_books), f"Volume {volume}: expected covered books")
    require(all(type(book) is int and book in volume_books for book in covered_books), f"Volume {volume}: invalid covered book")
    require(len(set(covered_books)) == len(covered_books), f"Volume {volume}: duplicate covered book")
    ids = set()
    for item in manifest["items"]:
        id = item["id"]
        require(id in artworks and artworks[id]["volume"] == volume, f"{id}: must reference a volume {volume} artwork")
        require(artworks[id]["book"] in covered_books, f"{id}: outside declared covered books")
        require(id not in ids, f"{id}: duplicate artwork")
        ids.add(id)
        require(type(item["pdfPage"]) is int and item["pdfPage"] > 0, f"{id}: invalid PDF page")
        require(Path(item["fileName"]).name == item["fileName"], f"{id}: expected a PDF filename")
        for key in ("sourceWidth", "sourceHeight"):
            require(type(item[key]) is int and item[key] > 0, f"{id}: invalid {key}")
        for key in ("previewPartial",):
            require(type(item[key]) is bool, f"{id}: invalid {key}")
        for key in ("contextRect", "focusRect"):
            rect = item[key]
            require(len(rect) == 4 and all(type(n) is int for n in rect), f"{id}: invalid {key}")
            x, y, w, h = rect
            require(x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= item["sourceWidth"] and y + h <= item["sourceHeight"], f"{id}: {key} exceeds source image")
        x, y, w, h = item["focusRect"]
        cx, cy, cw, ch = item["contextRect"]
        require(w == h, f"{id}: thumbnail focus must be square")
        require(x >= cx and y >= cy and x + w <= cx + cw and y + h <= cy + ch, f"{id}: focus must stay within reviewed artwork region")
        require(item["fileName"] == f"宋画全集  第{volume}卷  第{artworks[id]['book']}册.pdf", f"{id}: mismatched source book")
    expected = {id for id, artwork in artworks.items() if artwork["volume"] == volume and artwork["book"] in covered_books}
    require(ids == expected, f"Volume {volume} coverage mismatch: missing {sorted(expected - ids)}, extra {sorted(ids - expected)}")


def load_manifests():
    # Each published manifest covers complete, visually reviewed books. It covers
    # the whole volume unless coveredBooks explicitly lists the available books.
    # Books without local source scans remain absent rather than being guessed.
    paths = sorted(MANIFEST_DIR.glob("song-paintings-volume-*-crops.json"))
    require(bool(paths), "No reviewed crop manifests found")
    items = []
    for path in paths:
        volume = int(path.stem.split("-")[-2])
        manifest = json.loads(path.read_text())
        validate_manifest(manifest, volume)
        items.extend(manifest["items"])
    catalog = json.loads((ROOT / "src/pages/song-paintings/catalog.json").read_text())
    order = {item["id"]: index for index, item in enumerate(catalog["artworks"])}
    items.sort(key=lambda item: order[item["id"]])
    require(len({item["id"] for item in items}) == len(items), "Duplicate artwork across crop manifests")
    return dict(schemaVersion=1, items=items)


def crop(image, rect):
    x, y, w, h = rect
    return image.crop((x, y, x + w, y + h))


def save_webp(image, path, size, quality):
    path.parent.mkdir(parents=True, exist_ok=True)
    if image.size != size:
        image = image.resize(size, Image.Resampling.LANCZOS)
    image.save(path, "WEBP", quality=quality, method=6)


def runtime_item(item):
    # A reviewed crop change gets a new URL, including in service-worker caches.
    fingerprint = hashlib.sha256(json.dumps({key: item[key] for key in ("id", "fileName", "pdfPage", "sourceWidth", "sourceHeight", "contextRect", "focusRect")}, sort_keys=True).encode()).hexdigest()[:10]
    volume = item["id"].split("-")[0]
    prefix = f"{ASSET_PREFIX}volume-{volume}/{item['id']}-{fingerprint}"
    width, height = resized_size(item["contextRect"][2:], 1600)
    return dict(id=item["id"], src=prefix + "-thumb.webp", previewSrc=prefix + "-preview.webp", width=width, height=height, previewPartial=item["previewPartial"])


def assets_ready(asset):
    try:
        for key, size in (("src", (320, 320)), ("previewSrc", (asset["width"], asset["height"]))):
            with Image.open(asset_path(asset[key])) as image:
                if image.format != "WEBP" or image.size != size:
                    return False
                image.verify()
        return True
    except (OSError, ValueError):
        return False


def runtime_manifest(manifest):
    return dict(schemaVersion=1, items=[runtime_item(item) for item in manifest["items"]])


def build(manifest, source_dir, force=False):
    from pypdf import PdfReader

    reader = None
    current_filename = None
    source_dirs = [source_dir] if isinstance(source_dir, Path) else source_dir
    for item in manifest["items"]:
        filename = item["fileName"]
        asset = runtime_item(item)
        if not force and assets_ready(asset):
            continue
        if filename != current_filename:
            candidates = [directory / filename for directory in source_dirs if (directory / filename).is_file()]
            require(bool(candidates), f"Source PDF not found: {filename}")
            reader = PdfReader(candidates[0])
            current_filename = filename
        page = reader.pages[item["pdfPage"] - 1]
        images = list(page.images)
        require(len(images) == 1, f"{item['id']}: expected one scanned image; review source page again")
        image = images[0].image.convert("RGB")
        require(image.size == (item["sourceWidth"], item["sourceHeight"]), f"{item['id']}: scan dimensions changed; re-review crop coordinates")
        save_webp(crop(image, item["focusRect"]), asset_path(asset["src"]), (320, 320), 86)
        save_webp(crop(image, item["contextRect"]), asset_path(asset["previewSrc"]), (asset["width"], asset["height"]), 88)
        print(f"Built {item['id']}")


def check_assets(manifest):
    total = 0
    thumbs = 0
    runtime = runtime_manifest(manifest)
    require(json.loads(RUNTIME_MANIFEST.read_text()) == runtime, "Runtime thumbnail manifest is out of date")
    for item in runtime["items"]:
        sizes = {
            "src": (320, 320),
            "previewSrc": (item["width"], item["height"]),
        }
        for key, expected in sizes.items():
            path = asset_path(item[key])
            with Image.open(path) as image:
                require(image.format == "WEBP" and image.size == expected, f"{item['id']}: invalid {key} asset")
                image.verify()
            total += path.stat().st_size
            if key == "src":
                thumbs += path.stat().st_size
    print(f"Verified {len(manifest['items'])} artworks. Thumbnails: {thumbs / 1024:.0f} KiB; all assets: {total / 1024:.0f} KiB.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-dir", type=Path, action="append", help="Directory containing original PDFs; repeat for multiple directories")
    parser.add_argument("--check", action="store_true", help="Check manifest and generated assets without opening PDFs")
    parser.add_argument("--force", action="store_true", help="Regenerate assets, including already built crop versions")
    args = parser.parse_args()
    if not args.check and not args.source_dir:
        parser.error("--source-dir is required when generating images")
    manifest = load_manifests()
    if not args.check:
        build(manifest, args.source_dir, force=args.force)
        # Publish URLs only after every referenced asset has been generated.
        pending = RUNTIME_MANIFEST.with_suffix(".json.tmp")
        pending.write_text(json.dumps(runtime_manifest(manifest), ensure_ascii=False, indent=2) + "\n")
        pending.replace(RUNTIME_MANIFEST)
    check_assets(manifest)


if __name__ == "__main__":
    main()
