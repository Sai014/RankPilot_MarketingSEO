import logging
from typing import Any

from services.audit_scoring import score_onpage
from services.competitor_scraper import scrape_competitor

logger = logging.getLogger(__name__)


async def run_onpage_audit(url: str) -> dict[str, Any]:
    """Fetch page HTML and score on-page SEO signals."""
    data = await scrape_competitor(url)
    score = score_onpage(data)
    issues: list[str] = []

    if not data.get("title"):
        issues.append("Missing title tag")
    elif (data.get("title_length") or 0) < 30:
        issues.append("Title too short (< 30 chars)")
    elif (data.get("title_length") or 0) > 60:
        issues.append("Title too long (> 60 chars)")

    if not data.get("meta_description"):
        issues.append("Missing meta description")
    elif (data.get("meta_description_length") or 0) < 120:
        issues.append("Meta description too short")

    h1_count = len(data.get("h1_tags") or [])
    if h1_count == 0:
        issues.append("Missing H1")
    elif h1_count > 1:
        issues.append(f"Multiple H1 tags ({h1_count})")

    if (data.get("images_without_alt") or 0) > 0:
        issues.append(f"{data['images_without_alt']} images missing alt text")

    if (data.get("word_count") or 0) < 300:
        issues.append("Thin content (< 300 words)")

    if not data.get("canonical"):
        issues.append("Missing canonical URL")

    logger.info("On-page audit url=%s score=%d issues=%d", url, score, len(issues))

    return {
        "url": data.get("url") or url,
        "score": score,
        "signals": data,
        "issues": issues,
    }
