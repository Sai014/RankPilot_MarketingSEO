import re
from typing import Any


def format_db_error(exc: Exception) -> tuple[str, str]:
    """Return (message, code) for Supabase/PostgREST errors."""
    text = str(exc)

    if "PGRST205" in text or "Could not find the table" in text:
        table_match = re.search(r"'public\.(\w+)'", text)
        table = table_match.group(1) if table_match else "domains"
        return (
            f"Database table '{table}' does not exist. "
            "Run backend/db/schema_v2.sql in Supabase → SQL Editor, then retry.",
            "schema_missing",
        )

    if "Invalid API key" in text or "JWT" in text:
        return (
            "Invalid Supabase credentials. Check SUPABASE_URL and SUPABASE_KEY in backend/.env",
            "config_error",
        )

    return (text, "db_error")
