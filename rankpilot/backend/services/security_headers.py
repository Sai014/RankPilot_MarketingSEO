import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "RankPilot/1.0 (+https://rankpilot.app)"

# (header name, weight, label)
SECURITY_HEADERS: list[tuple[str, int, str]] = [
    ("strict-transport-security", 20, "Strict-Transport-Security"),
    ("content-security-policy", 25, "Content-Security-Policy"),
    ("x-frame-options", 15, "X-Frame-Options"),
    ("x-content-type-options", 15, "X-Content-Type-Options"),
    ("referrer-policy", 15, "Referrer-Policy"),
    ("permissions-policy", 10, "Permissions-Policy"),
]


def _normalize_headers(headers: httpx.Headers) -> dict[str, str]:
    return {k.lower(): v for k, v in headers.items()}


def score_security_headers(headers: dict[str, str]) -> tuple[int, list[dict[str, Any]]]:
    """Score 0–100 based on presence of recommended security headers."""
    checks: list[dict[str, Any]] = []
    score = 0

    for header_name, weight, label in SECURITY_HEADERS:
        value = headers.get(header_name)
        present = bool(value and value.strip())
        if present:
            score += weight
        checks.append(
            {
                "header": label,
                "present": present,
                "value": value[:200] if value else None,
                "weight": weight,
            }
        )

    return score, checks


async def run_security_headers_audit(url: str) -> dict[str, Any]:
    """Fetch response headers via httpx and score security posture."""
    if not re.match(r"^https?://", url):
        url = f"https://{url}"

    async with httpx.AsyncClient(
        timeout=30.0,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        final_url = str(response.url)
        raw_headers = _normalize_headers(response.headers)

    score, checks = score_security_headers(raw_headers)
    missing = [c["header"] for c in checks if not c["present"]]

    logger.info("Security headers audit url=%s score=%d missing=%d", final_url, score, len(missing))

    return {
        "url": final_url,
        "score": score,
        "status_code": response.status_code,
        "checks": checks,
        "missing": missing,
        "headers": {c["header"]: c["value"] for c in checks if c["present"]},
    }
