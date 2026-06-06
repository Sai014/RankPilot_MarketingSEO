import re
from typing import Any
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree

import httpx
from bs4 import BeautifulSoup

SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
USER_AGENT = "RankPilot/1.0 (+https://rankpilot.app)"


async def _fetch_text(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        return response.text
    except httpx.HTTPError:
        return None


def _normalize_url(base: str, href: str) -> str | None:
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
        return None
    absolute = urljoin(base, href.split("#")[0].split("?")[0])
    parsed = urlparse(absolute)
    if parsed.scheme not in ("http", "https"):
        return None
    return absolute.rstrip("/") or absolute


async def _parse_sitemap_xml(client: httpx.AsyncClient, url: str) -> list[str]:
    text = await _fetch_text(client, url)
    if not text:
        return []

    urls: list[str] = []
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        return []

    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag

    if tag == "sitemapindex":
        for loc in root.findall(".//sm:loc", SITEMAP_NS) + root.findall(".//loc"):
            child_url = (loc.text or "").strip()
            if child_url:
                urls.extend(await _parse_sitemap_xml(client, child_url))
    elif tag == "urlset":
        for loc in root.findall(".//sm:loc", SITEMAP_NS) + root.findall(".//loc"):
            page_url = (loc.text or "").strip()
            if page_url:
                urls.append(page_url)

    return urls


async def _discover_sitemap_urls(client: httpx.AsyncClient, site_url: str) -> list[str]:
    parsed = urlparse(site_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    candidates = [
        urljoin(base, "/sitemap.xml"),
        urljoin(base, "/sitemap_index.xml"),
        urljoin(base, "/sitemap-index.xml"),
    ]

    for candidate in candidates:
        urls = await _parse_sitemap_xml(client, candidate)
        if urls:
            return urls
    return []


async def _crawl_internal_links(
    client: httpx.AsyncClient,
    start_url: str,
    max_pages: int = 50,
) -> list[str]:
    parsed_start = urlparse(start_url)
    base_domain = parsed_start.netloc
    visited: set[str] = set()
    queue: list[str] = [start_url.rstrip("/")]
    found: list[str] = []

    while queue and len(found) < max_pages:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)

        html = await _fetch_text(client, current)
        if not html:
            continue

        found.append(current)
        soup = BeautifulSoup(html, "lxml")
        for anchor in soup.find_all("a", href=True):
            normalized = _normalize_url(current, anchor["href"])
            if not normalized:
                continue
            if urlparse(normalized).netloc != base_domain:
                continue
            if normalized not in visited and normalized not in queue:
                queue.append(normalized)

    return found


async def crawl_sitemap(site_url: str, max_pages: int = 100) -> dict[str, Any]:
    """Discover URLs via sitemap.xml or fallback internal crawl."""
    if not re.match(r"^https?://", site_url):
        site_url = f"https://{site_url}"

    headers = {"User-Agent": USER_AGENT}
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        urls = await _discover_sitemap_urls(client, site_url)

        source = "sitemap"
        if not urls:
            source = "crawl"
            urls = await _crawl_internal_links(client, site_url, max_pages=min(max_pages, 50))

        urls = list(dict.fromkeys(urls))[:max_pages]

        pages: list[dict[str, Any]] = []
        enrich_limit = min(len(urls), 30)
        for url in urls[:enrich_limit]:
            html = await _fetch_text(client, url)
            if not html:
                pages.append({"url": url, "title": None, "status": "error"})
                continue

            soup = BeautifulSoup(html, "lxml")
            title_tag = soup.find("title")
            meta_desc = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
            h1 = soup.find("h1")

            pages.append(
                {
                    "url": url,
                    "title": title_tag.get_text(strip=True) if title_tag else None,
                    "meta_description": meta_desc.get("content") if meta_desc else None,
                    "h1": h1.get_text(strip=True) if h1 else None,
                    "status": "ok",
                }
            )

    page_map = {p["url"]: p for p in pages}
    all_pages = []
    for url in urls:
        if url in page_map:
            all_pages.append(page_map[url])
        else:
            all_pages.append({"url": url, "title": None, "meta_description": None, "h1": None, "status": "pending"})

    return {
        "site_url": site_url,
        "source": source,
        "total_urls": len(urls),
        "urls": urls,
        "sample_pages": all_pages,
    }
