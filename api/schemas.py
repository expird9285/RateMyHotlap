"""
Pydantic models for API request/response schemas and internal data structures.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


# ─── User ───

class UserOut(BaseModel):
    id: int
    supabase_user_id: str
    email: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None


# ─── Upload / Import ───

class UploadResponse(BaseModel):
    message: str
    job_id: int
    raw_file_id: int
    object_key: str


class ImportJobOut(BaseModel):
    id: int
    user_id: int
    raw_file_id: int
    game: str
    status: str
    total_laps: Optional[int] = None
    imported_laps: Optional[int] = None
    failed_laps: Optional[int] = None
    warnings: Optional[List[str]] = None
    created_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


# ─── Laps ───

class LapOut(BaseModel):
    id: int
    game: str
    track: Optional[str] = None
    car: Optional[str] = None
    lap_number: Optional[int] = None
    lap_time_ms: Optional[int] = None
    is_valid: Optional[int] = 1
    is_public: Optional[int] = 0
    uploaded_at: Optional[datetime] = None


class LapDetailOut(BaseModel):
    game: str
    track: Optional[str] = None
    car: Optional[str] = None
    lap_time_ms: Optional[int] = None
    telemetry: Dict[str, Any] = {}


# ─── NormalizedLap (internal) ───

class NormalizedLapMeta(BaseModel):
    game: str
    track: str = "Unknown"
    car: str = "Unknown"
    lap_number: Optional[int] = None
    lap_time_ms: Optional[int] = None
    is_valid: bool = True
    sample_rate_hz: int = 100


class NormalizedLapSource(BaseModel):
    format: str  # "ld" | "duckdb"
    raw_file_id: Optional[int] = None
    missing_channels: List[str] = []
    import_warnings: List[str] = []


class NormalizedLap(BaseModel):
    """
    The universal internal format. All importers output this structure.
    Frontend, compare logic, and AI analysis all consume this.
    """
    meta: NormalizedLapMeta
    channels: Dict[str, List[float]] = {}
    source: NormalizedLapSource
