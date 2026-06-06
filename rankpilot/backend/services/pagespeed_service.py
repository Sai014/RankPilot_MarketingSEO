from typing import Any

import httpx

PAGESPEED_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


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


async def run_pagespeed_audit(url: str, strategy: str = "mobile") -> dict[str, Any]:
    """Run Google PageSpeed Insights audit (no API key required)."""
    if strategy not in ("mobile", "desktop"):
        strategy = "mobile"

    params = {
        "url": url,
        "strategy": strategy,
        "category": ["performance", "accessibility", "best-practices", "seo"],
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(PAGESPEED_API, params=params)
        response.raise_for_status()
        data = response.json()

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
