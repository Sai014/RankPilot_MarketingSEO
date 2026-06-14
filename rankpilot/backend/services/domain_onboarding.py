import logging
from typing import Any
from urllib.parse import urlparse

from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from services.domain_utils import normalize_domain, site_url_from_domain
from services.pagespeed_batch import audit_domain_pages
from services.serp_batch import track_domain_pages
from services.sitemap_crawler import crawl_sitemap

logger = logging.getLogger(__name__)


def _safe_clear_domain_table(supabase, table: str, domain_id: str) -> None:
    """Clear rows for a domain; ignore missing tables during migration rollout."""
    try:
        supabase.table(table).delete().eq("domain_id", domain_id).execute()
    except Exception as exc:
        logger.warning("Could not clear %s domain_id=%s: %s", table, domain_id, exc)


def _clear_domain_crawl_data(supabase, domain_id: str) -> None:
    for table in ("pagespeed_audits", "page_audits", "domain_audits", "pages"):
        _safe_clear_domain_table(supabase, table, domain_id)


async def onboard_domain(
    domain: str,
    max_pages: int = 200,
    display_name: str | None = None,
    target_countries: list[str] | None = None,
    user_id: str | None = None,
    existing_domain_id: str | None = None,
) -> dict[str, Any]:
    """
    Crawl sitemap for domain, persist domain row + page rows.
    Returns domain record with pages summary.
    """
    normalized = normalize_domain(domain)
    site_url = site_url_from_domain(normalized)

    crawl_result = await crawl_sitemap(site_url, max_pages=max_pages)
    page_details = {p["url"]: p for p in crawl_result.get("sample_pages", [])}

    supabase = get_supabase()

    sitemap_count = 1 if crawl_result.get("source") == "sitemap" else 0
    domain_fields = {
        "status": "syncing",
        "sitemap_source": crawl_result.get("source"),
        "page_count": crawl_result.get("total_urls", 0),
        "sitemap_count": sitemap_count,
    }
    if display_name:
        domain_fields["display_name"] = display_name
    if target_countries is not None:
        domain_fields["target_countries"] = target_countries

    if existing_domain_id:
        domain_id = existing_domain_id
        supabase.table("domains").update(domain_fields).eq("id", domain_id).execute()
        _clear_domain_crawl_data(supabase, domain_id)
    else:
        existing_query = supabase.table("domains").select("id").eq("domain", normalized)
        if user_id:
            existing_query = existing_query.eq("user_id", user_id)
        existing = existing_query.maybe_single().execute()
        existing_row = first_row(existing)
        if existing_row:
            domain_id = existing_row["id"]
            supabase.table("domains").update(domain_fields).eq("id", domain_id).execute()
            _clear_domain_crawl_data(supabase, domain_id)
        else:
            insert_payload = {
                "domain": normalized,
                **domain_fields,
                "display_name": display_name or normalized,
                "target_countries": target_countries or [],
            }
            if user_id:
                insert_payload["user_id"] = user_id
            insert = supabase.table("domains").insert(insert_payload).execute()
            rows = all_rows(insert)
            if not rows:
                raise RuntimeError("Failed to insert domain row")
            domain_id = rows[0]["id"]

    urls = crawl_result.get("urls", [])
    if urls:
        rows = []
        for url in urls:
            detail = page_details.get(url, {})
            path = urlparse(url).path or "/"
            rows.append(
                {
                    "domain_id": domain_id,
                    "url": url,
                    "path": path,
                    "title": detail.get("title"),
                    "meta_description": detail.get("meta_description"),
                    "h1": detail.get("h1"),
                }
            )
        for i in range(0, len(rows), 100):
            supabase.table("pages").insert(rows[i : i + 100]).execute()

    domain_row = (
        supabase.table("domains").select("*").eq("id", domain_id).maybe_single().execute()
    )
    domain_data = first_row(domain_row)
    if not domain_data:
        raise RuntimeError("Domain row missing after onboarding")

    return {
        "domain": domain_data,
        "domain_id": domain_id,
        "crawl": {
            "source": crawl_result.get("source"),
            "total_urls": len(urls),
        },
    }


def create_pending_domain(
    normalized: str,
    display_name: str,
    target_countries: list[str],
    user_id: str,
    gsc_site_url: str | None = None,
) -> dict[str, Any]:
    """Insert a placeholder domain row while sitemap crawl runs in the background."""
    supabase = get_supabase()
    insert_payload: dict[str, Any] = {
        "domain": normalized,
        "status": "syncing",
        "display_name": display_name,
        "target_countries": target_countries,
        "user_id": user_id,
        "page_count": 0,
        "sitemap_count": 0,
    }
    if gsc_site_url:
        insert_payload["gsc_site_url"] = gsc_site_url.strip()
        insert_payload["source"] = "gsc"

    insert = supabase.table("domains").insert(insert_payload).execute()
    rows = all_rows(insert)
    if not rows:
        raise RuntimeError("Failed to create domain row")
    return rows[0]


async def run_full_onboarding_pipeline(
    domain_id: str,
    domain: str,
    max_pages: int,
    user_id: str,
    auto_serp: bool,
    display_name: str | None = None,
    target_countries: list[str] | None = None,
    sync_gsc: bool = False,
) -> None:
    """Background: sitemap crawl → optional GSC sync → PageSpeed/SERP audits."""
    from services.gsc_sync import sync_domain_gsc_metrics
    from services.technical_audit_batch import audit_domain_technical

    supabase = get_supabase()
    try:
        await onboard_domain(
            domain,
            max_pages=max_pages,
            display_name=display_name,
            target_countries=target_countries,
            user_id=user_id,
            existing_domain_id=domain_id,
        )
    except Exception:
        logger.exception("Onboarding crawl failed domain_id=%s", domain_id)
        supabase.table("domains").update({"status": "error"}).eq("id", domain_id).execute()
        return

    # Crawl succeeded — pages are usable even if background audits fail.
    supabase.table("domains").update({"status": "active"}).eq("id", domain_id).execute()
    logger.info("Onboarding pipeline: crawl complete domain_id=%s domain=%s", domain_id, domain)

    if auto_serp:
        try:
            logger.info("Onboarding pipeline: starting SERP domain_id=%s", domain_id)
            supabase.table("serp_tracks").delete().eq("domain_id", domain_id).execute()
            serp_summary = await track_domain_pages(domain_id)
            logger.info("Onboarding pipeline: SERP complete domain_id=%s %s", domain_id, serp_summary)
        except Exception:
            logger.exception("SERP batch failed domain_id=%s", domain_id)

    if sync_gsc:
        try:
            logger.info("Onboarding pipeline: starting GSC sync domain_id=%s", domain_id)
            gsc_summary = await sync_domain_gsc_metrics(domain_id, user_id)
            logger.info("Onboarding pipeline: GSC sync complete domain_id=%s %s", domain_id, gsc_summary)
        except Exception:
            logger.exception("GSC sync failed domain_id=%s", domain_id)

    try:
        logger.info("Onboarding pipeline: starting technical audit domain_id=%s", domain_id)
        technical_summary = await audit_domain_technical(domain_id, domain)
        logger.info("Onboarding pipeline: technical audit complete domain_id=%s %s", domain_id, technical_summary)
    except Exception:
        logger.exception("Technical audit failed domain_id=%s", domain_id)

    try:
        logger.info("Onboarding pipeline: starting PageSpeed batch domain_id=%s", domain_id)
        pagespeed_summary = await audit_domain_pages(domain_id, manage_status=False)
        logger.info("Onboarding pipeline: PageSpeed batch complete domain_id=%s %s", domain_id, pagespeed_summary)
    except Exception:
        logger.exception("PageSpeed batch failed domain_id=%s", domain_id)


async def run_onboard_audits(domain_id: str, auto_serp: bool = True) -> dict[str, Any]:
    """Background step: SERP tracking first, then PageSpeed for all pages after crawl."""
    from services.technical_audit_batch import audit_domain_technical

    supabase = get_supabase()
    serp: dict[str, Any]
    if auto_serp:
        supabase.table("serp_tracks").delete().eq("domain_id", domain_id).execute()
        serp = await track_domain_pages(domain_id)
    else:
        serp = {"domain_id": domain_id, "skipped": True, "reason": "auto_serp disabled"}
        logger.info("SERP batch skipped domain_id=%s (auto_serp=false)", domain_id)
    domain_row = (
        supabase.table("domains").select("domain").eq("id", domain_id).maybe_single().execute()
    )
    domain_name = (first_row(domain_row) or {}).get("domain") or ""
    technical = await audit_domain_technical(domain_id, domain_name) if domain_name else None
    pagespeed = await audit_domain_pages(domain_id, manage_status=False)
    return {
        "domain_id": domain_id,
        "auto_serp": auto_serp,
        "serp": serp,
        "technical": technical,
        "pagespeed": pagespeed,
    }
