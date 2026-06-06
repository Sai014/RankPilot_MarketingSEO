import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from logging_config import setup_logging
from middleware.request_logging import RequestLoggingMiddleware
from routers import competitors, dashboard, domains, pages, pagespeed, profile, projects, serp, sitemap

load_dotenv()
setup_logging()

logger = logging.getLogger("rankpilot")


def _get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("RankPilot API starting")
    yield
    logger.info("RankPilot API shutting down")


app = FastAPI(
    title="RankPilot API",
    description="Free SEO intelligence platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(projects.router)
app.include_router(domains.router)
app.include_router(pages.router)
app.include_router(dashboard.router)
app.include_router(sitemap.router)
app.include_router(serp.router)
app.include_router(pagespeed.router)
app.include_router(competitors.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": str(exc),
            "code": "internal_error",
        },
    )


@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "success": True,
        "data": {
            "name": "RankPilot API",
            "version": "1.0.0",
            "status": "healthy",
        },
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"success": True, "data": {"status": "ok"}}
