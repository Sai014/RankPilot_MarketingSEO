import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

from db.audit_store import persist_audit_row
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from services.page_utils import format_countries, keyword_from_path
from services.serp_helpers import find_domain_rank
from services.serp_tracker import track_serp

logger = logging.getLogger(__name__)

DEFAULT_DELAY_SEC = float(os.getenv("SERP_ONBOARD_DELAY_SEC", "1"))


def _default_location(domain_row: dict[str, Any]) -> str:
    countries = domain_row.get("target_countries") or []
    if isinstance(countries, list) and countries:
        return str(countries[0]).strip()
    return "United States"


async def _track_and_persist(
    *,
    keyword: str,
    location: str,
    target_domain: str,
    domain_id: str,
    page_id: str,
) -> bool:
    try:
        result = await track_serp(keyword=keyword, location=location, num=100)
        domain_rank = find_domain_rank(result["organic_results"], target_domain)
        result["target_domain"] = target_domain
        result["target_rank"] = domain_rank

        row = {
            "keyword": keyword,
            "location": location,
            "target_domain": target_domain,
            "target_rank": domain_rank,
            "result": result,
            "domain_id": domain_id,
            "page_id": page_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        persisted, error, _code = persist_audit_row(
            "serp_tracks",
            row,
            context=f"onboard keyword={keyword!r} page_id={page_id}",
        )
        if not persisted:
            logger.warning("SERP not saved keyword=%r page_id=%s: %s", keyword, page_id, error)
        return persisted
    except httpx.HTTPStatusError as exc:
        logger.error(
            "SERP failed keyword=%r status=%s",
            keyword,
            exc.response.status_code,
        )
        return False
    except RuntimeError as exc:
        logger.error("SERP config error keyword=%r: %s", keyword, exc)
        return False
    except Exception as exc:
        logger.error("SERP failed keyword=%r: %s", keyword, exc)
        return False


async def track_domain_pages(domain_id: str, *, delay_sec: float = DEFAULT_DELAY_SEC) -> dict[str, Any]:
    """Track SERP for each page's slug-derived keyword after onboarding."""
    supabase = get_supabase()

    domain_row = first_row(
        supabase.table("domains").select("*").eq("id", domain_id).maybe_single().execute()
    )
    if not domain_row:
        logger.warning("SERP batch skipped — domain not found domain_id=%s", domain_id)
        return {"domain_id": domain_id, "pages": 0, "tracks_ok": 0, "tracks_failed": 0}

    target_domain = domain_row["domain"]
    location = _default_location(domain_row)

    pages = all_rows(
        supabase.table("pages")
        .select("id, url, path, target_countries")
        .eq("domain_id", domain_id)
        .order("path")
        .execute()
    )

    if not pages:
        logger.info("SERP batch skipped — no pages domain_id=%s", domain_id)
        return {"domain_id": domain_id, "pages": 0, "tracks_ok": 0, "tracks_failed": 0}

    logger.info("SERP batch start domain_id=%s pages=%d", domain_id, len(pages))

    ok = 0
    failed = 0

    for index, page in enumerate(pages, start=1):
        keyword = keyword_from_path(page.get("path"))
        page_location = format_countries(page.get("target_countries"))
        track_location = page_location.split(",")[0].strip() if page_location else location

        if await _track_and_persist(
            keyword=keyword,
            location=track_location,
            target_domain=target_domain,
            domain_id=domain_id,
            page_id=page["id"],
        ):
            ok += 1
        else:
            failed += 1

        if delay_sec > 0:
            await asyncio.sleep(delay_sec)

        if index % 10 == 0:
            logger.info("SERP batch progress domain_id=%s %d/%d pages", domain_id, index, len(pages))

    summary = {
        "domain_id": domain_id,
        "pages": len(pages),
        "tracks_ok": ok,
        "tracks_failed": failed,
    }
    logger.info("SERP batch complete %s", summary)
    return summary
