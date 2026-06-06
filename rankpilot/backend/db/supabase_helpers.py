from typing import Any


def response_data(response: Any) -> Any:
    """Safely read .data from a Supabase execute() result (maybe_single may return None)."""
    if response is None:
        return None
    return getattr(response, "data", None)


def first_row(response: Any) -> dict | None:
    """First row from select/maybe_single response."""
    data = response_data(response)
    if data is None:
        return None
    if isinstance(data, dict):
        return data
    if isinstance(data, list):
        return data[0] if data else None
    return None


def all_rows(response: Any) -> list:
    """All rows from a select response."""
    data = response_data(response)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []
