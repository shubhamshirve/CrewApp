"""
Simple async-safe TTL cache for platform config values that rarely change.
Usage:
    from cache import get_cached, invalidate_cache

    value = await get_cached("event_types", loader_coro, ttl=300)
    invalidate_cache("event_types")   # call after admin updates
"""
import asyncio
import time
import logging
from typing import Any, Callable, Awaitable, Optional

logger = logging.getLogger(__name__)

_store: dict[str, tuple[float, Any]] = {}  # key -> (expires_at, value)
_locks: dict[str, asyncio.Lock] = {}


def _get_lock(key: str) -> asyncio.Lock:
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


async def get_cached(
    key: str,
    loader: Callable[[], Awaitable[Any]],
    ttl: int = 300,
) -> Any:
    """Return cached value or call loader() to refresh.  Thread/task-safe via per-key lock."""
    now = time.monotonic()
    entry = _store.get(key)
    if entry and entry[0] > now:
        return entry[1]

    async with _get_lock(key):
        # Re-check after acquiring lock (another task may have just refreshed)
        entry = _store.get(key)
        if entry and entry[0] > now:
            return entry[1]

        try:
            value = await loader()
            _store[key] = (now + ttl, value)
            return value
        except Exception as exc:
            logger.error("Cache loader failed for key '%s': %s", key, exc)
            # Return stale value if available, else re-raise
            if entry:
                logger.warning("Returning stale cached value for key '%s'", key)
                return entry[1]
            raise


def invalidate_cache(*keys: str) -> None:
    """Remove one or more keys so the next request re-fetches from DB."""
    for key in keys:
        _store.pop(key, None)
