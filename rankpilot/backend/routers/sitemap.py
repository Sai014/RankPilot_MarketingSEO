from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.supabase_client import get_supabase
from services.groq_client import safe_analyze_with_groq
from services.sitemap_crawler import crawl_sitemap

router = APIRouter(prefix="/api/sitemap", tags=["sitemap"])


class SitemapCrawlRequest(BaseModel):
    site_url: str = Field(..., min_length=1)
    max_pages: int = Field(default=100, ge=1, le=500)
    project_id: str | None = None
    analyze: bool = False


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


@router.post("/crawl")
async def crawl_site(body: SitemapCrawlRequest) -> dict[str, Any]:
    try:
        result = await crawl_sitemap(body.site_url, max_pages=body.max_pages)

        analysis = None
        analysis_error = None
        if body.analyze and result.get("sample_pages"):
            pages_summary = "\n".join(
                f"- {p['url']}: title={p.get('title')}, h1={p.get('h1')}"
                for p in result["sample_pages"][:10]
            )
            prompt = (
                f"Analyze this sitemap crawl for {body.site_url}.\n"
                f"Found {result['total_urls']} URLs via {result['source']}.\n"
                f"Sample pages:\n{pages_summary}\n\n"
                "List top SEO issues and quick wins."
            )
            analysis, analysis_error = await safe_analyze_with_groq(prompt)

        if body.project_id:
            try:
                supabase = get_supabase()
                supabase.table("sitemap_audits").insert(
                    {
                        "project_id": body.project_id,
                        "site_url": body.site_url,
                        "total_urls": result["total_urls"],
                        "source": result["source"],
                        "result": result,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).execute()
            except Exception:
                pass

        return {"success": True, "data": result, "analysis": analysis, "analysis_error": analysis_error}
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=_error_detail(f"Failed to fetch site: {exc}", "fetch_error"),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Sitemap crawl failed: {exc}", "crawl_error"),
        ) from exc


@router.get("/audits/{project_id}")
async def list_audits(project_id: str) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("sitemap_audits")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return {"success": True, "data": result.data or []}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Failed to list audits: {exc}", "db_error"),
        ) from exc
