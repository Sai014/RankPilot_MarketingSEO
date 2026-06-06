import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db.domain_auth import get_owned_domain, get_owned_page, user_id_from
from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from middleware.auth import require_user
from routers.dashboard import _serp_rank_for_url
from services.page_utils import keyword_from_path, resolve_page_countries

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pages", tags=["pages"])


class PageUpdate(BaseModel):
    target_countries: list[str] = Field(default_factory=list)


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def _enrich_page(page: dict[str, Any], domain: dict[str, Any]) -> dict[str, Any]:
    return {
        **page,
        "keyword": keyword_from_path(page.get("path")),
        "domain": domain.get("domain"),
        "country": resolve_page_countries(page, domain),
    }


def _sync_domain_page_count(supabase, domain_id: str) -> None:
    count_result = (
        supabase.table("pages")
        .select("id", count="exact")
        .eq("domain_id", domain_id)
        .execute()
    )
    total = count_result.count if count_result and count_result.count is not None else 0
    supabase.table("domains").update({"page_count": total}).eq("id", domain_id).execute()


@router.get("")
async def list_pages(
    domain_id: str = Query(..., description="Domain UUID"),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    """List all sitemap pages for a domain with slug-derived keywords."""
    try:
        supabase = get_supabase()
        domain_row = get_owned_domain(supabase, domain_id, user_id_from(user))

        result = (
            supabase.table("pages")
            .select("*", count="exact")
            .eq("domain_id", domain_id)
            .order("path")
            .range(offset, offset + limit - 1)
            .execute()
        )

        pages = [_enrich_page(p, domain_row) for p in all_rows(result)]
        logger.info("Listed pages domain_id=%s count=%d", domain_id, len(pages))

        return {
            "success": True,
            "data": pages,
            "meta": {
                "domain": domain_row,
                "total": result.count if result and result.count is not None else len(pages),
                "limit": limit,
                "offset": offset,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        logger.exception("Failed to list pages domain_id=%s", domain_id)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


def _latest_pagespeed_by_strategy(audits: list[dict]) -> dict[str, dict]:
    """Latest audit metrics per strategy, including full Lighthouse scores."""
    by_strategy: dict[str, dict] = {}
    for audit in audits:
        strategy = audit.get("strategy") or "mobile"
        existing = by_strategy.get(strategy)
        if not existing or audit.get("created_at", "") > existing.get("audited_at", ""):
            metrics = (audit.get("result") or {}).get("metrics") or {}
            by_strategy[strategy] = {
                **metrics,
                "audited_at": audit.get("created_at"),
            }
    return by_strategy


@router.get("/{page_id}/dashboard")
async def page_dashboard(page_id: str, user: dict = Depends(require_user)) -> dict[str, Any]:
    """Per-page dashboard: PageSpeed, SERP, and search metrics."""
    try:
        supabase = get_supabase()
        page_row, domain_row = get_owned_page(supabase, page_id, user_id_from(user))

        ps_result = (
            supabase.table("pagespeed_audits")
            .select("*")
            .eq("page_id", page_id)
            .order("created_at", desc=True)
            .execute()
        )
        pagespeed_rows = all_rows(ps_result)
        if not pagespeed_rows:
            ps_result = (
                supabase.table("pagespeed_audits")
                .select("*")
                .eq("url", page_row["url"])
                .order("created_at", desc=True)
                .execute()
            )
            pagespeed_rows = all_rows(ps_result)

        ps_map = _latest_pagespeed_by_strategy(pagespeed_rows)
        mobile = ps_map.get("mobile")
        desktop = ps_map.get("desktop")

        serp_result = (
            supabase.table("serp_tracks")
            .select("*")
            .eq("domain_id", page_row["domain_id"])
            .order("created_at", desc=True)
            .execute()
        )
        serp = _serp_rank_for_url(all_rows(serp_result), page_row["url"])

        metrics_result = (
            supabase.table("page_metrics")
            .select("*")
            .eq("page_id", page_id)
            .maybe_single()
            .execute()
        )
        gsc_row = first_row(metrics_result)

        enriched = _enrich_page(page_row, domain_row)
        logger.info("Page dashboard page_id=%s path=%s", page_id, page_row.get("path"))

        return {
            "success": True,
            "data": {
                "page": enriched,
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
                    "clicks": gsc_row.get("clicks") if gsc_row else None,
                    "impressions": gsc_row.get("impressions") if gsc_row else None,
                    "ctr": float(gsc_row["ctr"]) if gsc_row and gsc_row.get("ctr") is not None else None,
                    "avg_position": float(gsc_row["avg_position"])
                    if gsc_row and gsc_row.get("avg_position") is not None
                    else None,
                    "leads": gsc_row.get("leads") if gsc_row else None,
                }
                if gsc_row
                else None,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        logger.exception("Failed to load page dashboard page_id=%s", page_id)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.patch("/{page_id}")
async def update_page(
    page_id: str,
    body: PageUpdate,
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    """Update page settings (e.g. target countries override)."""
    try:
        supabase = get_supabase()
        page_row, domain_row = get_owned_page(supabase, page_id, user_id_from(user))

        countries = [c.strip() for c in body.target_countries if c and c.strip()]
        update_payload = {"target_countries": countries or None}

        supabase.table("pages").update(update_payload).eq("id", page_id).execute()

        updated = {**page_row, **update_payload}
        enriched = _enrich_page(updated, domain_row)

        logger.info("Updated page page_id=%s countries=%s", page_id, countries or "inherit")
        return {"success": True, "data": enriched}
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        logger.exception("Failed to update page page_id=%s", page_id)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.delete("/{page_id}")
async def delete_page(page_id: str, user: dict = Depends(require_user)) -> dict[str, Any]:
    """Remove a page from tracking."""
    try:
        supabase = get_supabase()
        page_row, _ = get_owned_page(supabase, page_id, user_id_from(user))

        domain_id = page_row["domain_id"]
        supabase.table("pages").delete().eq("id", page_id).execute()
        _sync_domain_page_count(supabase, domain_id)

        logger.info("Deleted page page_id=%s path=%s", page_id, page_row.get("path"))
        return {"success": True, "data": {"id": page_id, "deleted": True}}
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        logger.exception("Failed to delete page page_id=%s", page_id)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc
