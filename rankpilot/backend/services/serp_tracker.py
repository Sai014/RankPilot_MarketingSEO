import os
from typing import Any

import httpx

VALUESERP_BASE = "https://api.valueserp.com/search"


async def track_serp(
    keyword: str,
    location: str = "United States",
    google_domain: str = "google.com",
    gl: str = "us",
    hl: str = "en",
    num: int = 10,
) -> dict[str, Any]:
    """Fetch SERP results from ValueSERP API."""
    api_key = os.getenv("VALUESERP_API_KEY")
    if not api_key:
        raise RuntimeError("VALUESERP_API_KEY must be set in environment")

    params = {
        "api_key": api_key,
        "q": keyword,
        "location": location,
        "google_domain": google_domain,
        "gl": gl,
        "hl": hl,
        "num": num,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(VALUESERP_BASE, params=params)
        response.raise_for_status()
        data = response.json()

    organic = []
    for item in data.get("organic_results", []):
        organic.append(
            {
                "position": item.get("position"),
                "title": item.get("title"),
                "link": item.get("link"),
                "snippet": item.get("snippet"),
                "domain": item.get("domain"),
            }
        )

    return {
        "keyword": keyword,
        "location": location,
        "total_results": data.get("search_information", {}).get("total_results"),
        "organic_results": organic,
        "related_searches": data.get("related_searches", []),
        "raw_request_id": data.get("request_info", {}).get("id"),
    }
