"""Shared SlowAPI rate-limiter instance — import into any router that needs limiting."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
