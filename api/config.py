"""
Centralized configuration using pydantic-settings.
All environment variables are loaded and validated here.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings

# Ensure .env in api/ directory is found regardless of working directory
_env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str = ""  # Optional, for local JWT verification

    # Oracle Cloud Autonomous Database
    db_user: str
    db_password: str
    db_dsn: str
    wallet_location: str

    # Oracle Cloud Object Storage
    oci_namespace: str
    oci_access_key: str
    oci_secret_key: str
    oci_bucket_name: str = "telemetries_backups"
    oci_region: str = "ap-northeast-2"

    # Server
    cors_origins: str = "http://localhost:3000"

    model_config = {
        "env_file": _env_file,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
