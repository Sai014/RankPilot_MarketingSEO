import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.audit_store import persist_audit_row
from db.supabase_client import get_supabase
from services.groq_client import safe_analyze_with_groq
from services.pagespeed_service import run_pagespeed_audit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pagespeed", tags=["pagespeed"])


class PageSpeedRequest(BaseModel):
    url: str = Field(..., min_length=1)
    strategy: str = Field(default="mobile", pattern="^(mobile|desktop)$")
    project_id: str | None = None
    domain_id: str | None = None
    page_id: str | None = None
    analyze: bool = False


def _error_detail(message: str, code: str = "error") -> dict[str, str]:
    return {"error": message, "code": code}


@router.post("/audit")
async def audit_pagespeed(body: PageSpeedRequest) -> dict[str, Any]:
    logger.info(
        "PageSpeed audit url=%s strategy=%s domain_id=%s",
        body.url,
        body.strategy,
        body.domain_id,
    )
    try:
        result = await run_pagespeed_audit(body.url, strategy=body.strategy)
        metrics = result.get("metrics", {})
        logger.info(
            "PageSpeed complete url=%s strategy=%s perf=%s seo=%s a11y=%s bp=%s",
            body.url,
            body.strategy,
            metrics.get("performance_score"),
            metrics.get("seo_score"),
            metrics.get("accessibility_score"),
            metrics.get("best_practices_score"),
        )

        analysis = None
        analysis_error = None
        if body.analyze:
            prompt = (
                f"PageSpeed audit for {body.url} ({body.strategy}):\n"
                f"Performance: {metrics.get('performance_score')}\n"
                f"SEO: {metrics.get('seo_score')}\n"
                f"LCP: {metrics.get('largest_contentful_paint')}\n"
                f"CLS: {metrics.get('cumulative_layout_shift')}\n"
                f"TBT: {metrics.get('total_blocking_time')}\n\n"
                "Provide prioritized performance and SEO fixes."
            )
            analysis, analysis_error = await safe_analyze_with_groq(prompt)

        persisted = False
        save_error = None
        save_code = None

        if body.project_id or body.domain_id:
            row = {
                "url": body.url,
                "strategy": body.strategy,
                "result": result,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            if body.project_id:
                row["project_id"] = body.project_id
            if body.domain_id:
                row["domain_id"] = body.domain_id
            if body.page_id:
                row["page_id"] = body.page_id

            context = f"url={body.url}, domain_id={body.domain_id}"
            persisted, save_error, save_code = persist_audit_row("pagespeed_audits", row, context=context)
        else:
            logger.warning(
                "PageSpeed audit not persisted — no project_id or domain_id (url=%s)",
                body.url,
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
        status = exc.response.status_code
        logger.error(
            "PageSpeed API error url=%s status=%s",
            body.url,
            status,
            exc_info=True,
        )
        if status == 429:
            raise HTTPException(
                status_code=429,
                detail=_error_detail(
                    "PageSpeed rate limit exceeded. Set GOOGLE_PAGESPEED_API_KEY in "
                    "backend/.env (Google Cloud → PageSpeed Insights API) for ~25k "
                    "requests/day, then wait a minute and retry.",
                    "pagespeed_rate_limited",
                ),
            ) from exc
        raise HTTPException(
            status_code=502,
            detail=_error_detail(
                f"PageSpeed API error: {status}",
                "pagespeed_api_error",
            ),
        ) from exc
    except httpx.HTTPError as exc:
        logger.error("PageSpeed request failed url=%s: %s", body.url, exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=_error_detail(f"PageSpeed request failed: {exc}", "fetch_error"),
        ) from exc
    except Exception as exc:
        logger.exception("PageSpeed audit failed url=%s", body.url)
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"PageSpeed audit failed: {exc}", "audit_error"),
        ) from exc


@router.get("/history/{project_id}")
async def pagespeed_history(project_id: str) -> dict[str, Any]:
    try:
        supabase = get_supabase()
        result = (
            supabase.table("pagespeed_audits")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        rows = result.data or []
        logger.info("PageSpeed history project_id=%s count=%d", project_id, len(rows))
        return {"success": True, "data": rows}
    except RuntimeError as exc:
        logger.error("PageSpeed history config error: %s", exc)
        raise HTTPException(status_code=503, detail=_error_detail(str(exc), "config_error")) from exc
    except Exception as exc:
        logger.exception("Failed to fetch PageSpeed history project_id=%s", project_id)
        raise HTTPException(
            status_code=500,
            detail=_error_detail(f"Failed to fetch PageSpeed history: {exc}", "db_error"),
        ) from exc
