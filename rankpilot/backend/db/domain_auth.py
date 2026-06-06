from typing import Any

from fastapi import HTTPException

from db.supabase_helpers import first_row


def error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def user_id_from(user: dict[str, Any]) -> str:
    uid = user.get("id")
    if not uid:
        raise HTTPException(
            status_code=401,
            detail=error_detail("Invalid user session", "unauthorized"),
        )
    return str(uid)


def get_owned_domain(supabase: Any, domain_id: str, uid: str) -> dict[str, Any]:
    result = (
        supabase.table("domains")
        .select("*")
        .eq("id", domain_id)
        .eq("user_id", uid)
        .maybe_single()
        .execute()
    )
    row = first_row(result)
    if not row:
        raise HTTPException(status_code=404, detail=error_detail("Domain not found", "not_found"))
    return row


def get_owned_page(supabase: Any, page_id: str, uid: str) -> tuple[dict[str, Any], dict[str, Any]]:
    page_result = (
        supabase.table("pages")
        .select("*")
        .eq("id", page_id)
        .maybe_single()
        .execute()
    )
    page_row = first_row(page_result)
    if not page_row:
        raise HTTPException(status_code=404, detail=error_detail("Page not found", "not_found"))
    domain_row = get_owned_domain(supabase, page_row["domain_id"], uid)
    return page_row, domain_row
