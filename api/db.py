"""
Database dependency injection for FastAPI.
Provides a clean context-managed connection pattern via Depends().
"""
from typing import Generator
import oracledb
from api.init_db import get_connection, release_connection


def get_db() -> Generator[oracledb.Connection, None, None]:
    """
    FastAPI dependency that yields a DB connection from the pool.
    Automatically releases the connection when the request completes.

    Usage:
        @router.get("/example")
        async def example(conn=Depends(get_db)):
            cursor = conn.cursor()
            ...
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        release_connection(conn)
