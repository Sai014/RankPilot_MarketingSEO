import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from services.page_utils import keyword_from_path, resolve_page_countries

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def _pagespeed_by_url(audits: list[dict]) -> dict[str, dict]:
    """Latest mobile + desktop PageSpeed scores per URL."""
    by_url: dict[str, dict] = {}
    for audit in audits:
        url = audit.get("url")
        if not url:
            continue
        strategy = audit.get("strategy") or "mobile"
        result = audit.get("result") or {}
        metrics = result.get("metrics") or {}
        bucket = by_url.setdefault(url, {})
        existing = bucket.get(strategy)
        if not existing or audit.get("created_at", "") > existing.get("audited_at", ""):
            bucket[strategy] = {
                "performance_score": metrics.get("performance_score"),
                "seo_score": metrics.get("seo_score"),
                "lcp": metrics.get("largest_contentful_paint"),
                "audited_at": audit.get("created_at"),
            }
    return by_url


def _serp_rank_for_url(tracks: list[dict], page_url: str) -> dict[str, Any] | None:
    page_url_lower = page_url.lower().rstrip("/")
    best = None
    for track in tracks:
        result = track.get("result") or {}
        for item in result.get("organic_results") or []:
            link = (item.get("link") or "").lower().rstrip("/")
            if link == page_url_lower or page_url_lower in link:
                rank = item.get("position")
                if best is None or (rank and rank < best.get("rank", 999)):
                    best = {
                        "keyword": track.get("keyword"),
                        "rank": rank,
                        "location": track.get("location"),
                        "tracked_at": track.get("created_at"),
                    }
    return best


def _rank_distribution(rows: list[dict]) -> list[dict[str, Any]]:
    buckets = {"Top 3": 0, "4–10": 0, "11–20": 0, "21+": 0, "Not ranked": 0}
    for row in rows:
        rank = (row.get("serp") or {}).get("rank")
        if not rank:
            buckets["Not ranked"] += 1
        elif rank <= 3:
            buckets["Top 3"] += 1
        elif rank <= 10:
            buckets["4–10"] += 1
        elif rank <= 20:
            buckets["11–20"] += 1
        else:
            buckets["21+"] += 1

    colors = {
        "Top 3": "#34d399",
        "4–10": "#818cf8",
        "11–20": "#fbbf24",
        "21+": "#f87171",
        "Not ranked": "#475569",
    }
    return [{"label": k, "count": v, "color": colors[k]} for k, v in buckets.items()]


def _top_ranked(rows: list[dict], limit: int = 6) -> list[dict[str, Any]]:
    ranked = [r for r in rows if (r.get("serp") or {}).get("rank")]
    ranked.sort(key=lambda r: r["serp"]["rank"])
    return [
        {
            "keyword": r.get("keyword"),
            "path": r.get("path"),
            "rank": r["serp"]["rank"],
        }
        for r in ranked[:limit]
    ]


@router.get("/{domain_id}")
async def domain_dashboard(domain_id: str) -> dict[str, Any]:
    """Per-page dashboard: KPIs, charts, keyword rankings."""
    try:
        supabase = get_supabase()

        domain = (
            supabase.table("domains")
            .select("*")
            .eq("id", domain_id)
            .maybe_single()
            .execute()
        )
        domain_row = first_row(domain)
        if not domain_row:
            raise HTTPException(status_code=404, detail=_error_detail("Domain not found", "not_found"))

        pages = all_rows(
            supabase.table("pages")
            .select("*")
            .eq("domain_id", domain_id)
            .order("path")
            .execute()
        )

        ps_result = (
            supabase.table("pagespeed_audits")
            .select("*")
            .eq("domain_id", domain_id)
            .order("created_at", desc=True)
            .execute()
        )
        pagespeed_map = _pagespeed_by_url(all_rows(ps_result))

        serp_result = (
            supabase.table("serp_tracks")
            .select("*")
            .eq("domain_id", domain_id)
            .order("created_at", desc=True)
            .execute()
        )
        serp_tracks = all_rows(serp_result)

        metrics_result = (
            supabase.table("page_metrics")
            .select("*")
            .in_("page_id", [p["id"] for p in pages] or ["00000000-0000-0000-0000-000000000000"])
            .execute()
        )
        metrics_by_page = {m["page_id"]: m for m in all_rows(metrics_result)}

        rows = []
        for page in pages:
            url = page["url"]
            ps = pagespeed_map.get(url, {})
            mobile = ps.get("mobile")
            desktop = ps.get("desktop")
            serp = _serp_rank_for_url(serp_tracks, url)
            gsc = metrics_by_page.get(page["id"])

            rows.append(
                {
                    "page_id": page["id"],
                    "url": url,
                    "path": page.get("path"),
                    "title": page.get("title"),
                    "keyword": keyword_from_path(page.get("path")),
                    "country": resolve_page_countries(page, domain_row),
                    "pagespeed": {
                        "mobile": mobile,
                        "desktop": desktop,
                        "performance_score": (mobile or desktop or {}).get("performance_score"),
                        "seo_score": (mobile or desktop or {}).get("seo_score"),
                        "lcp": (mobile or {}).get("lcp") or (desktop or {}).get("lcp"),
                        "audited_at": (mobile or desktop or {}).get("audited_at"),
                    }
                    if mobile or desktop
                    else None,
                    "serp": serp,
                    "gsc": {
                        "clicks": gsc.get("clicks") if gsc else None,
                        "impressions": gsc.get("impressions") if gsc else None,
                        "ctr": float(gsc["ctr"]) if gsc and gsc.get("ctr") is not None else None,
                        "avg_position": float(gsc["avg_position"])
                        if gsc and gsc.get("avg_position") is not None
                        else None,
                        "leads": gsc.get("leads") if gsc else None,
                    }
                    if gsc
                    else None,
                    "scraper": gsc.get("scrape_data") if gsc else None,
                }
            )

        ranks = [r["serp"]["rank"] for r in rows if r.get("serp") and r["serp"].get("rank")]
        total_clicks = sum((r.get("gsc") or {}).get("clicks") or 0 for r in rows)
        total_impressions = sum((r.get("gsc") or {}).get("impressions") or 0 for r in rows)
        total_leads = sum((r.get("gsc") or {}).get("leads") or 0 for r in rows)

        summary = {
            "total_pages": len(rows),
            "pages_with_pagespeed": sum(1 for r in rows if r["pagespeed"]),
            "pages_with_serp": sum(1 for r in rows if r["serp"]),
            "pages_with_gsc": sum(1 for r in rows if r["gsc"]),
            "avg_position": round(sum(ranks) / len(ranks), 2) if ranks else None,
            "ranked_pages": len(ranks),
            "top_10_pages": sum(1 for r in ranks if r <= 10),
            "total_clicks": total_clicks,
            "total_impressions": total_impressions,
            "total_leads": total_leads,
        }

        charts = {
            "rank_distribution": _rank_distribution(rows),
            "top_ranked": _top_ranked(rows),
            "coverage": [
                {"label": "SERP data", "value": summary["pages_with_serp"], "total": summary["total_pages"]},
                {"label": "PageSpeed", "value": summary["pages_with_pagespeed"], "total": summary["total_pages"]},
                {"label": "GSC data", "value": summary["pages_with_gsc"], "total": summary["total_pages"]},
            ],
        }

        logger.info(
            "Dashboard domain_id=%s pages=%d ranked=%d avg_pos=%s",
            domain_id,
            summary["total_pages"],
            summary["ranked_pages"],
            summary["avg_position"],
        )

        return {
            "success": True,
            "data": {
                "domain": domain_row,
                "pages": rows,
                "summary": summary,
                "charts": charts,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc
