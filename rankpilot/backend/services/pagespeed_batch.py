import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

from db.audit_store import persist_audit_row
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows
from services.pagespeed_service import run_pagespeed_audit

logger = logging.getLogger(__name__)

STRATEGIES = ("mobile", "desktop")
DEFAULT_DELAY_SEC = float(os.getenv("PAGESPEED_ONBOARD_DELAY_SEC", "2"))


async def _audit_and_persist(
    *,
    url: str,
    strategy: str,
    domain_id: str,
    page_id: str,
) -> bool:
    try:
        result = await run_pagespeed_audit(url, strategy=strategy)
        row = {
            "url": url,
            "strategy": strategy,
            "result": result,
            "domain_id": domain_id,
            "page_id": page_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        persisted, error, _code = persist_audit_row(
            "pagespeed_audits",
            row,
            context=f"onboard url={url} strategy={strategy}",
        )
        if not persisted:
            logger.warning("PageSpeed not saved url=%s strategy=%s: %s", url, strategy, error)
        return persisted
    except httpx.HTTPStatusError as exc:
        logger.error(
            "PageSpeed failed url=%s strategy=%s status=%s",
            url,
            strategy,
            exc.response.status_code,
        )
        return False
    except Exception as exc:
        logger.error("PageSpeed failed url=%s strategy=%s: %s", url, strategy, exc)
        return False


async def audit_domain_pages(
    domain_id: str,
    *,
    delay_sec: float = DEFAULT_DELAY_SEC,
    manage_status: bool = True,
) -> dict[str, Any]:
    """
    Run mobile + desktop PageSpeed for every page in a domain.
    Intended to run after sitemap onboarding (typically as a background task).
    """
    supabase = get_supabase()
    pages = all_rows(
        supabase.table("pages")
        .select("id, url, path")
        .eq("domain_id", domain_id)
        .order("path")
        .execute()
    )

    if not pages:
        logger.info("PageSpeed batch skipped — no pages domain_id=%s", domain_id)
        return {"domain_id": domain_id, "pages": 0, "audits_ok": 0, "audits_failed": 0}

    logger.info("PageSpeed batch start domain_id=%s pages=%d", domain_id, len(pages))
    if manage_status:
        supabase.table("domains").update({"status": "syncing"}).eq("id", domain_id).execute()

    ok = 0
    failed = 0

    try:
        for index, page in enumerate(pages, start=1):
            url = page["url"]
            page_id = page["id"]
            for strategy in STRATEGIES:
                if await _audit_and_persist(
                    url=url,
                    strategy=strategy,
                    domain_id=domain_id,
                    page_id=page_id,
                ):
                    ok += 1
                else:
                    failed += 1
                if delay_sec > 0:
                    await asyncio.sleep(delay_sec)

            if index % 10 == 0:
                logger.info(
                    "PageSpeed batch progress domain_id=%s %d/%d pages",
                    domain_id,
                    index,
                    len(pages),
                )
    finally:
        if manage_status:
            supabase.table("domains").update({"status": "active"}).eq("id", domain_id).execute()

    summary = {
        "domain_id": domain_id,
        "pages": len(pages),
        "audits_ok": ok,
        "audits_failed": failed,
    }
    logger.info("PageSpeed batch complete %s", summary)
    return summary
