from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from db.domain_auth import get_owned_domain, user_id_from
from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from middleware.auth import require_user
from services.domain_onboarding import (
    create_pending_domain,
    normalize_domain,
    run_full_onboarding_pipeline,
    site_url_from_domain,
)
from services.gsc_sync import gsc_site_to_domain

router = APIRouter(prefix="/api/domains", tags=["domains"])


class DomainCreate(BaseModel):
    domain: str = Field(..., min_length=1, max_length=500)
    display_name: str | None = Field(None, max_length=200)
    target_countries: list[str] = Field(default_factory=list)
    max_pages: int = Field(default=200, ge=1, le=500)
    auto_serp: bool = Field(
        default=False,
        description="If true, run ValueSERP checks for every page after crawl (uses API credits)",
    )
    gsc_site_url: str | None = Field(
        None,
        max_length=500,
        description="Exact GSC property URL when importing from Google Search Console",
    )


class DomainRefresh(BaseModel):
    max_pages: int = Field(default=200, ge=1, le=500)
    auto_serp: bool = Field(
        default=False,
        description="If true, re-run ValueSERP checks for every page (uses API credits)",
    )


class DomainUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=200)
    target_countries: list[str] | None = None


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def _heal_stuck_syncing(supabase, row: dict) -> dict:
    """Crawl finished but PageSpeed/SERP never cleared status (e.g. server restart)."""
    if row.get("status") == "syncing" and (row.get("page_count") or 0) > 0:
        supabase.table("domains").update({"status": "active"}).eq("id", row["id"]).execute()
        return {**row, "status": "active"}
    return row


def _enrich_domain(row: dict) -> dict:
    domain = row.get("domain", "")
    gsc_site_url = row.get("gsc_site_url")
    return {
        **row,
        "url": site_url_from_domain(domain),
        "display_name": row.get("display_name") or domain,
        "target_countries": row.get("target_countries") or [],
        "source": row.get("source") or "manual",
        "gsc_linked": bool(gsc_site_url),
        "gsc_site_url": gsc_site_url,
        "gsc_last_synced_at": row.get("gsc_last_synced_at"),
    }


def _onboarding_message(auto_serp: bool) -> str:
    if auto_serp:
        return "Sitemap crawl, SERP checks, and PageSpeed audits running in background"
    return "Sitemap crawl and PageSpeed audits running in background"


def _queue_onboarding(
    background_tasks: BackgroundTasks,
    *,
    domain_id: str,
    domain: str,
    max_pages: int,
    user_id: str,
    auto_serp: bool,
    display_name: str | None = None,
    target_countries: list[str] | None = None,
    sync_gsc: bool = False,
) -> dict[str, Any]:
    background_tasks.add_task(
        run_full_onboarding_pipeline,
        domain_id,
        domain,
        max_pages,
        user_id,
        auto_serp,
        display_name,
        target_countries,
        sync_gsc,
    )
    return {
        "status": "queued",
        "auto_serp": auto_serp,
        "message": _onboarding_message(auto_serp),
    }


@router.get("")
async def list_domains(user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        uid = user_id_from(user)
        result = (
            supabase.table("domains")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", desc=True)
            .execute()
        )
        domains = [_enrich_domain(_heal_stuck_syncing(supabase, d)) for d in all_rows(result)]
        return {
            "success": True,
            "data": domains,
            "meta": {"total": len(domains)},
        }
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(status_code=status, detail=_error_detail(message, code)) from exc


@router.post("")
async def create_domain(
    body: DomainCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    """Create domain immediately, then crawl sitemap and run audits in the background."""
    normalized = normalize_domain(body.domain)
    if body.gsc_site_url:
        normalized = gsc_site_to_domain(body.gsc_site_url)
    uid = user_id_from(user)
    display_name = body.display_name or normalized
    try:
        supabase = get_supabase()
        dup = (
            supabase.table("domains")
            .select("id, domain")
            .eq("domain", normalized)
            .eq("user_id", uid)
            .maybe_single()
            .execute()
        )
        if first_row(dup):
            raise HTTPException(
                status_code=409,
                detail=_error_detail(f"Domain '{normalized}' already onboarded", "duplicate_domain"),
            )

        domain_row = create_pending_domain(
            normalized,
            display_name=display_name,
            target_countries=body.target_countries,
            user_id=uid,
            gsc_site_url=body.gsc_site_url,
        )
        domain_id = domain_row["id"]

        onboarding = _queue_onboarding(
            background_tasks,
            domain_id=domain_id,
            domain=normalized,
            max_pages=body.max_pages,
            user_id=uid,
            auto_serp=body.auto_serp,
            display_name=display_name,
            target_countries=body.target_countries,
            sync_gsc=bool(body.gsc_site_url),
        )

        return {
            "success": True,
            "data": {
                "domain": _enrich_domain(domain_row),
                "domain_id": domain_id,
                "onboarding": onboarding,
            },
        }
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(status_code=status, detail=_error_detail(message, code)) from exc


@router.get("/{domain_id}")
async def get_domain(domain_id: str, user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        row = get_owned_domain(supabase, domain_id, user_id_from(user))
        row = _heal_stuck_syncing(supabase, row)
        return {"success": True, "data": _enrich_domain(row)}
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.patch("/{domain_id}")
async def update_domain(
    domain_id: str,
    body: DomainUpdate,
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    try:
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail=_error_detail("No fields to update", "validation_error"))

        supabase = get_supabase()
        uid = user_id_from(user)
        get_owned_domain(supabase, domain_id, uid)

        result = (
            supabase.table("domains")
            .update(updates)
            .eq("id", domain_id)
            .eq("user_id", uid)
            .execute()
        )
        row = first_row(result) or (all_rows(result)[0] if all_rows(result) else None)
        if not row:
            row = get_owned_domain(supabase, domain_id, uid)
        return {"success": True, "data": _enrich_domain(row)}
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.delete("/{domain_id}")
async def delete_domain(domain_id: str, user: dict = Depends(require_user)) -> dict[str, Any]:
    """Remove domain and all associated pages (cascade)."""
    try:
        supabase = get_supabase()
        uid = user_id_from(user)
        get_owned_domain(supabase, domain_id, uid)

        result = (
            supabase.table("domains")
            .delete()
            .eq("id", domain_id)
            .eq("user_id", uid)
            .execute()
        )
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
    body: DomainRefresh,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    """Re-crawl sitemap, refresh pages, and run audits in the background."""
    try:
        supabase = get_supabase()
        uid = user_id_from(user)
        row = get_owned_domain(supabase, domain_id, uid)

        supabase.table("domains").update(
            {
                "status": "syncing",
                "page_count": 0,
                "sitemap_count": 0,
            }
        ).eq("id", domain_id).execute()

        refreshed = (
            supabase.table("domains")
            .select("*")
            .eq("id", domain_id)
            .maybe_single()
            .execute()
        )
        domain_row = first_row(refreshed) or row

        onboarding = _queue_onboarding(
            background_tasks,
            domain_id=domain_id,
            domain=row["domain"],
            max_pages=body.max_pages,
            user_id=uid,
            auto_serp=body.auto_serp,
            display_name=row.get("display_name"),
            target_countries=row.get("target_countries") or [],
            sync_gsc=bool(row.get("gsc_site_url")),
        )

        return {
            "success": True,
            "data": {
                "domain": _enrich_domain(domain_row),
                "domain_id": domain_id,
                "onboarding": onboarding,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc
