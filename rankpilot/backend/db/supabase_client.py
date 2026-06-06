import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_instance: Client | None = None


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return a singleton Supabase client."""
    global _instance
    if _instance is not None:
        return _instance

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment")

    _instance = create_client(url, key)
    return _instance
