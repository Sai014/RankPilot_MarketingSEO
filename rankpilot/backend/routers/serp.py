import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.audit_store import persist_audit_row
from db.supabase_client import get_supabase
from services.groq_client import safe_analyze_with_groq
from services.serp_tracker import track_serp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/serp", tags=["serp"])


class SerpTrackRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=500)
    location: str = "United States"
    google_domain: str = "google.com"
    gl: str = "us"
    hl: str = "en"
    num: int = Field(default=10, ge=1, le=100)
    project_id: str | None = None
    domain_id: str | None = None
    page_id: str | None = None
    target_domain: str | None = None
    analyze: bool = False


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


def _find_domain_rank(organic: list[dict], target_domain: str) -> int | None:
    target = target_domain.lower().replace("www.", "")
    for item in organic:
        link = (item.get("link") or "").lower()
        domain = (item.get("domain") or "").lower().replace("www.", "")
        if target in link or target in domain:
            return item.get("position")
    return None


@router.post("/track")
async def track_keyword(body: SerpTrackRequest) -> dict[str, Any]:
    logger.info(
        "SERP track request keyword=%r location=%r domain_id=%s target_domain=%s",
        body.keyword,
        body.location,
        body.domain_id,
        body.target_domain,
    )
    try:
        result = await track_serp(
            keyword=body.keyword,
            location=body.location,
            google_domain=body.google_domain,
            gl=body.gl,
            hl=body.hl,
            num=body.num,
        )
        logger.info(
            "SERP fetched keyword=%r organic_count=%d",
            body.keyword,
            len(result.get("organic_results") or []),
        )

        domain_rank = None
        if body.target_domain:
            domain_rank = _find_domain_rank(result["organic_results"], body.target_domain)
            result["target_domain"] = body.target_domain
            result["target_rank"] = domain_rank
            logger.info(
                "SERP domain rank keyword=%r target=%s rank=%s",
                body.keyword,
                body.target_domain,
                domain_rank,
            )

        analysis = None
        analysis_error = None
        if body.analyze:
            top_results = "\n".join(
                f"{r['position']}. {r['title']} — {r['link']}"
                for r in result["organic_results"][:10]
            )
            prompt = (
                f"SERP analysis for keyword: '{body.keyword}'\n"
                f"Top results:\n{top_results}\n\n"
                "Summarize ranking patterns, content types winning, and opportunities."
            )
            analysis, analysis_error = await safe_analyze_with_groq(prompt)

        persisted = False
        save_error = None
        save_code = None

        if body.project_id or body.domain_id:
            row = {
                "keyword": body.keyword,
                "location": body.location,
                "target_domain": body.target_domain,
                "target_rank": domain_rank,
                "result": result,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            if body.project_id:
                row["project_id"] = body.project_id
            if body.domain_id:
                row["domain_id"] = body.domain_id
            if body.page_id:
                row["page_id"] = body.page_id

            context = f"keyword={body.keyword!r}, domain_id={body.domain_id}"
            persisted, save_error, save_code = persist_audit_row("serp_tracks", row, context=context)
        else:
            logger.warning(
                "SERP track not persisted — no project_id or domain_id (keyword=%r)",
                body.keyword,
            )

        return {
            "success": True,
            "data": result,
            "analysis": analysis,
            "analysis_error": analysis_error,
            "persisted": persisted,
            "save_error": save_error,
            "save_code": save_code,
        }
    except httpx.HTTPStatusError as exc:
        logger.error(
            "ValueSERP API error keyword=%r status=%s",
            body.keyword,
            exc.response.status_code,
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail=_error_detail(
                f"ValueSERP API error: {exc.response.status_code}",
                "serp_api_error",
            ),
        ) from exc
    except RuntimeError as exc:
        logger.error("SERP config error: %s", exc)
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        logger.exception("SERP tracking failed keyword=%r", body.keyword)
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"SERP tracking failed: {exc}", "serp_error"),
        ) from exc


@router.get("/history/{project_id}")
async def serp_history(project_id: str) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("serp_tracks")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        rows = result.data or []
        logger.info("SERP history project_id=%s count=%d", project_id, len(rows))
        return {"success": True, "data": rows}
    except RuntimeError as exc:
        logger.error("SERP history config error: %s", exc)
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        logger.exception("Failed to fetch SERP history project_id=%s", project_id)
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Failed to fetch SERP history: {exc}", "db_error"),
        ) from exc
