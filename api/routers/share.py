"""
Share router — create and retrieve public shared comparisons.
"""
import json
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import oracledb

from api.auth import get_current_user
from api.db import get_db
from api.crud import require_user_id, get_lap_with_telemetry

router = APIRouter(prefix="/share", tags=["share"])


class ShareRequest(BaseModel):
    lap_a_id: int
    lap_b_id: int


@router.post("")
async def create_share(
    body: ShareRequest,
    user: dict = Depends(get_current_user),
    conn: oracledb.Connection = Depends(get_db),
):
    """Create a public share code for a lap comparison."""
    cursor = conn.cursor()
    user_id = require_user_id(cursor, user.get("id", ""))

    # Verify both laps exist and belong to user
    data_a = get_lap_with_telemetry(cursor, body.lap_a_id, user_id)
    data_b = get_lap_with_telemetry(cursor, body.lap_b_id, user_id)

    if not data_a or not data_b:
        cursor.close()
        raise HTTPException(status_code=404, detail="One or both laps not found")

    # Check for existing share
    cursor.execute(
        """
        SELECT share_code FROM shared_comparisons
        WHERE user_id = :1 AND lap_a_id = :2 AND lap_b_id = :3
        """,
        [user_id, body.lap_a_id, body.lap_b_id],
    )
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        return {"share_code": existing[0]}

    # Create new share code
    code = secrets.token_urlsafe(8)
    cursor.execute(
        """
        INSERT INTO shared_comparisons
            (share_code, user_id, lap_a_id, lap_b_id, created_at)
        VALUES (:1, :2, :3, :4, :5)
        """,
        [code, user_id, body.lap_a_id, body.lap_b_id, datetime.utcnow()],
    )
    conn.commit()
    cursor.close()

    return {"share_code": code}


@router.get("/{share_code}")
async def get_shared_comparison(
    share_code: str,
    conn: oracledb.Connection = Depends(get_db),
):
    """Retrieve a shared comparison (no auth required)."""
    cursor = conn.cursor()

    cursor.execute(
        "SELECT lap_a_id, lap_b_id FROM shared_comparisons WHERE share_code = :1",
        [share_code],
    )
    row = cursor.fetchone()
    if not row:
        cursor.close()
        raise HTTPException(status_code=404, detail="Share code not found")

    lap_a_id, lap_b_id = row
    data_a = get_lap_with_telemetry(cursor, lap_a_id)
    data_b = get_lap_with_telemetry(cursor, lap_b_id)
    cursor.close()

    if not data_a or not data_b:
        raise HTTPException(status_code=404, detail="Shared laps no longer available")

    return {
        "lap_a": data_a,
        "lap_b": data_b,
    }
