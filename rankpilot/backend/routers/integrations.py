"""Google Search Console integration via Composio."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from db.domain_auth import user_id_from
from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import first_row
from middleware.auth import require_user
from services.composio_service import (
    create_google_connect_link,
    disconnect_gsc_connection,
    get_active_gsc_connection,
    list_gsc_sites,
)
from services.background_jobs import run_gsc_sync_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations/google", tags=["integrations"])


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def _upsert_connection(user_id: str, connected_account_id: str, email: str | None) -> dict[str, Any]:
    supabase = get_supabase()
    payload = {
        "user_id": user_id,
        "composio_connected_account_id": connected_account_id,
        "connected_email": email,
        "status": "active",
    }
    result = supabase.table("google_connections").upsert(payload, on_conflict="user_id").execute()
    row = first_row(result)
    return row or payload


@router.get("/status")
async def google_status(user: dict = Depends(require_user)) -> dict[str, Any]:
    """Check whether the user has connected Google Search Console via Composio."""
    uid = user_id_from(user)
    try:
        connection = get_active_gsc_connection(uid)
        if not connection:
            return {"success": True, "data": {"connected": False}}

        row = (
            get_supabase()
            .table("google_connections")
            .select("*")
            .eq("user_id", uid)
            .maybe_single()
            .execute()
        )
        stored = first_row(row)
        if stored and stored.get("composio_connected_account_id") != connection["connected_account_id"]:
            _upsert_connection(uid, connection["connected_account_id"], connection.get("email"))

        return {
            "success": True,
            "data": {
                "connected": True,
                "email": connection.get("email") or (stored or {}).get("connected_email"),
                "connected_account_id": connection["connected_account_id"],
            },
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(status_code=status, detail=_error_detail(message, code)) from exc


@router.post("/connect")
async def google_connect(user: dict = Depends(require_user)) -> dict[str, Any]:
    """Start Composio OAuth — returns redirect URL for Google Search Console."""
    uid = user_id_from(user)
    try:
        link = create_google_connect_link(uid)
        return {"success": True, "data": link}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=_error_detail(str(exc))) from exc


@router.post("/complete")
async def google_complete(user: dict = Depends(require_user)) -> dict[str, Any]:
    """After OAuth redirect, persist the Composio connected account for this user."""
    uid = user_id_from(user)
    try:
        connection = get_active_gsc_connection(uid)
        if not connection:
            raise HTTPException(
                status_code=400,
                detail=_error_detail("Google account not connected yet", "not_connected"),
            )
        row = _upsert_connection(uid, connection["connected_account_id"], connection.get("email"))
        return {
            "success": True,
            "data": {
                "connected": True,
                "email": row.get("connected_email") or connection.get("email"),
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


@router.delete("/disconnect")
async def google_disconnect(user: dict = Depends(require_user)) -> dict[str, Any]:
    """Revoke Composio GSC connection and remove local storage for this user."""
    uid = user_id_from(user)
    try:
        result = disconnect_gsc_connection(uid)
        return {"success": True, "data": result}
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=_error_detail(str(exc), "disconnect_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.get("/gsc/properties")
async def list_gsc_properties(user: dict = Depends(require_user)) -> dict[str, Any]:
    """List verified Search Console properties for the connected Google account."""
    uid = user_id_from(user)
    try:
        connection = get_active_gsc_connection(uid)
        if not connection:
            raise HTTPException(
                status_code=400,
                detail=_error_detail("Connect Google Search Console first", "not_connected"),
            )
        sites = list_gsc_sites(uid, connection["connected_account_id"])
        return {"success": True, "data": {"sites": sites}}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=_error_detail(str(exc), "gsc_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc


@router.post("/gsc/sync/{domain_id}")
async def sync_gsc(
    domain_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    """Sync GSC performance metrics for a GSC-linked domain."""
    uid = user_id_from(user)
    try:
        from db.domain_auth import get_owned_domain

        domain = get_owned_domain(get_supabase(), domain_id, uid)
        if not domain.get("gsc_site_url"):
            raise HTTPException(
                status_code=400,
                detail=_error_detail("Domain is not linked to Google Search Console", "not_gsc_linked"),
            )
        background_tasks.add_task(run_gsc_sync_job, domain_id, uid)
        return {
            "success": True,
            "data": {"domain_id": domain_id, "status": "queued", "message": "GSC sync started"},
        }
    except HTTPException:
        raise
    except Exception as exc:
        message, code = format_db_error(exc)
        raise HTTPException(status_code=500, detail=_error_detail(message, code)) from exc
