import logging
from typing import Any

from db.errors import format_db_error
from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def persist_audit_row(table: str, row: dict[str, Any], *, context: str) -> tuple[bool, str | None, str | None]:
    """
    Insert an audit row into Supabase.

    Returns (success, error_message, error_code).
    """
    try:
        supabase = get_supabase()
        supabase.table(table).insert(row).execute()
        logger.info("Saved %s row (%s)", table, context)
        return True, None, None
    except Exception as exc:
        message, code = format_db_error(exc)
        logger.error(
            "Failed to save %s (%s): %s [%s]",
            table,
            context,
            message,
            code,
            exc_info=True,
        )
        return False, message, code
