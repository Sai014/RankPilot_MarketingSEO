from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.supabase_client import get_supabase
from services.competitor_scraper import scrape_competitor
from services.groq_client import safe_analyze_with_groq

router = APIRouter(prefix="/api/competitors", tags=["competitors"])


class CompetitorScrapeRequest(BaseModel):
    url: str = Field(..., min_length=1)
    project_id: str | None = None
    analyze: bool = False


class CompetitorCompareRequest(BaseModel):
    your_url: str = Field(..., min_length=1)
    competitor_urls: list[str] = Field(..., min_length=1, max_length=5)
    analyze: bool = True


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


@router.post("/scrape")
async def scrape_competitor_page(body: CompetitorScrapeRequest) -> dict[str, Any]:
    try:
        result = await scrape_competitor(body.url)

        analysis = None
        analysis_error = None
        if body.analyze:
            prompt = (
                f"On-page SEO analysis for competitor: {result['url']}\n"
                f"Title ({result['title_length']} chars): {result['title']}\n"
                f"Meta desc ({result['meta_description_length']} chars): {result['meta_description']}\n"
                f"H1 tags: {result['h1_tags']}\n"
                f"Word count: {result['word_count']}\n"
                f"Internal links: {result['internal_link_count']}, External: {result['external_link_count']}\n"
                f"Schema markup: {result['has_schema_markup']}\n\n"
                "Identify strengths, weaknesses, and content gaps."
            )
            analysis, analysis_error = await safe_analyze_with_groq(prompt)

        if body.project_id:
            try:
                supabase = get_supabase()
                supabase.table("competitor_scrapes").insert(
                    {
                        "project_id": body.project_id,
                        "url": body.url,
                        "result": result,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).execute()
            except Exception:
                pass

        return {"success": True, "data": result, "analysis": analysis, "analysis_error": analysis_error}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=_error_detail(
                f"Failed to fetch URL: HTTP {exc.response.status_code}",
                "fetch_error",
            ),
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=_error_detail(f"Failed to fetch URL: {exc}", "fetch_error"),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Competitor scrape failed: {exc}", "scrape_error"),
        ) from exc


@router.post("/compare")
async def compare_competitors(body: CompetitorCompareRequest) -> dict[str, Any]:
    try:
        your_data = await scrape_competitor(body.your_url)
        competitor_data: list[dict[str, Any]] = []

        for url in body.competitor_urls:
            try:
                data = await scrape_competitor(url)
                competitor_data.append(data)
            except httpx.HTTPError:
                competitor_data.append({"url": url, "error": "Failed to scrape"})

        comparison = {
            "your_site": your_data,
            "competitors": competitor_data,
        }

        analysis = None
        analysis_error = None
        if body.analyze:
            comp_summary = "\n".join(
                f"- {c.get('url', 'unknown')}: title_len={c.get('title_length')}, "
                f"words={c.get('word_count')}, h1_count={len(c.get('h1_tags', []))}"
                for c in competitor_data
                if "error" not in c
            )
            prompt = (
                f"Compare on-page SEO:\n\nYour site ({your_data['url']}):\n"
                f"  title_len={your_data['title_length']}, words={your_data['word_count']}, "
                f"h1={your_data['h1_tags']}\n\nCompetitors:\n{comp_summary}\n\n"
                "Provide a competitive gap analysis with actionable recommendations."
            )
            analysis, analysis_error = await safe_analyze_with_groq(prompt)

        return {"success": True, "data": comparison, "analysis": analysis, "analysis_error": analysis_error}
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=_error_detail(f"Failed to fetch URL: {exc}", "fetch_error"),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Comparison failed: {exc}", "compare_error"),
        ) from exc


@router.get("/history/{project_id}")
async def competitor_history(project_id: str) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("competitor_scrapes")
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
            detail=_error_detail(f"Failed to fetch competitor history: {exc}", "db_error"),
        ) from exc
