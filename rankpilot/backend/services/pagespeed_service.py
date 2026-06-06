import asyncio
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

PAGESPEED_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
MAX_RETRIES = 3
RETRY_DELAYS_SEC = (2, 5, 10)

_api_key_warned = False


def _get_api_key() -> str | None:
    return os.getenv("GOOGLE_PAGESPEED_API_KEY") or os.getenv("PAGESPEED_API_KEY")


def _extract_metrics(lighthouse: dict[str, Any]) -> dict[str, Any]:
    audits = lighthouse.get("audits", {})
    categories = lighthouse.get("categories", {})

    def audit_value(audit_id: str) -> Any:
        audit = audits.get(audit_id, {})
        return audit.get("displayValue") or audit.get("numericValue")

    return {
        "performance_score": categories.get("performance", {}).get("score"),
        "accessibility_score": categories.get("accessibility", {}).get("score"),
        "best_practices_score": categories.get("best-practices", {}).get("score"),
        "seo_score": categories.get("seo", {}).get("score"),
        "first_contentful_paint": audit_value("first-contentful-paint"),
        "largest_contentful_paint": audit_value("largest-contentful-paint"),
        "total_blocking_time": audit_value("total-blocking-time"),
        "cumulative_layout_shift": audit_value("cumulative-layout-shift"),
        "speed_index": audit_value("speed-index"),
        "interactive": audit_value("interactive"),
    }


def _build_params(url: str, strategy: str) -> dict[str, Any]:
    global _api_key_warned

    params: dict[str, Any] = {
        "url": url,
        "strategy": strategy,
        "category": ["performance", "accessibility", "best-practices", "seo"],
    }

    api_key = _get_api_key()
    if api_key:
        params["key"] = api_key
    elif not _api_key_warned:
        _api_key_warned = True
        logger.warning(
            "GOOGLE_PAGESPEED_API_KEY is not set — PageSpeed requests use a shared "
            "IP quota and often return 429. Add a key in Google Cloud Console."
        )

    return params


async def _fetch_pagespeed(params: dict[str, Any]) -> dict[str, Any]:
    last_exc: httpx.HTTPStatusError | None = None

    async with httpx.AsyncClient(timeout=120.0) as client:
        for attempt in range(MAX_RETRIES + 1):
            response = await client.get(PAGESPEED_API, params=params)

            if response.status_code != 429:
                response.raise_for_status()
                return response.json()

            last_exc = httpx.HTTPStatusError(
                "429 Too Many Requests",
                request=response.request,
                response=response,
            )
            if attempt >= MAX_RETRIES:
                break

            delay = RETRY_DELAYS_SEC[min(attempt, len(RETRY_DELAYS_SEC) - 1)]
            logger.warning(
                "PageSpeed rate limited (429), retry %d/%d in %ss",
                attempt + 1,
                MAX_RETRIES,
                delay,
            )
            await asyncio.sleep(delay)

    assert last_exc is not None
    raise last_exc


async def run_pagespeed_audit(url: str, strategy: str = "mobile") -> dict[str, Any]:
    """Run Google PageSpeed Insights audit."""
    if strategy not in ("mobile", "desktop"):
        strategy = "mobile"

    params = _build_params(url, strategy)
    data = await _fetch_pagespeed(params)

    lighthouse = data.get("lighthouseResult", {})
    loading = data.get("loadingExperience", {})

    return {
        "url": url,
        "strategy": strategy,
        "fetch_time": lighthouse.get("fetchTime"),
        "metrics": _extract_metrics(lighthouse),
        "loading_experience": {
            "overall_category": loading.get("overall_category"),
            "metrics": loading.get("metrics", {}),
        },
        "final_url": lighthouse.get("finalUrl"),
    }
