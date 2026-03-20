import os
import requests
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# In production, we should decode the JWT using the secret. For Supabase, the secret is either provided in env
# or we can fetch JWKS. To keep it secure and simple, we verify it using PyJWT if the secret is known.
# If SUPABASE_JWT_SECRET is not available, we can rely on verifying via Supabase API, but local verification is faster.
# Alternatively, Supabase REST API `GET /auth/v1/user` could be used.

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    # Method 1: Ask Supabase to verify the token
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}"
    }
    response = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)
    
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_data = response.json()
    return user_data
