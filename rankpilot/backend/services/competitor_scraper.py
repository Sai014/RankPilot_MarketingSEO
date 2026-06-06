import re
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "RankPilot/1.0 (+https://rankpilot.app)"


async def scrape_competitor(url: str) -> dict[str, Any]:
    """Scrape on-page SEO signals from a competitor URL."""
    if not re.match(r"^https?://", url):
        url = f"https://{url}"

    headers = {"User-Agent": USER_AGENT}
    async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text
        final_url = str(response.url)

    soup = BeautifulSoup(html, "lxml")

    title = soup.find("title")
    meta_desc = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
    canonical = soup.find("link", rel="canonical")
    robots = soup.find("meta", attrs={"name": re.compile(r"robots", re.I)})

    h1_tags = [h.get_text(strip=True) for h in soup.find_all("h1")]
    h2_tags = [h.get_text(strip=True) for h in soup.find_all("h2")][:10]

    images = soup.find_all("img")
    images_without_alt = sum(1 for img in images if not img.get("alt", "").strip())

    internal_links: set[str] = set()
    external_links: set[str] = set()
    base_domain = urlparse(final_url).netloc

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(final_url, href.split("#")[0])
        link_domain = urlparse(absolute).netloc
        if link_domain == base_domain:
            internal_links.add(absolute)
        elif link_domain:
            external_links.add(absolute)

    word_count = len(soup.get_text(separator=" ", strip=True).split())
    schema_scripts = [
        script.get_text(strip=True)[:200]
        for script in soup.find_all("script", type="application/ld+json")
    ]

    og_tags = {}
    for prop in ("title", "description", "image", "url", "type"):
        tag = soup.find("meta", property=f"og:{prop}")
        if tag and tag.get("content"):
            og_tags[prop] = tag["content"]

    return {
        "url": final_url,
        "title": title.get_text(strip=True) if title else None,
        "title_length": len(title.get_text(strip=True)) if title else 0,
        "meta_description": meta_desc.get("content") if meta_desc else None,
        "meta_description_length": len(meta_desc.get("content", "")) if meta_desc else 0,
        "canonical": canonical.get("href") if canonical else None,
        "robots": robots.get("content") if robots else None,
        "h1_tags": h1_tags,
        "h2_tags": h2_tags,
        "word_count": word_count,
        "image_count": len(images),
        "images_without_alt": images_without_alt,
        "internal_link_count": len(internal_links),
        "external_link_count": len(external_links),
        "has_schema_markup": len(schema_scripts) > 0,
        "schema_count": len(schema_scripts),
        "og_tags": og_tags,
    }
