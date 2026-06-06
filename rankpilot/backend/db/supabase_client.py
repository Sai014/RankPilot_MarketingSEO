import os
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv
from fastapi import HTTPException
from supabase import Client, create_client

load_dotenv()

_instance: Client | None = None


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return a singleton Supabase client."""
    global _instance
    if _instance is not None:
        return _instance

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment")

    _instance = create_client(url, key)
    return _instance


def get_current_user(token: str) -> dict[str, Any]:
    """Validate a JWT via Supabase Auth and return the user object."""
    try:
        supabase = get_supabase()
        response = supabase.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail={"error": "Invalid or expired token", "code": "unauthorized"},
        ) from exc

    user = response.user
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"error": "Invalid or expired token", "code": "unauthorized"},
        )

    if hasattr(user, "model_dump"):
        return user.model_dump()
    if isinstance(user, dict):
        return user
    return {"id": user.id, "email": getattr(user, "email", None)}
