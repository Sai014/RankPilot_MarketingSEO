import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

from db.audit_store import persist_audit_row
from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows
from services.audit_scoring import compute_health_score
from services.onpage_audit import run_onpage_audit
from services.security_headers import run_security_headers_audit
from services.ssl_audit import run_ssl_audit
from services.domain_utils import normalize_domain, site_url_from_domain

logger = logging.getLogger(__name__)

DEFAULT_DELAY_SEC = float(os.getenv("TECHNICAL_AUDIT_DELAY_SEC", "1"))


def _latest_by_key(audits: list[dict], key_fn) -> dict[str, dict]:
    latest: dict[str, dict] = {}
    for audit in audits:
        key = key_fn(audit)
        if not key:
            continue
        existing = latest.get(key)
        if not existing or audit.get("created_at", "") > existing.get("created_at", ""):
            latest[key] = audit
    return latest


def latest_domain_audits(audits: list[dict]) -> dict[str, dict]:
    """Latest ssl + security_headers audit per audit_type."""
    return _latest_by_key(audits, lambda a: a.get("audit_type"))


def latest_page_audits(audits: list[dict]) -> dict[str, dict]:
    """Latest onpage audit per page_id."""
    return _latest_by_key(audits, lambda a: a.get("page_id"))


def build_page_health(
    *,
    pagespeed_mobile: dict | None,
    onpage_audit: dict | None,
    domain_security_score: float | None,
) -> dict[str, Any] | None:
    mobile_metrics = (pagespeed_mobile or {}).get("result", {}).get("metrics") or pagespeed_mobile or {}
    if isinstance(pagespeed_mobile, dict) and "performance_score" in pagespeed_mobile:
        mobile_metrics = pagespeed_mobile

    onpage_score = onpage_audit.get("score") if onpage_audit else None
    if onpage_score is None and onpage_audit:
        onpage_score = (onpage_audit.get("result") or {}).get("score")

    health = compute_health_score(
        performance=mobile_metrics.get("performance_score"),
        seo=mobile_metrics.get("seo_score"),
        accessibility=mobile_metrics.get("accessibility_score"),
        onpage=float(onpage_score) if onpage_score is not None else None,
        security=domain_security_score,
    )

    if health is None and onpage_score is None:
        return None

    return {
        "health_score": health,
        "onpage_score": int(onpage_score) if onpage_score is not None else None,
        "performance_score": mobile_metrics.get("performance_score"),
        "seo_score": mobile_metrics.get("seo_score"),
        "accessibility_score": mobile_metrics.get("accessibility_score"),
        "security_score": domain_security_score,
    }


async def _persist_domain_audit(
    *,
    domain_id: str,
    audit_type: str,
    result: dict[str, Any],
    score: float | int,
) -> bool:
    row = {
        "domain_id": domain_id,
        "audit_type": audit_type,
        "result": result,
        "score": score,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    persisted, error, _code = persist_audit_row(
        "domain_audits",
        row,
        context=f"domain_id={domain_id} type={audit_type}",
    )
    if not persisted:
        logger.warning("Domain audit not saved type=%s: %s", audit_type, error)
    return persisted


async def _persist_page_audit(
    *,
    domain_id: str,
    page_id: str,
    url: str,
    result: dict[str, Any],
    score: int,
) -> bool:
    row = {
        "domain_id": domain_id,
        "page_id": page_id,
        "url": url,
        "audit_type": "onpage",
        "result": result,
        "score": score,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    persisted, error, _code = persist_audit_row(
        "page_audits",
        row,
        context=f"page_id={page_id} onpage",
    )
    if not persisted:
        logger.warning("Page audit not saved page_id=%s: %s", page_id, error)
    return persisted


async def audit_domain_security(domain_id: str, domain: str) -> dict[str, Any]:
    """Run SSL + security header checks once per domain."""
    site_url = site_url_from_domain(domain)
    hostname = normalize_domain(domain)
    summary: dict[str, Any] = {"domain_id": domain_id, "ssl_ok": False, "headers_ok": False}

    try:
        ssl_result = await asyncio.to_thread(run_ssl_audit, hostname)
        summary["ssl_ok"] = await _persist_domain_audit(
            domain_id=domain_id,
            audit_type="ssl",
            result=ssl_result,
            score=ssl_result["score"],
        )
        logger.info(
            "SSL audit domain_id=%s hostname=%s score=%s tls=%s",
            domain_id,
            hostname,
            ssl_result["score"],
            ssl_result.get("tls_version"),
        )
    except Exception as exc:
        logger.error("SSL audit failed domain_id=%s: %s", domain_id, exc)

    try:
        headers_result = await run_security_headers_audit(site_url)
        summary["headers_ok"] = await _persist_domain_audit(
            domain_id=domain_id,
            audit_type="security_headers",
            result=headers_result,
            score=headers_result["score"],
        )
        logger.info(
            "Security headers audit domain_id=%s score=%s missing=%d",
            domain_id,
            headers_result["score"],
            len(headers_result.get("missing") or []),
        )
    except Exception as exc:
        logger.error("Security headers audit failed domain_id=%s: %s", domain_id, exc)

    return summary


async def audit_domain_pages_onpage(
    domain_id: str,
    *,
    delay_sec: float = DEFAULT_DELAY_SEC,
) -> dict[str, Any]:
    """Run on-page HTML audit for every page in a domain."""
    supabase = get_supabase()
    pages = all_rows(
        supabase.table("pages")
        .select("id, url, path")
        .eq("domain_id", domain_id)
        .order("path")
        .execute()
    )

    if not pages:
        logger.info("On-page audit skipped — no pages domain_id=%s", domain_id)
        return {"domain_id": domain_id, "pages": 0, "audits_ok": 0, "audits_failed": 0}

    logger.info("On-page audit start domain_id=%s pages=%d", domain_id, len(pages))
    ok = 0
    failed = 0

    for index, page in enumerate(pages, start=1):
        url = page["url"]
        page_id = page["id"]
        try:
            result = await run_onpage_audit(url)
            if await _persist_page_audit(
                domain_id=domain_id,
                page_id=page_id,
                url=url,
                result=result,
                score=result["score"],
            ):
                ok += 1
                logger.info(
                    "On-page audit saved page_id=%s score=%s issues=%d url=%s",
                    page_id,
                    result["score"],
                    len(result.get("issues") or []),
                    url,
                )
            else:
                failed += 1
        except Exception as exc:
            logger.error("On-page audit failed url=%s: %s", url, exc)
            failed += 1

        if delay_sec > 0:
            await asyncio.sleep(delay_sec)

        if index % 20 == 0:
            logger.info("On-page audit progress domain_id=%s %d/%d", domain_id, index, len(pages))

    summary = {"domain_id": domain_id, "pages": len(pages), "audits_ok": ok, "audits_failed": failed}
    logger.info("On-page audit complete %s", summary)
    return summary


async def audit_domain_technical(domain_id: str, domain: str) -> dict[str, Any]:
    """Full Phase 1 technical audit: domain SSL/headers + per-page on-page."""
    logger.info("Technical audit batch start domain_id=%s domain=%s", domain_id, domain)
    domain_result = await audit_domain_security(domain_id, domain)
    pages_result = await audit_domain_pages_onpage(domain_id)
    summary = {"domain": domain_result, "pages": pages_result}
    logger.info("Technical audit batch complete domain_id=%s %s", domain_id, summary)
    return summary
