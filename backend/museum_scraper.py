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
