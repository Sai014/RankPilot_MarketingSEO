import asyncio

from fastapi import Header, HTTPException

from db.supabase_client import get_current_user


def _unauthorized(message: str = "Invalid or expired token") -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={"error": message, "code": "unauthorized"},
    )


async def require_user(authorization: str = Header(...)) -> dict:
    """Validate Bearer token and return the Supabase user dict."""
    if not authorization.startswith("Bearer "):
        raise _unauthorized("Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise _unauthorized("Missing bearer token")

    return await asyncio.to_thread(get_current_user, token)
