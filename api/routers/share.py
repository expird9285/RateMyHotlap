"""
Share codes router — create and look up public comparison links.
"""
import json
import secrets
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import get_current_user
from api.init_db import get_connection, release_connection

router = APIRouter(prefix="/api/share", tags=["Share"])


class ShareRequest(BaseModel):
    lap_id_a: int
    lap_id_b: int
    expires_days: int = 30


def _generate_code(length: int = 8) -> str:
    """Generate a random alphanumeric share code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


@router.post("")
async def create_share_code(
    body: ShareRequest,
    user: dict = Depends(get_current_user),
):
    """Create a share code for comparing two laps."""
    supabase_user_id = user.get("id") or user.get("sub")

    conn = get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id]
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=403, detail="User not found")
        db_user_id = row[0]

        # Verify both laps belong to user
        for lap_id in [body.lap_id_a, body.lap_id_b]:
            cursor.execute(
                "SELECT id FROM laps WHERE id = :1 AND user_id = :2",
                [lap_id, db_user_id],
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404, detail=f"Lap {lap_id} not found or not owned"
                )

        code = _generate_code()
        expires_at = datetime.utcnow() + timedelta(days=body.expires_days)

        cursor.execute(
            """
            INSERT INTO share_codes (code, lap_id_a, lap_id_b, created_by, expires_at)
            VALUES (:1, :2, :3, :4, :5)
            """,
            [code, body.lap_id_a, body.lap_id_b, db_user_id, expires_at],
        )
        conn.commit()
        cursor.close()

        return {
            "code": code,
            "expires_at": expires_at.isoformat(),
            "url": f"/share/{code}",
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create share: {str(e)}")
    finally:
        release_connection(conn)


@router.get("/{code}")
async def get_shared_comparison(code: str):
    """
    Look up a share code — NO authentication required.
    Returns both laps' telemetry for comparison.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT code, lap_id_a, lap_id_b, expires_at, view_count
            FROM share_codes
            WHERE code = :1
            """,
            [code],
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Share code not found")

        _, lap_id_a, lap_id_b, expires_at, view_count = row

        if expires_at and expires_at < datetime.utcnow():
            raise HTTPException(status_code=410, detail="Share code has expired")

        # Increment view count
        cursor.execute(
            "UPDATE share_codes SET view_count = view_count + 1 WHERE code = :1",
            [code],
        )
        conn.commit()

        # Fetch both laps (no user check — shared is public)
        def _get_lap(lap_id):
            cursor.execute(
                """
                SELECT l.id, l.game, l.track, l.car, l.lap_number,
                       l.lap_time_ms, l.is_valid, t.points_json
                FROM laps l
                JOIN telemetry t ON l.id = t.lap_id
                WHERE l.id = :1
                """,
                [lap_id],
            )
            r = cursor.fetchone()
            if not r:
                return None
            pts_raw = r[7]
            pts = pts_raw.read() if hasattr(pts_raw, "read") else pts_raw
            return {
                "id": r[0], "game": r[1], "track": r[2], "car": r[3],
                "lap_number": r[4], "lap_time_ms": r[5], "is_valid": r[6],
                "telemetry": json.loads(pts),
            }

        lap_a = _get_lap(lap_id_a)
        lap_b = _get_lap(lap_id_b)

        cursor.close()

        return {
            "code": code,
            "view_count": (view_count or 0) + 1,
            "lap_a": lap_a,
            "lap_b": lap_b,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Share lookup error: {str(e)}")
    finally:
        release_connection(conn)
