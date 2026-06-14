"""
Run long-running jobs in background threads.

FastAPI BackgroundTasks await async callables on the main event loop. Our pipeline
uses synchronous Supabase client calls, which would block all API requests. These
sync entrypoints run in Starlette's thread pool instead.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


def run_onboarding_job(
    domain_id: str,
    domain: str,
    max_pages: int,
    user_id: str,
    auto_serp: bool,
    display_name: str | None = None,
    target_countries: list[str] | None = None,
    sync_gsc: bool = False,
) -> None:
    from services.domain_onboarding import run_full_onboarding_pipeline

    logger.info("Background onboarding start domain_id=%s domain=%s", domain_id, domain)
    try:
        asyncio.run(
            run_full_onboarding_pipeline(
                domain_id,
                domain,
                max_pages,
                user_id,
                auto_serp,
                display_name,
                target_countries,
                sync_gsc,
            )
        )
    except Exception:
        logger.exception("Background onboarding failed domain_id=%s", domain_id)
    else:
        logger.info("Background onboarding complete domain_id=%s", domain_id)


def run_gsc_sync_job(domain_id: str, user_id: str) -> None:
    from services.gsc_sync import sync_domain_gsc_metrics

    logger.info("Background GSC sync start domain_id=%s", domain_id)
    try:
        asyncio.run(sync_domain_gsc_metrics(domain_id, user_id))
    except Exception:
        logger.exception("Background GSC sync failed domain_id=%s", domain_id)
    else:
        logger.info("Background GSC sync complete domain_id=%s", domain_id)


def run_serp_sync_job(domain_id: str) -> None:
    from services.serp_batch import track_domain_pages

    logger.info("Background SERP sync start domain_id=%s", domain_id)
    try:
        summary = asyncio.run(track_domain_pages(domain_id))
        logger.info("Background SERP sync complete domain_id=%s %s", domain_id, summary)
    except Exception:
        logger.exception("Background SERP sync failed domain_id=%s", domain_id)
