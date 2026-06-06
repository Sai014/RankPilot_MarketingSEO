import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
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
) -> dict[str, Any]:
    """List all sitemap pages for a domain with slug-derived keywords."""
    try:
        supabase = get_supabase()

        domain = (
            supabase.table("domains")
            .select("id, domain, display_name, target_countries")
            .eq("id", domain_id)
            .maybe_single()
            .execute()
        )
        domain_row = first_row(domain)
        if not domain_row:
            raise HTTPException(status_code=404, detail=_error_detail("Domain not found", "not_found"))

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


@router.patch("/{page_id}")
async def update_page(page_id: str, body: PageUpdate) -> dict[str, Any]:
    """Update page settings (e.g. target countries override)."""
    try:
        supabase = get_supabase()

        existing = (
            supabase.table("pages")
            .select("*")
            .eq("id", page_id)
            .maybe_single()
            .execute()
        )
        page_row = first_row(existing)
        if not page_row:
            raise HTTPException(status_code=404, detail=_error_detail("Page not found", "not_found"))

        countries = [c.strip() for c in body.target_countries if c and c.strip()]
        update_payload = {"target_countries": countries or None}

        supabase.table("pages").update(update_payload).eq("id", page_id).execute()

        domain = (
            supabase.table("domains")
            .select("id, domain, display_name, target_countries")
            .eq("id", page_row["domain_id"])
            .maybe_single()
            .execute()
        )
        domain_row = first_row(domain) or {}
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
async def delete_page(page_id: str) -> dict[str, Any]:
    """Remove a page from tracking."""
    try:
        supabase = get_supabase()

        existing = (
            supabase.table("pages")
            .select("id, domain_id, path, url")
            .eq("id", page_id)
            .maybe_single()
            .execute()
        )
        page_row = first_row(existing)
        if not page_row:
            raise HTTPException(status_code=404, detail=_error_detail("Page not found", "not_found"))

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
