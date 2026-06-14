"""Composite health scores from audit sub-scores."""

from typing import Any


def score_onpage(data: dict[str, Any]) -> int:
    """Score 0–100 from on-page HTML signals."""
    score = 100

    title_len = data.get("title_length") or 0
    if not data.get("title"):
        score -= 30
    elif title_len < 30 or title_len > 60:
        score -= 10

    meta_len = data.get("meta_description_length") or 0
    if not data.get("meta_description"):
        score -= 20
    elif meta_len < 120 or meta_len > 160:
        score -= 5

    h1_count = len(data.get("h1_tags") or [])
    if h1_count == 0:
        score -= 15
    elif h1_count > 1:
        score -= 10

    images_without_alt = data.get("images_without_alt") or 0
    if images_without_alt > 0:
        score -= min(15, images_without_alt * 3)

    if (data.get("word_count") or 0) < 300:
        score -= 10

    if not data.get("has_schema_markup"):
        score -= 5

    if not data.get("canonical"):
        score -= 5

    return max(0, min(100, score))


def compute_health_score(
    *,
    performance: float | None = None,
    seo: float | None = None,
    accessibility: float | None = None,
    onpage: float | None = None,
    security: float | None = None,
) -> int | None:
    """
    Weighted page health score (0–100).
    Defaults: 30% performance, 25% SEO, 20% on-page, 15% accessibility, 10% security.
    Missing components are excluded and weights re-normalized.
    """
    components: list[tuple[float, float]] = []

    if performance is not None:
        components.append((performance * 100 if performance <= 1 else performance, 0.30))
    if seo is not None:
        components.append((seo * 100 if seo <= 1 else seo, 0.25))
    if onpage is not None:
        components.append((onpage, 0.20))
    if accessibility is not None:
        components.append((accessibility * 100 if accessibility <= 1 else accessibility, 0.15))
    if security is not None:
        components.append((security, 0.10))

    if not components:
        return None

    total_weight = sum(w for _, w in components)
    weighted = sum(v * (w / total_weight) for v, w in components)
    return round(max(0, min(100, weighted)))
