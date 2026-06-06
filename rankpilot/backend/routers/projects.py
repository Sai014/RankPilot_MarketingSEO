from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import first_row
from middleware.auth import require_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    domain: str = Field(..., min_length=1, max_length=500)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    domain: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def _user_id(user: dict[str, Any]) -> str:
    uid = user.get("id")
    if not uid:
        raise HTTPException(
            status_code=401,
            detail=_error_detail("Invalid user session", "unauthorized"),
        )
    return str(uid)


@router.get("")
async def list_projects(user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("projects")
            .select("*")
            .eq("user_id", _user_id(user))
            .order("created_at", desc=True)
            .execute()
        )
        return {"success": True, "data": result.data or []}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(
            status_code=status,
            detail=_error_detail(f"Failed to list projects: {message}", code),
        ) from exc


@router.post("")
async def create_project(body: ProjectCreate, user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        payload = {
            "name": body.name,
            "domain": body.domain,
            "description": body.description,
            "user_id": _user_id(user),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = supabase.table("projects").insert(payload).execute()
        if not result.data:
            raise HTTPException(
                status_code=500,
                detail=_error_detail("Insert returned no data", "db_error"),
            )
        return {"success": True, "data": result.data[0]}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(
            status_code=status,
            detail=_error_detail(f"Failed to create project: {message}", code),
        ) from exc


@router.get("/{project_id}")
async def get_project(project_id: str, user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("projects")
            .select("*")
            .eq("id", project_id)
            .eq("user_id", _user_id(user))
            .maybe_single()
            .execute()
        )
        row = first_row(result)
        if not row:
            raise HTTPException(
                status_code=404,
                detail=_error_detail("Project not found", "not_found"),
            )
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Failed to get project: {exc}", "db_error"),
        ) from exc


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    try:
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(
                status_code=400,
                detail=_error_detail("No fields to update", "validation_error"),
            )

        supabase = get_supabase()
        result = (
            supabase.table("projects")
            .update(updates)
            .eq("id", project_id)
            .eq("user_id", _user_id(user))
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail=_error_detail("Project not found", "not_found"),
            )
        return {"success": True, "data": result.data[0]}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Failed to update project: {exc}", "db_error"),
        ) from exc


@router.delete("/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("projects")
            .delete()
            .eq("id", project_id)
            .eq("user_id", _user_id(user))
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail=_error_detail("Project not found", "not_found"),
            )
        return {"success": True, "data": {"id": project_id, "deleted": True}}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Failed to delete project: {exc}", "db_error"),
        ) from exc
