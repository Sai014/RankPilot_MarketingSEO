import re
from typing import Any
from urllib.parse import urlparse

from db.supabase_client import get_supabase
from db.supabase_helpers import all_rows, first_row
from services.sitemap_crawler import crawl_sitemap


def normalize_domain(domain: str) -> str:
    """Strip protocol, www, trailing slash → bare domain."""
    domain = domain.strip().lower()
    domain = re.sub(r"^https?://", "", domain)
    domain = domain.split("/")[0]
    domain = re.sub(r"^www\.", "", domain)
    return domain


def site_url_from_domain(domain: str) -> str:
    return f"https://{normalize_domain(domain)}"


async def onboard_domain(
    domain: str,
    max_pages: int = 200,
    display_name: str | None = None,
    target_countries: list[str] | None = None,
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

    existing = (
        supabase.table("domains")
        .select("id")
        .eq("domain", normalized)
        .maybe_single()
        .execute()
    )
    existing_row = first_row(existing)
    if existing_row:
        domain_id = existing_row["id"]
        supabase.table("domains").update(domain_fields).eq("id", domain_id).execute()
        supabase.table("pages").delete().eq("domain_id", domain_id).execute()
    else:
        insert_payload = {
            "domain": normalized,
            **domain_fields,
            "display_name": display_name or normalized,
            "target_countries": target_countries or [],
        }
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
        # Insert in batches of 100
        for i in range(0, len(rows), 100):
            supabase.table("pages").insert(rows[i : i + 100]).execute()

    supabase.table("domains").update({"status": "active"}).eq("id", domain_id).execute()

    domain_row = (
        supabase.table("domains").select("*").eq("id", domain_id).maybe_single().execute()
    )
    domain_data = first_row(domain_row)
    if not domain_data:
        raise RuntimeError("Domain row missing after onboarding")

    return {
        "domain": domain_data,
        "crawl": {
            "source": crawl_result.get("source"),
            "total_urls": len(urls),
        },
    }
