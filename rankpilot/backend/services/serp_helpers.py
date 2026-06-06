from typing import Any


def find_domain_rank(organic: list[dict], target_domain: str) -> int | None:
    target = target_domain.lower().replace("www.", "")
    for item in organic:
        link = (item.get("link") or "").lower()
        domain = (item.get("domain") or "").lower().replace("www.", "")
        if target in link or target in domain:
            return item.get("position")
    return None


def build_serp_summary(
    result: dict[str, Any],
    *,
    target_domain: str | None = None,
    target_rank: int | None = None,
) -> dict[str, Any]:
    organic = result.get("organic_results") or []
    checked = len(organic)
    top_3_domains = [r.get("domain") for r in organic[:3] if r.get("domain")]
    your_result = next(
        (
            r
            for r in organic
            if target_domain
            and (
                target_domain.lower().replace("www.", "") in (r.get("link") or "").lower()
                or target_domain.lower().replace("www.", "") in (r.get("domain") or "").lower().replace("www.", "")
            )
        ),
        None,
    )

    return {
        "keyword": result.get("keyword"),
        "location": result.get("location"),
        "target_domain": target_domain,
        "your_rank": target_rank,
        "in_top_results": target_rank is not None,
        "results_checked": checked,
        "total_results": result.get("total_results"),
        "top_competitors": top_3_domains,
        "your_listing": {
            "title": your_result.get("title") if your_result else None,
            "url": your_result.get("link") if your_result else None,
            "snippet": your_result.get("snippet") if your_result else None,
        }
        if your_result
        else None,
        "related_searches_count": len(result.get("related_searches") or []),
    }


def build_optimization_prompt(
    *,
    keyword: str,
    location: str,
    result: dict[str, Any],
    target_domain: str | None,
    target_rank: int | None,
) -> str:
    organic = result.get("organic_results") or []
    top_results = "\n".join(
        f"{r.get('position')}. {r.get('title')} — {r.get('link')}\n   Snippet: {r.get('snippet', '')}"
        for r in organic[:10]
    )
    rank_line = (
        f"Current rank for {target_domain}: #{target_rank}"
        if target_rank
        else f"{target_domain} is NOT in the top {len(organic)} results"
        if target_domain
        else "No target domain specified"
    )
    related = result.get("related_searches") or []
    related_line = ", ".join(
        r.get("query") if isinstance(r, dict) else str(r) for r in related[:8]
    )

    return (
        f"Keyword: '{keyword}'\n"
        f"Location: {location}\n"
        f"{rank_line}\n\n"
        f"Top SERP results:\n{top_results}\n\n"
        f"Related searches: {related_line or 'none'}\n\n"
        "Provide:\n"
        "1. A brief SERP summary (2-3 sentences): who dominates, content format winning, search intent.\n"
        "2. Specific optimization tips for the target site to rank higher for this keyword "
        "(on-page SEO, content gaps, title/meta, internal links, featured snippet opportunities).\n"
        "3. Top 3 prioritized action items with expected impact (high/medium/low).\n"
        "Be concise and actionable."
    )
