import logging
import os
from typing import Any

from groq import AsyncGroq

logger = logging.getLogger(__name__)

# llama-3-70b-8192 was retired; see https://console.groq.com/docs/models
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY must be set in environment")
        _client = AsyncGroq(api_key=api_key)
    return _client


async def analyze_with_groq(
    prompt: str,
    system: str = "You are an expert SEO analyst. Provide concise, actionable insights.",
    max_tokens: int = 2048,
) -> dict[str, Any]:
    """Send a prompt to Groq and return structured response."""
    client = _get_client()

    completion = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
    )

    content = completion.choices[0].message.content or ""
    return {
        "analysis": content,
        "model": GROQ_MODEL,
        "usage": {
            "prompt_tokens": completion.usage.prompt_tokens if completion.usage else None,
            "completion_tokens": completion.usage.completion_tokens if completion.usage else None,
        },
    }


async def safe_analyze_with_groq(
    prompt: str,
    system: str = "You are an expert SEO analyst. Provide concise, actionable insights.",
    max_tokens: int = 2048,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Run Groq analysis without raising — SERP/PageSpeed should succeed even if AI fails.
    Returns (analysis_dict, error_message).
    """
    try:
        return await analyze_with_groq(prompt, system=system, max_tokens=max_tokens), None
    except Exception as exc:
        logger.warning("Groq analysis failed (model=%s): %s", GROQ_MODEL, exc)
        return None, str(exc)
