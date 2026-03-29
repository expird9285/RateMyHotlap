"""
Supabase JWT authentication — async via httpx.
"""
import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from api.config import get_settings

security = HTTPBearer()

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=10.0)
    return _http_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    Verify Supabase JWT by calling Supabase Auth API (async).
    Returns the user dict from Supabase on success.
    """
    settings = get_settings()
    token = credentials.credentials

    client = _get_http_client()
    response = await client.get(
        f"{settings.supabase_url}/auth/v1/user",
        headers={
            "apikey": settings.supabase_key,
            "Authorization": f"Bearer {token}",
        },
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=401, detail="Invalid authentication credentials"
        )

    return response.json()
