from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from services.domain_onboarding import normalize_domain, onboard_domain, run_onboard_pagespeed, site_url_from_domain

router = APIRouter(prefix="/api/domains", tags=["domains"])


class DomainCreate(BaseModel):
    domain: str = Field(..., min_length=1, max_length=500)
    display_name: str | None = Field(None, max_length=200)
    target_countries: list[str] = Field(default_factory=list)
    max_pages: int = Field(default=200, ge=1, le=500)


class DomainUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=200)
    target_countries: list[str] | None = None


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def _enrich_domain(row: dict) -> dict:
    domain = row.get("domain", "")
    return {
        **row,
        "url": site_url_from_domain(domain),
        "display_name": row.get("display_name") or domain,
        "target_countries": row.get("target_countries") or [],
    }


@router.get("")
async def list_domains() -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = supabase.table("domains").select("*").order("created_at", desc=True).execute()
        domains = [_enrich_domain(d) for d in all_rows(result)]
        return {
            "success": True,
            "data": domains,
            "meta": {"total": len(domains)},
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(status_code=status, detail=_error_detail(message, code)) from exc


@router.post("")
async def create_domain(body: DomainCreate, background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Onboard a domain: crawl sitemap, store pages, then audit PageSpeed in background."""
    normalized = normalize_domain(body.domain)
    try:
        supabase = get_supabase()
        dup = (
            supabase.table("domains")
            .select("id, domain")
            .eq("domain", normalized)
            .maybe_single()
            .execute()
        )
        if first_row(dup):
            raise HTTPException(
                status_code=409,
                detail=_error_detail(f"Domain '{normalized}' already onboarded", "duplicate_domain"),
            )

        result = await onboard_domain(
            normalized,
            max_pages=body.max_pages,
            display_name=body.display_name or normalized,
            target_countries=body.target_countries,
        )
        result["domain"] = _enrich_domain(result["domain"])
        background_tasks.add_task(run_onboard_pagespeed, result["domain_id"])
        result["pagespeed"] = {"status": "queued", "message": "Mobile and desktop audits running in background"}
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=_error_detail(f"Failed to crawl domain: {exc}", "crawl_error"),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(status_code=status, detail=_error_detail(message, code)) from exc


@router.get("/{domain_id}")
async def get_domain(domain_id: str) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("domains")
            .select("*")
            .eq("id", domain_id)
            .maybe_single()
            .execute()
        )
        row = first_row(result)
        if not row:
            raise HTTPException(status_code=404, detail=_error_detail("Domain not found", "not_found"))
        return {"success": True, "data": _enrich_domain(row)}
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.patch("/{domain_id}")
async def update_domain(domain_id: str, body: DomainUpdate) -> dict[str, Any]:
    try:
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail=_error_detail("No fields to update", "validation_error"))

        supabase = get_supabase()
        result = supabase.table("domains").update(updates).eq("id", domain_id).execute()
        row = first_row(result) or (all_rows(result)[0] if all_rows(result) else None)
        if not row:
            check = (
                supabase.table("domains")
                .select("*")
                .eq("id", domain_id)
                .maybe_single()
                .execute()
            )
            row = first_row(check)
        if not row:
            raise HTTPException(status_code=404, detail=_error_detail("Domain not found", "not_found"))
        return {"success": True, "data": _enrich_domain(row)}
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.delete("/{domain_id}")
async def delete_domain(domain_id: str) -> dict[str, Any]:
    """Remove domain and all associated pages (cascade)."""
    try:
        supabase = get_supabase()
        result = supabase.table("domains").delete().eq("id", domain_id).execute()
        if not all_rows(result):
            raise HTTPException(status_code=404, detail=_error_detail("Domain not found", "not_found"))
        return {"success": True, "data": {"id": domain_id, "deleted": True}}
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.post("/{domain_id}/refresh")
async def refresh_domain(
    domain_id: str,
    background_tasks: BackgroundTasks,
    max_pages: int = 200,
) -> dict[str, Any]:
    """Re-crawl sitemap, refresh pages, and re-run PageSpeed audits in background."""
    try:
        supabase = get_supabase()
        domain_row = (
            supabase.table("domains")
            .select("*")
            .eq("id", domain_id)
            .maybe_single()
            .execute()
        )
        row = first_row(domain_row)
        if not row:
            raise HTTPException(status_code=404, detail=_error_detail("Domain not found", "not_found"))

        result = await onboard_domain(row["domain"], max_pages=max_pages)
        result["domain"] = _enrich_domain(result["domain"])
        background_tasks.add_task(run_onboard_pagespeed, result["domain_id"])
        result["pagespeed"] = {"status": "queued", "message": "Mobile and desktop audits running in background"}
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=_error_detail(f"Failed to refresh domain: {exc}", "crawl_error"),
        ) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc
