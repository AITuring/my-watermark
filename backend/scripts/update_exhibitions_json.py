import asyncio
import json
from pathlib import Path
import shutil
import sys

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from museum_scraper import EVENT_JSON_PATH, refresh_exhibition_events


async def main():
    result = await refresh_exhibition_events(force=True)
    legacy_path = BASE_DIR / "backend" / "data" / "exhibitions_latest.json"
    legacy_path.parent.mkdir(parents=True, exist_ok=True)
    if EVENT_JSON_PATH.exists():
        shutil.copyfile(EVENT_JSON_PATH, legacy_path)
        text = legacy_path.read_text(encoding="utf-8")
        payload = json.loads(text)
        print(f"updated events: {len(payload)}")
        print(f"target: {legacy_path}")
    else:
        print("event json not generated")
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
