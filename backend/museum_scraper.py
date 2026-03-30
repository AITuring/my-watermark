"""
博物馆藏品数据采集模块
从各大博物馆官网获取藏品数据，支持故宫博物院、中国国家博物馆等
"""

import httpx
from bs4 import BeautifulSoup
import json
import re
import time
import hashlib
import asyncio
import os
from pathlib import Path
from datetime import datetime, date
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict, field
from urllib.parse import quote, urljoin, urlparse

COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}

# ─── Data Types ─────────────────────────────────────────


@dataclass
class ArtifactResult:
    id: str
    title: str
    dynasty: str = ""
    category: str = ""
    museum: str = ""
    museum_id: str = ""
    image_url: str = ""
    thumbnail_url: str = ""
    detail_url: str = ""
    description: str = ""
    material: str = ""
    dimensions: str = ""
    artist: str = ""
    source_url: str = ""


@dataclass
class SearchResult:
    items: List[ArtifactResult] = field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    museum_id: str = ""
    museum_name: str = ""
    error: str = ""


# ─── Cache ──────────────────────────────────────────────

_cache: Dict[str, tuple] = {}
CACHE_TTL = 600  # 10 minutes


def _get_cache(key: str) -> Optional[Any]:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: Any):
    _cache[key] = (data, time.time())
    if len(_cache) > 500:
        oldest_key = min(_cache, key=lambda k: _cache[k][1])
        del _cache[oldest_key]


# ─── 故宫博物院 (Palace Museum) ─────────────────────────

PALACE_MUSEUM_ID = "palace"
PALACE_MUSEUM_NAME = "故宫博物院"


async def search_palace_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """
    搜索故宫博物院数字文物库 (digicol.dpm.org.cn)
    故宫数字文物库提供了丰富的藏品数据，包括书画、陶瓷、青铜器等
    """
    cache_key = f"palace:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=PALACE_MUSEUM_ID,
        museum_name=PALACE_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            # 故宫数字文物库搜索 API
            headers = {
                **COMMON_HEADERS,
                "Referer": "https://digicol.dpm.org.cn/",
                "Origin": "https://digicol.dpm.org.cn",
            }

            # 尝试故宫数字文物库搜索接口
            search_url = "https://digicol.dpm.org.cn/cultural/search"
            try:
                resp = await client.post(
                    search_url,
                    json={
                        "keyword": keyword,
                        "pageNo": page,
                        "pageSize": size,
                    },
                    headers={**headers, "Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict):
                        items_data = data.get("data", data.get("result", data.get("list", [])))
                        if isinstance(items_data, dict):
                            items_data = items_data.get("list", items_data.get("records", []))
                        total = data.get("total", data.get("count", 0))
                        if isinstance(items_data, list) and len(items_data) > 0:
                            result.total = total or len(items_data)
                            for item in items_data:
                                artifact = _parse_palace_item(item)
                                if artifact:
                                    result.items.append(artifact)
                            if result.items:
                                _set_cache(cache_key, result)
                                return result
            except Exception:
                pass

            # 备选：通过搜索页面获取数据
            try:
                search_page_url = f"https://digicol.dpm.org.cn/search?keyword={quote(keyword)}&page={page}"
                resp = await client.get(search_page_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_palace_html(resp.text, keyword)
                    if items:
                        result.items = items[: size]
                        result.total = len(items)
                        _set_cache(cache_key, result)
                        return result
            except Exception:
                pass

            # 备选：通过藏品分类列表获取
            try:
                list_url = "https://digicol.dpm.org.cn/cultural/list"
                resp = await client.post(
                    list_url,
                    json={"keyword": keyword, "pageNo": page, "pageSize": size},
                    headers={**headers, "Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    items_data = _extract_list_data(data)
                    if items_data:
                        result.total = len(items_data)
                        for item in items_data[:size]:
                            artifact = _parse_palace_item(item)
                            if artifact:
                                result.items.append(artifact)
                        if result.items:
                            _set_cache(cache_key, result)
                            return result
            except Exception:
                pass

    except Exception as e:
        result.error = f"连接故宫博物院失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "故宫博物院数字文物库暂无搜索结果或接口不可用"
    return result


def _parse_palace_item(item: dict) -> Optional[ArtifactResult]:
    """解析故宫藏品数据"""
    try:
        title = item.get("name", item.get("title", item.get("culturalName", "")))
        if not title:
            return None

        item_id = str(item.get("id", item.get("culturalId", hashlib.md5(title.encode()).hexdigest()[:12])))
        image = item.get("image", item.get("imageUrl", item.get("pic", item.get("coverImg", ""))))
        if image and not image.startswith("http"):
            image = f"https://digicol.dpm.org.cn{image}"

        return ArtifactResult(
            id=f"palace-{item_id}",
            title=title,
            dynasty=item.get("dynasty", item.get("era", item.get("age", ""))),
            category=item.get("type", item.get("category", item.get("culturalType", ""))),
            museum=PALACE_MUSEUM_NAME,
            museum_id=PALACE_MUSEUM_ID,
            image_url=image,
            thumbnail_url=image,
            detail_url=item.get("detailUrl", f"https://digicol.dpm.org.cn/cultural/detail/{item_id}"),
            description=item.get("description", item.get("desc", item.get("remark", ""))),
            material=item.get("material", item.get("texture", "")),
            dimensions=item.get("size", item.get("dimensions", "")),
        )
    except Exception:
        return None


def _parse_palace_html(html: str, keyword: str) -> List[ArtifactResult]:
    """解析故宫搜索页面 HTML"""
    items = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        cards = soup.select(".search-item, .cultural-item, .result-item, .card-item, [class*=item], [class*=card]")
        for card in cards[:30]:
            title_el = card.select_one("h3, h4, .title, .name, [class*=title], [class*=name]")
            img_el = card.select_one("img")
            link_el = card.select_one("a[href]")

            title = title_el.get_text(strip=True) if title_el else ""
            if not title or keyword.lower() not in title.lower():
                continue

            image = ""
            if img_el:
                image = img_el.get("src", img_el.get("data-src", ""))
                if image and not image.startswith("http"):
                    image = urljoin("https://digicol.dpm.org.cn", image)

            detail_url = ""
            if link_el:
                href = link_el.get("href", "")
                if href:
                    detail_url = urljoin("https://digicol.dpm.org.cn", href)

            dynasty_el = card.select_one(".dynasty, .era, .age, [class*=dynasty], [class*=era]")
            dynasty = dynasty_el.get_text(strip=True) if dynasty_el else ""

            items.append(ArtifactResult(
                id=f"palace-{hashlib.md5(title.encode()).hexdigest()[:12]}",
                title=title,
                dynasty=dynasty,
                museum=PALACE_MUSEUM_NAME,
                museum_id=PALACE_MUSEUM_ID,
                image_url=image,
                thumbnail_url=image,
                detail_url=detail_url,
            ))
    except Exception:
        pass
    return items


def _extract_list_data(data: Any) -> Optional[list]:
    """从嵌套的 JSON 响应中提取列表数据"""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["data", "result", "list", "records", "items", "content"]:
            val = data.get(key)
            if isinstance(val, list) and len(val) > 0:
                return val
            if isinstance(val, dict):
                inner = _extract_list_data(val)
                if inner:
                    return inner
    return None


# ─── 中国国家博物馆 (National Museum of China) ──────────

NATIONAL_MUSEUM_ID = "national"
NATIONAL_MUSEUM_NAME = "中国国家博物馆"


async def search_national_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """
    搜索中国国家博物馆 (www.chnmuseum.cn)
    """
    cache_key = f"national:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=NATIONAL_MUSEUM_ID,
        museum_name=NATIONAL_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            headers = {
                **COMMON_HEADERS,
                "Referer": "https://www.chnmuseum.cn/",
            }

            # 尝试搜索接口
            try:
                search_url = f"https://www.chnmuseum.cn/zp/searchlist.shtml?keywords={quote(keyword)}"
                resp = await client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_chnmuseum_html(resp.text, "https://www.chnmuseum.cn")
                    if items:
                        result.items = items[(page - 1) * size: page * size]
                        result.total = len(items)
                        _set_cache(cache_key, result)
                        return result
            except Exception:
                pass

            # 备选：藏品列表页面
            try:
                list_url = f"https://www.chnmuseum.cn/zp/zpml/index_{page}.shtml"
                resp = await client.get(list_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_chnmuseum_html(resp.text, "https://www.chnmuseum.cn")
                    filtered = [i for i in items if keyword.lower() in i.title.lower()] if keyword else items
                    if filtered:
                        result.items = filtered[:size]
                        result.total = len(filtered)
                        _set_cache(cache_key, result)
                        return result
            except Exception:
                pass

            # 备选：直接搜索
            try:
                search_url = f"https://www.chnmuseum.cn/search/?kw={quote(keyword)}"
                resp = await client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_chnmuseum_html(resp.text, "https://www.chnmuseum.cn")
                    if items:
                        result.items = items[:size]
                        result.total = len(items)
                        _set_cache(cache_key, result)
                        return result
            except Exception:
                pass

    except Exception as e:
        result.error = f"连接中国国家博物馆失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "中国国家博物馆暂无搜索结果或接口不可用"
    return result


def _parse_chnmuseum_html(html: str, base_url: str) -> List[ArtifactResult]:
    """解析国博页面"""
    items = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        cards = soup.select(
            ".list-item, .zp-item, .collection-item, .search-result-item, "
            "[class*=collection], [class*=item], li.item, .pic-list li"
        )
        for card in cards[:40]:
            title_el = card.select_one("h3, h4, .title, .name, p.tit, [class*=title], [class*=name], a")
            img_el = card.select_one("img")
            link_el = card.select_one("a[href]")

            title = title_el.get_text(strip=True) if title_el else ""
            if not title or len(title) < 2:
                continue

            image = ""
            if img_el:
                image = img_el.get("src", img_el.get("data-src", img_el.get("data-original", "")))
                if image and not image.startswith("http"):
                    image = urljoin(base_url, image)

            detail_url = ""
            if link_el:
                href = link_el.get("href", "")
                if href and href != "#":
                    detail_url = urljoin(base_url, href)

            desc_el = card.select_one(".desc, .info, .summary, p:not(.tit)")
            desc = desc_el.get_text(strip=True) if desc_el else ""

            items.append(ArtifactResult(
                id=f"national-{hashlib.md5(title.encode()).hexdigest()[:12]}",
                title=title,
                museum=NATIONAL_MUSEUM_NAME,
                museum_id=NATIONAL_MUSEUM_ID,
                image_url=image,
                thumbnail_url=image,
                detail_url=detail_url,
                description=desc,
            ))
    except Exception:
        pass
    return items


# ─── 上海博物馆 (Shanghai Museum) ───────────────────────

SHANGHAI_MUSEUM_ID = "shanghai"
SHANGHAI_MUSEUM_NAME = "上海博物馆"


async def search_shanghai_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """搜索上海博物馆 (www.shanghaimuseum.net)"""
    cache_key = f"shanghai:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=SHANGHAI_MUSEUM_ID,
        museum_name=SHANGHAI_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            headers = {
                **COMMON_HEADERS,
                "Referer": "https://www.shanghaimuseum.net/",
            }

            # 上海博物馆搜索
            try:
                search_url = f"https://www.shanghaimuseum.net/mu/search/list?keyword={quote(keyword)}&pageNum={page}&pageSize={size}"
                resp = await client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    try:
                        data = resp.json()
                        items_data = _extract_list_data(data)
                        if items_data:
                            result.total = data.get("total", len(items_data))
                            for item in items_data:
                                artifact = _parse_generic_museum_item(
                                    item, SHANGHAI_MUSEUM_NAME, SHANGHAI_MUSEUM_ID,
                                    "https://www.shanghaimuseum.net"
                                )
                                if artifact:
                                    result.items.append(artifact)
                    except Exception:
                        items = _parse_generic_html(
                            resp.text, "https://www.shanghaimuseum.net",
                            SHANGHAI_MUSEUM_NAME, SHANGHAI_MUSEUM_ID
                        )
                        result.items = items[:size]
                        result.total = len(items)
            except Exception:
                pass

            # 备选：藏品页面
            if not result.items:
                try:
                    collection_url = f"https://www.shanghaimuseum.net/mu/frontend/pg/collection/list?keyword={quote(keyword)}&pageNum={page}&pageSize={size}"
                    resp = await client.get(collection_url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        items_data = _extract_list_data(data)
                        if items_data:
                            result.total = len(items_data)
                            for item in items_data:
                                artifact = _parse_generic_museum_item(
                                    item, SHANGHAI_MUSEUM_NAME, SHANGHAI_MUSEUM_ID,
                                    "https://www.shanghaimuseum.net"
                                )
                                if artifact:
                                    result.items.append(artifact)
                except Exception:
                    pass

    except Exception as e:
        result.error = f"连接上海博物馆失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "上海博物馆暂无搜索结果或接口不可用"
    if result.items:
        _set_cache(cache_key, result)
    return result


# ─── 南京博物院 (Nanjing Museum) ────────────────────────

NANJING_MUSEUM_ID = "nanjing"
NANJING_MUSEUM_NAME = "南京博物院"


async def search_nanjing_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """搜索南京博物院"""
    cache_key = f"nanjing:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=NANJING_MUSEUM_ID,
        museum_name=NANJING_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            headers = {**COMMON_HEADERS, "Referer": "https://www.njmuseum.com/"}

            try:
                search_url = f"https://www.njmuseum.com/zh/collectionSearch?keyword={quote(keyword)}"
                resp = await client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_generic_html(
                        resp.text, "https://www.njmuseum.com",
                        NANJING_MUSEUM_NAME, NANJING_MUSEUM_ID
                    )
                    if items:
                        result.items = items[:size]
                        result.total = len(items)
            except Exception:
                pass
    except Exception as e:
        result.error = f"连接南京博物院失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "南京博物院暂无搜索结果或接口不可用"
    if result.items:
        _set_cache(cache_key, result)
    return result


# ─── 河南博物院 (Henan Museum) ──────────────────────────

HENAN_MUSEUM_ID = "henan"
HENAN_MUSEUM_NAME = "河南博物院"


async def search_henan_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """搜索河南博物院"""
    cache_key = f"henan:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=HENAN_MUSEUM_ID,
        museum_name=HENAN_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            headers = {**COMMON_HEADERS, "Referer": "https://www.hnmuseum.com/"}

            try:
                search_url = f"https://www.hnmuseum.com/collection/search?keyword={quote(keyword)}"
                resp = await client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_generic_html(
                        resp.text, "https://www.hnmuseum.com",
                        HENAN_MUSEUM_NAME, HENAN_MUSEUM_ID
                    )
                    if items:
                        result.items = items[:size]
                        result.total = len(items)
            except Exception:
                pass
    except Exception as e:
        result.error = f"连接河南博物院失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "河南博物院暂无搜索结果或接口不可用"
    if result.items:
        _set_cache(cache_key, result)
    return result


# ─── 陕西历史博物馆 (Shaanxi History Museum) ────────────

SHAANXI_MUSEUM_ID = "shaanxi"
SHAANXI_MUSEUM_NAME = "陕西历史博物馆"


async def search_shaanxi_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """搜索陕西历史博物馆"""
    cache_key = f"shaanxi:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=SHAANXI_MUSEUM_ID,
        museum_name=SHAANXI_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            headers = {**COMMON_HEADERS, "Referer": "https://www.sxhm.com/"}

            try:
                search_url = f"https://www.sxhm.com/collection/search?keyword={quote(keyword)}"
                resp = await client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_generic_html(
                        resp.text, "https://www.sxhm.com",
                        SHAANXI_MUSEUM_NAME, SHAANXI_MUSEUM_ID
                    )
                    if items:
                        result.items = items[:size]
                        result.total = len(items)
            except Exception:
                pass
    except Exception as e:
        result.error = f"连接陕西历史博物馆失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "陕西历史博物馆暂无搜索结果或接口不可用"
    if result.items:
        _set_cache(cache_key, result)
    return result


# ─── 湖南博物院 (Hunan Museum) ──────────────────────────

HUNAN_MUSEUM_ID = "hunan"
HUNAN_MUSEUM_NAME = "湖南博物院"


async def search_hunan_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """搜索湖南博物院"""
    cache_key = f"hunan:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=HUNAN_MUSEUM_ID,
        museum_name=HUNAN_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            headers = {**COMMON_HEADERS, "Referer": "https://www.hnmuseum.com/"}

            try:
                resp = await client.get(
                    f"https://www.hnmuseum.com/zh/collections?keyword={quote(keyword)}",
                    headers=headers,
                )
                if resp.status_code == 200:
                    items = _parse_generic_html(
                        resp.text, "https://www.hnmuseum.com",
                        HUNAN_MUSEUM_NAME, HUNAN_MUSEUM_ID
                    )
                    if items:
                        result.items = items[:size]
                        result.total = len(items)
            except Exception:
                pass
    except Exception as e:
        result.error = f"连接湖南博物院失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "湖南博物院暂无搜索结果或接口不可用"
    if result.items:
        _set_cache(cache_key, result)
    return result


# ─── 台北故宫博物院 (National Palace Museum) ────────────

TAIPEI_MUSEUM_ID = "taipei"
TAIPEI_MUSEUM_NAME = "台北故宫博物院"


async def search_taipei_museum(
    keyword: str, page: int = 1, size: int = 20
) -> SearchResult:
    """
    搜索台北故宫博物院 Open Data
    台北故宫提供开放数据 API: https://data.npm.gov.tw/
    """
    cache_key = f"taipei:{keyword}:{page}:{size}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    result = SearchResult(
        museum_id=TAIPEI_MUSEUM_ID,
        museum_name=TAIPEI_MUSEUM_NAME,
        page=page,
        page_size=size,
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            headers = {**COMMON_HEADERS, "Referer": "https://www.npm.gov.tw/"}

            # 台北故宫开放数据 API
            try:
                api_url = (
                    f"https://data.npm.gov.tw/opendata/api/v1/search"
                    f"?keyword={quote(keyword)}&offset={(page-1)*size}&limit={size}"
                )
                resp = await client.get(api_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    items_data = _extract_list_data(data)
                    if items_data:
                        result.total = data.get("total", len(items_data))
                        for item in items_data:
                            artifact = _parse_taipei_item(item)
                            if artifact:
                                result.items.append(artifact)
                        if result.items:
                            _set_cache(cache_key, result)
                            return result
            except Exception:
                pass

            # 备选：搜索页面
            try:
                search_url = f"https://www.npm.gov.tw/Article.aspx?sNo=04010001&search={quote(keyword)}"
                resp = await client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    items = _parse_generic_html(
                        resp.text, "https://www.npm.gov.tw",
                        TAIPEI_MUSEUM_NAME, TAIPEI_MUSEUM_ID
                    )
                    if items:
                        result.items = items[:size]
                        result.total = len(items)
            except Exception:
                pass

    except Exception as e:
        result.error = f"连接台北故宫博物院失败: {str(e)}"

    if not result.items and not result.error:
        result.error = "台北故宫博物院暂无搜索结果或接口不可用"
    if result.items:
        _set_cache(cache_key, result)
    return result


def _parse_taipei_item(item: dict) -> Optional[ArtifactResult]:
    """解析台北故宫开放数据"""
    try:
        title = item.get("title", item.get("name", ""))
        if not title:
            return None

        item_id = str(item.get("id", hashlib.md5(title.encode()).hexdigest()[:12]))
        image = item.get("imageUrl", item.get("image", item.get("coverImage", "")))

        return ArtifactResult(
            id=f"taipei-{item_id}",
            title=title,
            dynasty=item.get("dynasty", item.get("era", "")),
            category=item.get("type", item.get("category", "")),
            museum=TAIPEI_MUSEUM_NAME,
            museum_id=TAIPEI_MUSEUM_ID,
            image_url=image,
            thumbnail_url=image,
            detail_url=item.get("url", item.get("detailUrl", "")),
            description=item.get("description", item.get("desc", "")),
            material=item.get("material", ""),
            dimensions=item.get("size", item.get("dimensions", "")),
            artist=item.get("author", item.get("artist", "")),
        )
    except Exception:
        return None


# ─── Generic Parsers ────────────────────────────────────


def _parse_generic_museum_item(
    item: dict, museum_name: str, museum_id: str, base_url: str
) -> Optional[ArtifactResult]:
    """通用博物馆 JSON 项目解析"""
    try:
        name_keys = ["name", "title", "culturalName", "collectionName", "relicName", "artName"]
        title = ""
        for k in name_keys:
            title = item.get(k, "")
            if title:
                break
        if not title:
            return None

        item_id = str(item.get("id", hashlib.md5(title.encode()).hexdigest()[:12]))

        image_keys = ["image", "imageUrl", "pic", "coverImg", "img", "thumbnail", "photo"]
        image = ""
        for k in image_keys:
            image = item.get(k, "")
            if image:
                break
        if image and not image.startswith("http"):
            image = urljoin(base_url, image)

        dynasty_keys = ["dynasty", "era", "age", "period", "年代"]
        dynasty = ""
        for k in dynasty_keys:
            dynasty = item.get(k, "")
            if dynasty:
                break

        return ArtifactResult(
            id=f"{museum_id}-{item_id}",
            title=title,
            dynasty=dynasty,
            category=item.get("type", item.get("category", item.get("classification", ""))),
            museum=museum_name,
            museum_id=museum_id,
            image_url=image,
            thumbnail_url=image,
            detail_url=item.get("detailUrl", item.get("url", "")),
            description=item.get("description", item.get("desc", item.get("remark", ""))),
            material=item.get("material", item.get("texture", item.get("质地", ""))),
            dimensions=item.get("size", item.get("dimensions", item.get("尺寸", ""))),
            artist=item.get("author", item.get("artist", "")),
        )
    except Exception:
        return None


def _parse_generic_html(
    html: str, base_url: str, museum_name: str, museum_id: str
) -> List[ArtifactResult]:
    """通用 HTML 解析 — 适用于大多数博物馆网站结构"""
    items = []
    try:
        soup = BeautifulSoup(html, "html.parser")

        selectors = [
            ".collection-item", ".search-item", ".result-item",
            ".list-item", ".card-item", ".art-item",
            "[class*=collection] li", "[class*=list] li",
            ".pic-list li", ".grid-item", "article",
        ]

        cards = []
        for sel in selectors:
            cards = soup.select(sel)
            if len(cards) >= 2:
                break

        if not cards:
            cards = soup.select("li, .item, .card")

        seen_titles = set()
        for card in cards[:40]:
            title_el = card.select_one(
                "h2, h3, h4, .title, .name, .tit, "
                "[class*=title], [class*=name]"
            )
            if not title_el:
                link_with_text = card.select_one("a")
                if link_with_text and link_with_text.get_text(strip=True):
                    title_el = link_with_text

            title = title_el.get_text(strip=True) if title_el else ""
            if not title or len(title) < 2 or title in seen_titles:
                continue
            seen_titles.add(title)

            img_el = card.select_one("img")
            image = ""
            if img_el:
                image = (
                    img_el.get("src", "")
                    or img_el.get("data-src", "")
                    or img_el.get("data-original", "")
                    or img_el.get("data-lazy", "")
                )
                if image and not image.startswith("http"):
                    image = urljoin(base_url, image)

            link_el = card.select_one("a[href]")
            detail_url = ""
            if link_el:
                href = link_el.get("href", "")
                if href and href != "#" and href != "javascript:;":
                    detail_url = urljoin(base_url, href)

            dynasty = ""
            for cls in ["dynasty", "era", "age", "date", "period"]:
                dyn_el = card.select_one(f".{cls}, [class*={cls}]")
                if dyn_el:
                    dynasty = dyn_el.get_text(strip=True)
                    break

            desc_el = card.select_one(".desc, .info, .summary, .intro, p")
            desc = ""
            if desc_el and desc_el != title_el:
                desc = desc_el.get_text(strip=True)

            items.append(ArtifactResult(
                id=f"{museum_id}-{hashlib.md5(title.encode()).hexdigest()[:12]}",
                title=title,
                dynasty=dynasty,
                museum=museum_name,
                museum_id=museum_id,
                image_url=image,
                thumbnail_url=image,
                detail_url=detail_url,
                description=desc,
            ))
    except Exception:
        pass
    return items


# ─── Unified Search ─────────────────────────────────────

MUSEUM_SEARCHERS = {
    PALACE_MUSEUM_ID: search_palace_museum,
    NATIONAL_MUSEUM_ID: search_national_museum,
    SHANGHAI_MUSEUM_ID: search_shanghai_museum,
    NANJING_MUSEUM_ID: search_nanjing_museum,
    HENAN_MUSEUM_ID: search_henan_museum,
    SHAANXI_MUSEUM_ID: search_shaanxi_museum,
    HUNAN_MUSEUM_ID: search_hunan_museum,
    TAIPEI_MUSEUM_ID: search_taipei_museum,
}

MUSEUM_NAMES = {
    PALACE_MUSEUM_ID: PALACE_MUSEUM_NAME,
    NATIONAL_MUSEUM_ID: NATIONAL_MUSEUM_NAME,
    SHANGHAI_MUSEUM_ID: SHANGHAI_MUSEUM_NAME,
    NANJING_MUSEUM_ID: NANJING_MUSEUM_NAME,
    HENAN_MUSEUM_ID: HENAN_MUSEUM_NAME,
    SHAANXI_MUSEUM_ID: SHAANXI_MUSEUM_NAME,
    HUNAN_MUSEUM_ID: HUNAN_MUSEUM_NAME,
    TAIPEI_MUSEUM_ID: TAIPEI_MUSEUM_NAME,
}


async def search_all_chinese_museums(
    keyword: str,
    museum_ids: Optional[List[str]] = None,
    page: int = 1,
    size: int = 20,
) -> Dict[str, SearchResult]:
    """并发搜索多个博物馆"""
    if museum_ids is None:
        museum_ids = list(MUSEUM_SEARCHERS.keys())

    tasks = {}
    for mid in museum_ids:
        if mid in MUSEUM_SEARCHERS:
            tasks[mid] = MUSEUM_SEARCHERS[mid](keyword, page, size)

    results = {}
    settled = await asyncio.gather(*tasks.values(), return_exceptions=True)

    for mid, res in zip(tasks.keys(), settled):
        if isinstance(res, Exception):
            results[mid] = SearchResult(
                museum_id=mid,
                museum_name=MUSEUM_NAMES.get(mid, mid),
                error=f"搜索失败: {str(res)}",
            )
        else:
            results[mid] = res

    return results


# ─── Image Proxy ────────────────────────────────────────


async def proxy_image(url: str) -> Optional[bytes]:
    """代理获取博物馆图片（解决 CORS 问题）"""
    if not url or not url.startswith("http"):
        return None

    cache_key = f"img:{hashlib.md5(url.encode()).hexdigest()}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    try:
        parsed = urlparse(url)
        headers = {
            **COMMON_HEADERS,
            "Referer": f"{parsed.scheme}://{parsed.netloc}/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        }

        async with httpx.AsyncClient(
            timeout=20.0, follow_redirects=True, verify=False
        ) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
                data = resp.content
                _set_cache(cache_key, data)
                return data
    except Exception:
        pass

    return None


@dataclass
class ExhibitionEvent:
    id: str
    title: str
    museum: str
    city: str
    start_date: str
    end_date: str
    highlights: List[str] = field(default_factory=list)
    address: str = ""
    hall: str = ""
    fee: str = ""
    open_hours: str = ""
    city_slug: str = ""
    cover_url: str = ""
    poster_url: str = ""
    source: str = ""
    source_url: str = ""
    updated_at: str = ""
    raw_excerpt: str = ""


def _today_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _parse_iso_date(value: str) -> Optional[date]:
    if not value:
        return None
    normalized = value.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(normalized, fmt).date()
        except Exception:
            continue
    return None


def _normalize_date_text(value: str) -> Optional[str]:
    if not value:
        return None
    text = value.strip()
    direct = _parse_iso_date(text)
    if direct:
        return direct.strftime("%Y-%m-%d")

    text = text.replace("年", "-").replace("月", "-").replace("日", "")
    text = re.sub(r"[./]", "-", text)
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")

    direct = _parse_iso_date(text)
    if direct:
        return direct.strftime("%Y-%m-%d")

    md = re.search(r"(?P<m>\d{1,2})-(?P<d>\d{1,2})", text)
    if md:
        current_year = datetime.now().year
        candidate = f"{current_year}-{int(md.group('m')):02d}-{int(md.group('d')):02d}"
        dt = _parse_iso_date(candidate)
        if dt:
            return dt.strftime("%Y-%m-%d")

    return None


def _extract_date_range_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None
    compact = text.replace("至", "-").replace("—", "-").replace("~", "-")
    date_candidates = re.findall(r"\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}月\d{1,2}日", compact)
    normalized = [_normalize_date_text(item) for item in date_candidates]
    normalized = [item for item in normalized if item]
    if len(normalized) >= 2:
        return normalized[0], normalized[1]
    if len(normalized) == 1:
        return normalized[0], normalized[0]
    return None, None


def _to_highlights(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()][:6]
    if isinstance(value, str):
        parts = re.split(r"[；;。.!?\n]+", value)
        return [p.strip() for p in parts if p.strip()][:6]
    return []


def _extract_events_from_json(payload: Any, source: str, source_url: str) -> List[ExhibitionEvent]:
    events: List[ExhibitionEvent] = []

    def walk(node: Any):
        if isinstance(node, list):
            for item in node:
                walk(item)
            return

        if isinstance(node, dict):
            title = (
                node.get("title")
                or node.get("name")
                or node.get("event_title")
                or node.get("exhibition_title")
                or node.get("exhibitionName")
                or ""
            )

            start = (
                node.get("start_date")
                or node.get("startDate")
                or node.get("begin_date")
                or node.get("beginDate")
                or node.get("open_date")
                or node.get("openDate")
                or ""
            )
            end = (
                node.get("end_date")
                or node.get("endDate")
                or node.get("close_date")
                or node.get("closeDate")
                or node.get("deadline")
                or ""
            )

            museum = (
                node.get("museum")
                or node.get("venue")
                or node.get("institution")
                or node.get("organizer")
                or ""
            )
            city = node.get("city") or node.get("location") or node.get("city_name") or ""

            if title:
                start_date = _normalize_date_text(str(start)) if start else None
                end_date = _normalize_date_text(str(end)) if end else None

                if not start_date or not end_date:
                    fallback_start, fallback_end = _extract_date_range_from_text(
                        f"{node.get('date', '')} {node.get('date_range', '')} {node.get('period', '')}"
                    )
                    start_date = start_date or fallback_start
                    end_date = end_date or fallback_end

                if start_date and end_date:
                    highlights = _to_highlights(
                        node.get("highlights")
                        or node.get("focus")
                        or node.get("key_points")
                        or node.get("tags")
                        or node.get("keywords")
                        or node.get("description")
                        or node.get("summary")
                    )
                    detail_url = (
                        node.get("url")
                        or node.get("link")
                        or node.get("detail_url")
                        or source_url
                    )
                    raw_excerpt = str(node.get("description") or node.get("summary") or "")[:240]
                    cover_url = (
                        node.get("cover")
                        or node.get("cover_url")
                        or node.get("coverUrl")
                        or node.get("image")
                        or node.get("image_url")
                        or node.get("imageUrl")
                        or ""
                    )
                    poster_url = (
                        node.get("poster")
                        or node.get("poster_url")
                        or node.get("posterUrl")
                        or node.get("banner")
                        or node.get("banner_url")
                        or ""
                    )
                    event_id = hashlib.md5(
                        f"{title}|{museum}|{city}|{start_date}|{end_date}".encode()
                    ).hexdigest()[:16]
                    events.append(
                        ExhibitionEvent(
                            id=f"evt-{event_id}",
                            title=str(title).strip(),
                            museum=str(museum).strip() or "未知场馆",
                            city=str(city).strip() or "未知城市",
                            start_date=start_date,
                            end_date=end_date,
                            highlights=highlights,
                            cover_url=str(cover_url).strip(),
                            poster_url=str(poster_url).strip(),
                            source=source,
                            source_url=str(detail_url),
                            updated_at=_today_iso(),
                            raw_excerpt=raw_excerpt,
                        )
                    )

            for value in node.values():
                walk(value)

    walk(payload)
    deduped: Dict[str, ExhibitionEvent] = {}
    for event in events:
        key = f"{event.title}|{event.museum}|{event.start_date}|{event.end_date}"
        deduped[key] = event
    return list(deduped.values())


def _extract_events_from_html(html: str, source: str, source_url: str, museum: str = "", city: str = "") -> List[ExhibitionEvent]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("article, .event, .exhibition, .card, li, .item")
    events: List[ExhibitionEvent] = []
    seen: set[str] = set()

    for card in cards[:200]:
        title_el = card.select_one("h1, h2, h3, h4, .title, [class*=title], a")
        title = title_el.get_text(strip=True) if title_el else ""
        if len(title) < 3 or title in seen:
            continue

        text = card.get_text(" ", strip=True)
        start_date, end_date = _extract_date_range_from_text(text)
        if not start_date or not end_date:
            continue

        link_el = card.select_one("a[href]")
        link = source_url
        if link_el:
            href = link_el.get("href", "")
            if href:
                link = urljoin(source_url, href)

        local_city = city
        if not local_city:
            city_match = re.search(r"(北京|上海|广州|深圳|南京|杭州|苏州|西安|成都|重庆|武汉|郑州|长沙|天津|青岛|厦门)", text)
            local_city = city_match.group(1) if city_match else "未知城市"

        local_museum = museum
        if not local_museum:
            local_museum = title.split("：")[0] if "：" in title else "未知场馆"

        highlights = _to_highlights(text)
        raw_excerpt = text[:240]
        cover_el = card.select_one("img")
        cover_url = ""
        if cover_el:
            src = cover_el.get("src") or cover_el.get("data-src") or ""
            if src:
                cover_url = urljoin(source_url, src)
        event_id = hashlib.md5(
            f"{title}|{local_museum}|{local_city}|{start_date}|{end_date}".encode()
        ).hexdigest()[:16]

        event = ExhibitionEvent(
            id=f"evt-{event_id}",
            title=title,
            museum=local_museum,
            city=local_city,
            start_date=start_date,
            end_date=end_date,
            highlights=highlights,
            cover_url=cover_url,
            source=source,
            source_url=link,
            updated_at=_today_iso(),
            raw_excerpt=raw_excerpt,
        )
        seen.add(title)
        events.append(event)

    return events


WECHAT_EVENT_SOURCES: List[Dict[str, str]] = json.loads(
    os.getenv("MUSEUM_EVENT_SOURCES_JSON", "[]")
)
ICITY_MAX_PAGES = max(1, int(os.getenv("ICITY_MAX_PAGES", "6")))
ICITY_MAX_DETAILS = max(1, int(os.getenv("ICITY_MAX_DETAILS", "8000")))
ICITY_CITY_LIMIT = max(0, int(os.getenv("ICITY_CITY_LIMIT", "0")))
ICITY_AUTH_COOKIE = os.getenv("ICITY_AUTH_COOKIE", "").strip()
ICITY_AUTHORIZATION = os.getenv("ICITY_AUTHORIZATION", "").strip()
BASE_DIR = Path(__file__).resolve().parent
EVENT_JSON_PATH = Path(
    os.getenv("MUSEUM_EVENT_JSON_PATH", str(BASE_DIR / "data" / "exhibitions_latest.json"))
)
EVENT_SNAPSHOT_DIR = Path(
    os.getenv("MUSEUM_EVENT_SNAPSHOT_DIR", str(BASE_DIR / "data" / "snapshots"))
)
LEGACY_EVENT_JSON_PATH = BASE_DIR / "backend" / "data" / "exhibitions_latest.json"

_event_store: List[ExhibitionEvent] = []
_event_last_refresh_ts: float = 0.0
_event_last_error: str = ""
EVENT_CACHE_TTL_SECONDS = 60 * 30
_event_refresh_task: Optional[asyncio.Task] = None


def _icity_headers() -> Dict[str, str]:
    headers = {
        **COMMON_HEADERS,
        "Referer": "https://art.icity.ly/",
        "Origin": "https://art.icity.ly",
    }
    if ICITY_AUTH_COOKIE:
        headers["Cookie"] = ICITY_AUTH_COOKIE
    if ICITY_AUTHORIZATION:
        headers["Authorization"] = ICITY_AUTHORIZATION
    return headers


def _ensure_event_storage():
    EVENT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVENT_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


def _persist_events(events: List[ExhibitionEvent]):
    _ensure_event_storage()
    payload = [asdict(item) for item in events]
    EVENT_JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    snapshot_file = EVENT_SNAPSHOT_DIR / f"events_{datetime.now().strftime('%Y%m%d')}.json"
    snapshot_file.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_events_from_json() -> List[ExhibitionEvent]:
    source_path = EVENT_JSON_PATH
    if not source_path.exists() and LEGACY_EVENT_JSON_PATH.exists():
        source_path = LEGACY_EVENT_JSON_PATH
    if not source_path.exists():
        return []
    try:
        payload = json.loads(source_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    items: List[ExhibitionEvent] = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        highlights = row.get("highlights", [])
        if not isinstance(highlights, list):
            highlights = []
        items.append(
            ExhibitionEvent(
                id=str(row.get("id", "")),
                title=str(row.get("title", "")),
                museum=str(row.get("museum", "")),
                city=str(row.get("city", "")),
                city_slug=str(row.get("city_slug", "")),
                start_date=str(row.get("start_date", "")),
                end_date=str(row.get("end_date", "")),
                address=str(row.get("address", "")),
                hall=str(row.get("hall", "")),
                fee=str(row.get("fee", "")),
                open_hours=str(row.get("open_hours", "")),
                cover_url=str(row.get("cover_url", "")),
                poster_url=str(row.get("poster_url", "")),
                highlights=highlights,
                source=str(row.get("source", "")),
                source_url=str(row.get("source_url", "")),
                updated_at=str(row.get("updated_at", "")),
                raw_excerpt=str(row.get("raw_excerpt", "")),
            )
        )
    return items


def _restore_event_store_from_json():
    global _event_store, _event_last_refresh_ts
    if _event_store:
        return
    cached = _load_events_from_json()
    if not cached:
        return
    _event_store = cached
    try:
        _event_last_refresh_ts = EVENT_JSON_PATH.stat().st_mtime
    except Exception:
        _event_last_refresh_ts = time.time()


def _is_refresh_running() -> bool:
    return _event_refresh_task is not None and not _event_refresh_task.done()


def _schedule_background_refresh():
    global _event_refresh_task
    if _is_refresh_running():
        return
    loop = asyncio.get_running_loop()
    _event_refresh_task = loop.create_task(refresh_exhibition_events(force=True))


def _icity_normalize_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None
    compact = text.replace("至", "-").replace("—", "-").replace("~", "-")
    m = re.search(
        r"(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*-\s*(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})日",
        compact,
    )
    if m:
        start_year = int(m.group(1))
        start_month = int(m.group(2))
        start_day = int(m.group(3))
        end_year = int(m.group(4)) if m.group(4) else start_year
        end_month = int(m.group(5))
        end_day = int(m.group(6))
        if not m.group(4) and end_month < start_month:
            end_year += 1
        start_iso = _normalize_date_text(f"{start_year}-{start_month:02d}-{start_day:02d}")
        end_iso = _normalize_date_text(f"{end_year}-{end_month:02d}-{end_day:02d}")
        return start_iso, end_iso
    return _extract_date_range_from_text(text)


def _icity_extract_city(address: str, fallback: str = "") -> str:
    if fallback:
        return fallback
    if not address:
        return "未知城市"
    m = re.search(r"(北京市|上海市|天津市|重庆市|[\u4e00-\u9fa5]{2,8}市|香港|澳门|台北|台湾)", address)
    if not m:
        return "未知城市"
    city = m.group(1)
    return city.replace("市", "") if city.endswith("市") else city


def _extract_city_links(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    slugs: List[str] = []
    seen: set[str] = set()
    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        if not re.match(r"^/[a-z\-]+$", href):
            continue
        slug = href.strip("/")
        if slug in {
            "events",
            "entries",
            "museums",
            "world",
            "hongkong",
            "taiwan",
            "macao",
        }:
            continue
        if slug not in seen:
            seen.add(slug)
            slugs.append(slug)
    return slugs


def _icity_parse_list_page(html: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    entries: List[Dict[str, str]] = []
    seen: set[str] = set()

    for item in soup.select("ul.imsm-entries.list > li"):
        link_el = item.select_one("a[href*='/events/']")
        info_el = item.select_one("a.info[href*='/events/']")
        title_el = item.select_one(".title")
        museum_el = item.select_one(".subtitle")
        cover_el = item.select_one("img.cover, img.thumb, img")

        href = ""
        if info_el:
            href = info_el.get("href", "")
        elif link_el:
            href = link_el.get("href", "")
        if not href or "/events/" not in href:
            continue

        slug = href.rstrip("/").split("/")[-1]
        if slug in seen:
            continue
        seen.add(slug)

        title = title_el.get_text(strip=True) if title_el else ""
        museum = museum_el.get_text(" ", strip=True) if museum_el else ""
        museum = museum.replace("展览", "").strip()
        cover_url = ""
        if cover_el:
            src = cover_el.get("src") or cover_el.get("data-src") or ""
            if src:
                cover_url = urljoin("https://art.icity.ly", src)
        entries.append(
            {
                "slug": slug,
                "title": title,
                "museum": museum,
                "url": urljoin("https://art.icity.ly", href),
                "cover_url": cover_url,
            }
        )

    return entries


async def _fetch_icity_event_detail(
    client: httpx.AsyncClient,
    event_meta: Dict[str, str],
    semaphore: asyncio.Semaphore,
) -> Optional[ExhibitionEvent]:
    async with semaphore:
        url = event_meta.get("url", "")
        if not url:
            return None
        try:
            resp = await client.get(url, headers=_icity_headers())
        except Exception:
            return None
        if resp.status_code != 200:
            return None
        html = resp.text
        if "登录" in html and "password" in html and not ICITY_AUTH_COOKIE:
            return None

        soup = BeautifulSoup(html, "html.parser")
        title_el = soup.select_one("h1.nm")
        title = title_el.get_text(strip=True) if title_el else event_meta.get("title", "").strip()
        if not title:
            return None

        info_map: Dict[str, str] = {}
        for row in soup.select("table.info-fields tr"):
            key_el = row.select_one("td.title")
            val_els = row.select("td")
            if not key_el or len(val_els) < 2:
                continue
            key = key_el.get_text(strip=True)
            value = val_els[1].get_text(" ", strip=True)
            info_map[key] = value

        time_text = info_map.get("时间", "")
        start_date, end_date = _icity_normalize_date_range(time_text)
        if not start_date or not end_date:
            start_date, end_date = _extract_date_range_from_text(soup.get_text(" ", strip=True))
        if not start_date or not end_date:
            return None

        museum = info_map.get("展馆", "").strip() or event_meta.get("museum", "").strip() or "未知场馆"
        address = info_map.get("地址", "").strip()
        city = _icity_extract_city(address)
        hall = info_map.get("展厅", "").strip()
        fee = info_map.get("费用", "").strip()
        open_hours = time_text.strip()

        content_blocks = [node.get_text(" ", strip=True) for node in soup.select("div.content p")]
        content_text = " ".join([item for item in content_blocks if item]).strip()
        highlights = _to_highlights(content_text)[:6]
        raw_excerpt = content_text[:240]
        cover_el = soup.select_one("img.cover")
        poster_el = soup.select_one("img.fit-width")
        cover_url = event_meta.get("cover_url", "").strip()
        poster_url = ""
        if cover_el:
            src = cover_el.get("src") or cover_el.get("data-src") or ""
            if src:
                cover_url = urljoin(url, src)
        if poster_el:
            src = poster_el.get("src") or poster_el.get("data-src") or ""
            if src:
                poster_url = urljoin(url, src)

        event_id = hashlib.md5(
            f"{title}|{museum}|{city}|{start_date}|{end_date}".encode()
        ).hexdigest()[:16]
        return ExhibitionEvent(
            id=f"evt-{event_id}",
            title=title,
            museum=museum,
            city=city,
            start_date=start_date,
            end_date=end_date,
            highlights=highlights,
            address=address,
            hall=hall,
            fee=fee,
            open_hours=open_hours,
            city_slug=event_meta.get("city_slug", ""),
            cover_url=cover_url,
            poster_url=poster_url,
            source="icity",
            source_url=url,
            updated_at=_today_iso(),
            raw_excerpt=raw_excerpt,
        )


async def _fetch_icity_events() -> List[ExhibitionEvent]:
    root_url = "https://art.icity.ly/"
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
        city_slugs: List[str] = []
        try:
            root = await client.get(root_url, headers=_icity_headers())
            if root.status_code == 200:
                city_slugs = _extract_city_links(root.text)
        except Exception:
            city_slugs = []

        if not city_slugs:
            city_slugs = ["beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "xian"]
        if ICITY_CITY_LIMIT > 0:
            city_slugs = city_slugs[:ICITY_CITY_LIMIT]

        metas: List[Dict[str, str]] = []
        seen: set[str] = set()
        for city_slug in city_slugs:
            base = f"https://art.icity.ly/{city_slug}?order=all"
            for page in range(1, ICITY_MAX_PAGES + 1):
                join_char = "&" if "?" in base else "?"
                url = f"{base}{join_char}page={page}"
                try:
                    resp = await client.get(url, headers=_icity_headers())
                except Exception:
                    continue
                if resp.status_code != 200:
                    continue
                html = resp.text
                if "页面不存在" in html:
                    continue
                parsed = _icity_parse_list_page(html)
                if not parsed:
                    continue
                new_count = 0
                for item in parsed:
                    if item["slug"] in seen:
                        continue
                    seen.add(item["slug"])
                    item["city_slug"] = city_slug
                    metas.append(item)
                    new_count += 1
                if new_count == 0:
                    break

        if not metas:
            return []

        metas = metas[:ICITY_MAX_DETAILS]
        semaphore = asyncio.Semaphore(8)
        detail_tasks = [
            _fetch_icity_event_detail(client, item, semaphore)
            for item in metas
        ]
        settled = await asyncio.gather(*detail_tasks, return_exceptions=True)
        events: List[ExhibitionEvent] = []
        for result in settled:
            if isinstance(result, ExhibitionEvent):
                events.append(result)
        if events:
            return events

        candidates = [
            "https://art.icity.ly/events",
            "https://art.icity.ly/api/events",
            "https://art.icity.ly/events.json",
        ]
        for url in candidates:
            try:
                resp = await client.get(url, headers=_icity_headers())
            except Exception:
                continue

            if resp.status_code != 200:
                continue

            content_type = resp.headers.get("content-type", "")
            if "json" in content_type:
                try:
                    payload = resp.json()
                    fallback_events = _extract_events_from_json(payload, "icity", url)
                    if fallback_events:
                        return fallback_events
                except Exception:
                    continue
            fallback_events = _extract_events_from_html(resp.text, "icity", url)
            if fallback_events:
                return fallback_events
    return []


async def _fetch_wechat_events() -> List[ExhibitionEvent]:
    events: List[ExhibitionEvent] = []
    if not WECHAT_EVENT_SOURCES:
        return events

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
        for source in WECHAT_EVENT_SOURCES:
            source_name = source.get("name", "wechat")
            url = source.get("url", "")
            if not url:
                continue
            museum = source.get("museum", "")
            city = source.get("city", "")
            try:
                resp = await client.get(url, headers=COMMON_HEADERS)
            except Exception:
                continue
            if resp.status_code != 200:
                continue
            content_type = resp.headers.get("content-type", "")
            if "json" in content_type:
                try:
                    payload = resp.json()
                    events.extend(_extract_events_from_json(payload, source_name, url))
                    continue
                except Exception:
                    pass
            events.extend(_extract_events_from_html(resp.text, source_name, url, museum, city))
    return events


def _event_overlap(
    event_start: date,
    event_end: date,
    query_start: Optional[date],
    query_end: Optional[date],
) -> bool:
    long_term = event_start == event_end
    effective_end = date.max if long_term else event_end
    if query_start and effective_end < query_start:
        return False
    if query_end and event_start > query_end:
        return False
    return True


def _filter_events(
    events: List[ExhibitionEvent],
    city: str = "",
    start_date: str = "",
    end_date: str = "",
    keyword: str = "",
) -> List[ExhibitionEvent]:
    query_start = _parse_iso_date(start_date) if start_date else None
    query_end = _parse_iso_date(end_date) if end_date else None
    city_kw = city.strip().lower()
    keyword_kw = keyword.strip().lower()

    filtered: List[ExhibitionEvent] = []
    for event in events:
        if city_kw:
            city_text = f"{event.city} {event.museum} {event.address}".lower()
            if city_kw not in city_text and city_kw != event.city_slug.lower():
                continue

        event_start = _parse_iso_date(event.start_date)
        event_end = _parse_iso_date(event.end_date)
        if event_start and event_end and (query_start or query_end):
            if not _event_overlap(event_start, event_end, query_start, query_end):
                continue

        if keyword_kw:
            haystack = " ".join([
                event.title,
                event.museum,
                event.city,
                event.address,
                " ".join(event.highlights),
                event.raw_excerpt,
            ]).lower()
            if keyword_kw not in haystack:
                continue

        filtered.append(event)
    return filtered


async def refresh_exhibition_events(force: bool = False) -> Dict[str, Any]:
    global _event_store, _event_last_refresh_ts, _event_last_error, _event_refresh_task

    _restore_event_store_from_json()

    if not force and _event_store and time.time() - _event_last_refresh_ts < EVENT_CACHE_TTL_SECONDS:
        return {
            "count": len(_event_store),
            "last_refresh": datetime.fromtimestamp(_event_last_refresh_ts).isoformat(),
            "error": _event_last_error,
        }

    if not force:
        if _event_store:
            _schedule_background_refresh()
            return {
                "count": len(_event_store),
                "last_refresh": datetime.fromtimestamp(_event_last_refresh_ts).isoformat() if _event_last_refresh_ts else "",
                "error": _event_last_error,
            }
        _schedule_background_refresh()
        return {
            "count": 0,
            "last_refresh": "",
            "error": _event_last_error or "展览数据正在后台初始化，请稍后重试",
        }

    events: List[ExhibitionEvent] = []
    errors: List[str] = []

    try:
        events.extend(await _fetch_icity_events())
    except Exception as exc:
        errors.append(f"icity: {exc}")

    try:
        events.extend(await _fetch_wechat_events())
    except Exception as exc:
        errors.append(f"wechat: {exc}")

    deduped: Dict[str, ExhibitionEvent] = {}
    for event in events:
        key = f"{event.title}|{event.museum}|{event.city}|{event.start_date}|{event.end_date}"
        deduped[key] = event

    _event_store = sorted(
        deduped.values(),
        key=lambda item: (item.start_date, item.end_date, item.city, item.museum),
    )
    if _event_store:
        _persist_events(_event_store)
    else:
        cached = _load_events_from_json()
        if cached:
            _event_store = cached
    _event_last_refresh_ts = time.time()
    _event_last_error = " | ".join(errors) if errors else ""
    _event_refresh_task = None

    return {
        "count": len(_event_store),
        "last_refresh": datetime.fromtimestamp(_event_last_refresh_ts).isoformat(),
        "error": _event_last_error,
    }


async def list_exhibition_events(
    city: str = "",
    start_date: str = "",
    end_date: str = "",
    keyword: str = "",
    page: int = 1,
    size: int = 20,
) -> Dict[str, Any]:
    await refresh_exhibition_events(force=False)
    filtered = _filter_events(
        _event_store,
        city=city,
        start_date=start_date,
        end_date=end_date,
        keyword=keyword,
    )

    filtered.sort(key=lambda item: (item.start_date, item.end_date, item.city, item.museum))
    total = len(filtered)
    start_index = max(0, (page - 1) * size)
    end_index = start_index + size
    page_items = filtered[start_index:end_index]

    return {
        "items": [asdict(item) for item in page_items],
        "total": total,
        "page": page,
        "size": size,
        "last_refresh": datetime.fromtimestamp(_event_last_refresh_ts).isoformat() if _event_last_refresh_ts else "",
        "error": _event_last_error,
        "sources": {
            "icity": "https://art.icity.ly/events",
            "wechat_configured_count": len(WECHAT_EVENT_SOURCES),
        },
    }


async def get_exhibition_overview(
    city: str = "",
    start_date: str = "",
    end_date: str = "",
    keyword: str = "",
    event_limit: int = 1000,
) -> Dict[str, Any]:
    await refresh_exhibition_events(force=False)
    filtered = _filter_events(
        _event_store,
        city=city,
        start_date=start_date,
        end_date=end_date,
        keyword=keyword,
    )
    city_counter: Dict[str, int] = {}
    museum_counter: Dict[str, Dict[str, Any]] = {}
    for event in filtered:
        city_counter[event.city] = city_counter.get(event.city, 0) + 1
        mkey = f"{event.city}|{event.museum}|{event.address}"
        if mkey not in museum_counter:
            museum_counter[mkey] = {
                "city": event.city,
                "city_slug": event.city_slug,
                "museum": event.museum,
                "address": event.address,
                "event_count": 0,
            }
        museum_counter[mkey]["event_count"] += 1
    cities = sorted(
        [{"city": c, "event_count": n} for c, n in city_counter.items()],
        key=lambda item: item["event_count"],
        reverse=True,
    )
    museums = sorted(
        list(museum_counter.values()),
        key=lambda item: item["event_count"],
        reverse=True,
    )
    safe_limit = max(1, min(event_limit, 5000))
    return {
        "cities": cities,
        "museums": museums,
        "events": [asdict(item) for item in filtered[:safe_limit]],
        "events_total": len(filtered),
        "events_returned": min(len(filtered), safe_limit),
        "total": len(filtered),
        "last_refresh": datetime.fromtimestamp(_event_last_refresh_ts).isoformat() if _event_last_refresh_ts else "",
    }
