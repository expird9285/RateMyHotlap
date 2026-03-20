"""
Supabase JWT authentication middleware.
"""
import requests
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from api.config import get_settings

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    Verify Supabase JWT by calling Supabase Auth API.
    Returns the user dict from Supabase on success.
    """
    settings = get_settings()
    token = credentials.credentials

    headers = {
        "apikey": settings.supabase_key,
        "Authorization": f"Bearer {token}",
    }
    response = requests.get(
        f"{settings.supabase_url}/auth/v1/user", headers=headers, timeout=10
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=401, detail="Invalid authentication credentials"
        )

    return response.json()
