"""Composio integration for Google Search Console OAuth and tool execution."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from db.supabase_client import get_supabase
from db.supabase_helpers import first_row

logger = logging.getLogger(__name__)

GSC_LIST_SITES = "GOOGLE_SEARCH_CONSOLE_LIST_SITES"
GSC_SEARCH_ANALYTICS = "GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY"
GSC_TOOLKIT_SLUG = "google_search_console"
GSC_TOOLKIT_VERSION_DEFAULT = "20260429_00"


def _gsc_toolkit_version() -> str:
    return os.getenv("COMPOSIO_GSC_TOOLKIT_VERSION", GSC_TOOLKIT_VERSION_DEFAULT).strip() or GSC_TOOLKIT_VERSION_DEFAULT


def _api_key() -> str:
    key = os.getenv("COMPOSIO_API_KEY", "").strip()
    if not key:
        raise RuntimeError("COMPOSIO_API_KEY is not configured")
    return key


def _auth_config_id() -> str:
    auth_id = os.getenv("COMPOSIO_GSC_AUTH_CONFIG_ID", "").strip()
    if not auth_id:
        raise RuntimeError("COMPOSIO_GSC_AUTH_CONFIG_ID is not configured")
    return auth_id


def _frontend_callback_url() -> str:
    explicit = os.getenv("FRONTEND_URL", "").strip()
    if explicit:
        return f"{explicit.rstrip('/')}/domains?google_connected=1"
    cors = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    origin = cors.split(",")[0].strip()
    return f"{origin}/domains?google_connected=1"


def get_composio_client():
    try:
        from composio import Composio
    except ImportError as exc:
        raise RuntimeError(
            "Composio is not installed. Run: python -m pip install composio>=0.7.0"
        ) from exc

    return Composio(
        api_key=_api_key(),
        toolkit_versions={GSC_TOOLKIT_SLUG: _gsc_toolkit_version()},
    )


def create_google_connect_link(user_id: str) -> dict[str, str]:
    """Return Composio hosted OAuth URL for Google Search Console."""
    composio = get_composio_client()
    connection = composio.connected_accounts.link(
        user_id=user_id,
        auth_config_id=_auth_config_id(),
        callback_url=_frontend_callback_url(),
    )
    return {
        "redirect_url": connection.redirect_url,
        "connection_request_id": getattr(connection, "id", None),
    }


def get_active_gsc_connection(user_id: str) -> dict[str, Any] | None:
    """Find the user's active Composio connected account for GSC."""
    connections = list_active_gsc_connections(user_id)
    if not connections:
        return None
    return connections[0]


def list_active_gsc_connections(user_id: str) -> list[dict[str, Any]]:
    """List all active GSC connected accounts for a user."""
    composio = get_composio_client()
    try:
        result = composio.connected_accounts.list(
            user_ids=[user_id],
            toolkit_slugs=["GOOGLE_SEARCH_CONSOLE"],
            statuses=["ACTIVE"],
        )
    except TypeError:
        result = composio.connected_accounts.list(user_ids=[user_id])

    items = _extract_items(result)
    connections: list[dict[str, Any]] = []
    for account in items:
        if not _is_active_gsc_account(account):
            continue
        account_id = _account_id(account)
        if not account_id:
            continue
        connections.append(
            {
                "connected_account_id": account_id,
                "email": _account_email(account),
                "status": _account_status(account),
            }
        )
    return connections


def disconnect_gsc_connection(user_id: str) -> dict[str, Any]:
    """Revoke Composio GSC connections and clear local storage for a user."""
    composio = get_composio_client()
    account_ids: set[str] = set()

    try:
        row = (
            get_supabase()
            .table("google_connections")
            .select("composio_connected_account_id")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        stored = first_row(row)
        if stored and stored.get("composio_connected_account_id"):
            account_ids.add(str(stored["composio_connected_account_id"]))
    except Exception as exc:
        logger.warning("Could not read google_connections for user_id=%s: %s", user_id, exc)

    for connection in list_active_gsc_connections(user_id):
        account_ids.add(connection["connected_account_id"])

    deleted: list[str] = []
    errors: list[str] = []
    for account_id in account_ids:
        try:
            composio.connected_accounts.delete(account_id)
            deleted.append(account_id)
        except Exception as exc:
            logger.warning("Composio delete failed for %s: %s", account_id, exc)
            try:
                composio.connected_accounts.disable(account_id)
                deleted.append(account_id)
            except Exception as disable_exc:
                errors.append(f"{account_id}: {disable_exc}")

    try:
        get_supabase().table("google_connections").delete().eq("user_id", user_id).execute()
    except Exception as exc:
        logger.warning("Could not delete google_connections row for user_id=%s: %s", user_id, exc)

    if errors and not deleted:
        raise RuntimeError("; ".join(errors))

    return {"connected": False, "revoked_accounts": deleted}


def _extract_items(result: Any) -> list[Any]:
    if result is None:
        return []
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        return result.get("items") or result.get("data") or []
    items = getattr(result, "items", None)
    if items is not None:
        return list(items)
    data = getattr(result, "data", None)
    if data is not None:
        return list(data)
    return []


def _is_active_gsc_account(account: Any) -> bool:
    status = _account_status(account).upper()
    if status and status not in ("ACTIVE", "CONNECTED", "INITIATED"):
        return False
    toolkit = _account_toolkit(account).upper()
    if toolkit and "GOOGLE_SEARCH_CONSOLE" not in toolkit and "SEARCH_CONSOLE" not in toolkit:
        return False
    return True


def _account_id(account: Any) -> str:
    if isinstance(account, dict):
        return str(account.get("id") or account.get("connected_account_id") or "")
    return str(getattr(account, "id", "") or getattr(account, "connected_account_id", ""))


def _account_status(account: Any) -> str:
    if isinstance(account, dict):
        return str(account.get("status") or "")
    return str(getattr(account, "status", "") or "")


def _account_toolkit(account: Any) -> str:
    if isinstance(account, dict):
        app = account.get("appName") or account.get("app_name") or account.get("toolkit")
        if isinstance(app, dict):
            return str(app.get("slug") or app.get("name") or "")
        return str(app or account.get("toolkit_slug") or "")
    app = getattr(account, "app_name", None) or getattr(account, "appName", None)
    return str(app or "")


def _account_email(account: Any) -> str | None:
    if isinstance(account, dict):
        meta = account.get("metadata") or account.get("connectionParams") or {}
        if isinstance(meta, dict):
            return meta.get("email") or meta.get("user_email")
    meta = getattr(account, "metadata", None)
    if isinstance(meta, dict):
        return meta.get("email")
    return None


def _parse_tool_data(response: Any) -> Any:
    if isinstance(response, dict):
        if "data" in response:
            data = response["data"]
        elif "successful" in response:
            data = response.get("data")
        else:
            return response
    else:
        data = getattr(response, "data", response)

    if isinstance(data, str):
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return data
    return data


def execute_gsc_tool(
    user_id: str,
    slug: str,
    arguments: dict[str, Any] | None = None,
    connected_account_id: str | None = None,
) -> Any:
    composio = get_composio_client()
    kwargs: dict[str, Any] = {
        "slug": slug,
        "arguments": arguments or {},
        "user_id": user_id,
        "version": _gsc_toolkit_version(),
    }
    if connected_account_id:
        kwargs["connected_account_id"] = connected_account_id
    response = composio.tools.execute(**kwargs)
    if isinstance(response, dict) and response.get("successful") is False:
        error = response.get("error") or "GSC tool execution failed"
        raise RuntimeError(str(error))
    successful = getattr(response, "successful", None)
    if successful is False:
        error = getattr(response, "error", None) or "GSC tool execution failed"
        raise RuntimeError(str(error))
    return _parse_tool_data(response)


def list_gsc_sites(user_id: str, connected_account_id: str) -> list[dict[str, Any]]:
    data = execute_gsc_tool(
        user_id,
        GSC_LIST_SITES,
        connected_account_id=connected_account_id,
    )
    if isinstance(data, dict):
        entries = data.get("siteEntry") or data.get("site_entry") or []
    elif isinstance(data, list):
        entries = data
    else:
        entries = []
    sites = []
    for entry in entries:
        if isinstance(entry, dict):
            site_url = entry.get("siteUrl") or entry.get("site_url")
            permission = entry.get("permissionLevel") or entry.get("permission_level")
        else:
            site_url = getattr(entry, "siteUrl", None) or getattr(entry, "site_url", None)
            permission = getattr(entry, "permissionLevel", None)
        if site_url:
            sites.append({"site_url": site_url, "permission_level": permission})
    return sites
