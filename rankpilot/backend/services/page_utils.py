from typing import Any


def keyword_from_path(path: str | None) -> str:
    """Derive a target keyword from the URL path slug (hyphens → spaces)."""
    if not path or path == "/":
        return "home"

    slug = path.strip("/").split("/")[-1]
    if not slug:
        return "home"

    return slug.replace("-", " ").replace("_", " ").strip()


def format_countries(countries: Any) -> str | None:
    """Format target_countries JSON for display."""
    if not countries:
        return None
    if isinstance(countries, list):
        cleaned = [str(c).strip() for c in countries if c]
        return ", ".join(cleaned) if cleaned else None
    return str(countries).strip() or None


def resolve_page_countries(page: dict[str, Any], domain: dict[str, Any]) -> str | None:
    """Page-level countries override domain defaults when set."""
    page_countries = format_countries(page.get("target_countries"))
    if page_countries:
        return page_countries
    return format_countries(domain.get("target_countries"))
