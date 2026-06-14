"""Sync Google Search Console performance data into page_metrics."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from services.composio_service import execute_gsc_tool, get_active_gsc_connection
from services.domain_utils import normalize_domain

logger = logging.getLogger(__name__)

GSC_SEARCH_ANALYTICS = "GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY"


def should_sync_gsc(domain_row: dict, max_age_hours: int = 6) -> bool:
    """Return True if GSC-linked domain metrics are stale enough to refresh."""
    if not domain_row.get("gsc_site_url"):
        return False
    last = domain_row.get("gsc_last_synced_at")
    if not last:
        return True
    try:
        synced_at = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
    except ValueError:
        return True
    if synced_at.tzinfo is None:
        synced_at = synced_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - synced_at > timedelta(hours=max_age_hours)


def gsc_site_to_domain(gsc_site_url: str) -> str:
    """Convert a GSC property URL to the normalized domain used in our DB."""
    url = gsc_site_url.strip()
    if url.lower().startswith("sc-domain:"):
        return normalize_domain(url.split(":", 1)[1])
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc or parsed.path.split("/")[0]
    return normalize_domain(host)


def _normalize_page_url(url: str) -> str:
    return url.lower().rstrip("/")


def _gsc_rows(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        return data.get("rows") or []
    return []


async def sync_domain_gsc_metrics(domain_id: str, user_id: str) -> dict[str, Any]:
    """Fetch GSC search analytics for a linked domain and upsert page_metrics."""
    supabase = get_supabase()
    domain_row = (
        supabase.table("domains")
        .select("*")
        .eq("id", domain_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    domain = first_row(domain_row)
    if not domain:
        raise ValueError("Domain not found")
    gsc_site_url = domain.get("gsc_site_url")
    if not gsc_site_url:
        return {"domain_id": domain_id, "skipped": True, "reason": "not_gsc_linked"}

    connection = get_active_gsc_connection(user_id)
    if not connection:
        raise RuntimeError("Google account not connected")

    end = date.today() - timedelta(days=3)
    start = end - timedelta(days=27)

    data = execute_gsc_tool(
        user_id,
        GSC_SEARCH_ANALYTICS,
        arguments={
            "site_url": gsc_site_url,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "dimensions": ["page"],
            "row_limit": 25000,
        },
        connected_account_id=connection["connected_account_id"],
    )

    pages = all_rows(
        supabase.table("pages").select("id, url").eq("domain_id", domain_id).execute()
    )
    page_by_url = {_normalize_page_url(p["url"]): p["id"] for p in pages}

    synced = 0
    for row in _gsc_rows(data):
        keys = row.get("keys") or []
        if not keys:
            continue
        page_url = keys[0]
        page_id = page_by_url.get(_normalize_page_url(page_url))
        if not page_id:
            continue

        clicks = int(row.get("clicks") or 0)
        impressions = int(row.get("impressions") or 0)
        ctr = float(row.get("ctr") or 0)
        position = float(row.get("position") or 0)

        supabase.table("page_metrics").upsert(
            {
                "page_id": page_id,
                "clicks": clicks,
                "impressions": impressions,
                "ctr": ctr,
                "avg_position": position,
            },
            on_conflict="page_id",
        ).execute()
        synced += 1

    supabase.table("domains").update(
        {"gsc_last_synced_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", domain_id).execute()

    logger.info("GSC sync domain_id=%s pages_synced=%d", domain_id, synced)
    return {
        "domain_id": domain_id,
        "pages_synced": synced,
        "date_range": {"start": start.isoformat(), "end": end.isoformat()},
    }
