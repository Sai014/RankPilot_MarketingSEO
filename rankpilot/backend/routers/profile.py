import mimetypes
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from db.errors import format_db_error
from db.supabase_client import get_supabase
from db.supabase_helpers import first_row
from middleware.auth import require_user

router = APIRouter(prefix="/api/profile", tags=["profile"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024


class ProfileUpdate(BaseModel):
    company_name: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)


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


def _profile_response(profile: dict[str, Any], email: str | None) -> dict[str, Any]:
    return {
        "id": profile.get("id"),
        "email": email,
        "company_name": profile.get("company_name"),
        "phone": profile.get("phone"),
        "address": profile.get("address"),
        "avatar_url": profile.get("avatar_url"),
        "created_at": profile.get("created_at"),
        "updated_at": profile.get("updated_at"),
    }


def _get_or_create_profile(supabase: Any, uid: str) -> dict[str, Any]:
    result = supabase.table("profiles").select("*").eq("id", uid).maybe_single().execute()
    profile = first_row(result)
    if profile:
        return profile

    now = datetime.now(timezone.utc).isoformat()
    insert = supabase.table("profiles").insert({"id": uid, "created_at": now, "updated_at": now}).execute()
    created = first_row(insert)
    if created:
        return created
    raise HTTPException(status_code=500, detail=_error_detail("Failed to create profile", "db_error"))


@router.get("")
async def get_profile(user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        uid = _user_id(user)
        profile = _get_or_create_profile(supabase, uid)
        return {"success": True, "data": _profile_response(profile, user.get("email"))}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(
            status_code=status,
            detail=_error_detail(f"Failed to load profile: {message}", code),
        ) from exc


@router.patch("")
async def update_profile(body: ProfileUpdate, user: dict = Depends(require_user)) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        uid = _user_id(user)
        _get_or_create_profile(supabase, uid)

        updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if body.company_name is not None:
            updates["company_name"] = body.company_name.strip() or None
        if body.phone is not None:
            updates["phone"] = body.phone.strip() or None
        if body.address is not None:
            updates["address"] = body.address.strip() or None

        result = supabase.table("profiles").update(updates).eq("id", uid).execute()
        profile = first_row(result)
        if not profile:
            raise HTTPException(status_code=500, detail=_error_detail("Failed to update profile", "db_error"))

        return {"success": True, "data": _profile_response(profile, user.get("email"))}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(
            status_code=status,
            detail=_error_detail(f"Failed to update profile: {message}", code),
        ) from exc


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=_error_detail("Logo must be JPEG, PNG, WebP, or GIF", "invalid_file_type"),
        )

    data = await file.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=400,
            detail=_error_detail("Logo must be under 2 MB", "file_too_large"),
        )

    ext = mimetypes.guess_extension(content_type) or ".png"
    if ext == ".jpe":
        ext = ".jpg"
    uid = _user_id(user)
    path = f"{uid}/logo{ext}"

    try:
        supabase = get_supabase()
        _get_or_create_profile(supabase, uid)

        supabase.storage.from_("avatars").upload(
            path,
            data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        avatar_url = supabase.storage.from_("avatars").get_public_url(path)

        now = datetime.now(timezone.utc).isoformat()
        result = (
            supabase.table("profiles")
            .update({"avatar_url": avatar_url, "updated_at": now})
            .eq("id", uid)
            .execute()
        )
        profile = first_row(result)
        if not profile:
            raise HTTPException(status_code=500, detail=_error_detail("Failed to save logo URL", "db_error"))

        return {"success": True, "data": _profile_response(profile, user.get("email"))}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        message, code = format_db_error(exc)
        status = 503 if code == "schema_missing" else 500
        raise HTTPException(
            status_code=status,
            detail=_error_detail(f"Failed to upload logo: {message}", code),
        ) from exc
