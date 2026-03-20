"""
Laps router — query and view lap data.
"""
import json
from fastapi import APIRouter, Depends, HTTPException

from api.auth import get_current_user
from api.init_db import get_connection, release_connection

router = APIRouter(prefix="/api/laps", tags=["Laps"])


def _get_user_id(cursor, supabase_user_id: str) -> int | None:
    cursor.execute(
        "SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id]
    )
    row = cursor.fetchone()
    return row[0] if row else None


@router.get("")
async def get_laps(
    user: dict = Depends(get_current_user),
    game: str | None = None,
    track: str | None = None,
    car: str | None = None,
    search: str | None = None,
):
    """List all laps for the authenticated user with optional filters."""
    supabase_user_id = user.get("id") or user.get("sub")

    conn = get_connection()
    try:
        cursor = conn.cursor()
        db_user_id = _get_user_id(cursor, supabase_user_id)
        if not db_user_id:
            return []

        query = """
            SELECT id, game, track, car, lap_number, lap_time_ms,
                   is_valid, is_public, uploaded_at
            FROM laps
            WHERE user_id = :user_id
        """
        params: dict = {"user_id": db_user_id}

        if game:
            query += " AND UPPER(game) = UPPER(:game)"
            params["game"] = game
        if track:
            query += " AND UPPER(track) LIKE '%' || UPPER(:track) || '%'"
            params["track"] = track
        if car:
            query += " AND UPPER(car) LIKE '%' || UPPER(:car) || '%'"
            params["car"] = car
        if search:
            query += " AND (UPPER(track) LIKE '%' || UPPER(:search) || '%' OR UPPER(car) LIKE '%' || UPPER(:search2) || '%')"
            params["search"] = search
            params["search2"] = search

        query += " ORDER BY uploaded_at DESC"

        cursor.execute(query, params)
        columns = [col[0].lower() for col in cursor.description]
        laps = [dict(zip(columns, row)) for row in cursor.fetchall()]
        cursor.close()
        return laps
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        release_connection(conn)


@router.get("/{lap_id}")
async def get_lap_detail(lap_id: int, user: dict = Depends(get_current_user)):
    """Get a single lap with telemetry data."""
    supabase_user_id = user.get("id") or user.get("sub")

    conn = get_connection()
    try:
        cursor = conn.cursor()
        db_user_id = _get_user_id(cursor, supabase_user_id)
        if not db_user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        cursor.execute(
            """
            SELECT l.id, l.game, l.track, l.car, l.lap_number,
                   l.lap_time_ms, l.is_valid, t.points_json
            FROM laps l
            JOIN telemetry t ON l.id = t.lap_id
            WHERE l.id = :1 AND (l.user_id = :2 OR l.is_public = 1)
            """,
            [lap_id, db_user_id],
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Lap not found")

        points_raw = row[7]
        points_str = points_raw.read() if hasattr(points_raw, "read") else points_raw

        lap_data = {
            "id": row[0],
            "game": row[1],
            "track": row[2],
            "car": row[3],
            "lap_number": row[4],
            "lap_time_ms": row[5],
            "is_valid": row[6],
            "telemetry": json.loads(points_str),
        }
        cursor.close()
        return lap_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        release_connection(conn)
