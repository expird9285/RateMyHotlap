"""
Compare router — compare two laps side by side.
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query

from api.auth import get_current_user
from api.init_db import get_connection, release_connection

router = APIRouter(prefix="/api/compare", tags=["Compare"])


def _read_lap(cursor, lap_id: int, db_user_id: int) -> dict | None:
    """Fetch lap + telemetry, checking ownership or public flag."""
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
        return None

    points_raw = row[7]
    points_str = points_raw.read() if hasattr(points_raw, "read") else points_raw

    return {
        "id": row[0],
        "game": row[1],
        "track": row[2],
        "car": row[3],
        "lap_number": row[4],
        "lap_time_ms": row[5],
        "is_valid": row[6],
        "telemetry": json.loads(points_str),
    }


@router.get("")
async def compare_laps(
    a: int = Query(..., description="First lap ID"),
    b: int = Query(..., description="Second lap ID"),
    user: dict = Depends(get_current_user),
):
    """Compare two laps — returns both telemetry datasets + delta."""
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

        lap_a = _read_lap(cursor, a, db_user_id)
        if not lap_a:
            raise HTTPException(status_code=404, detail=f"Lap {a} not found")

        lap_b = _read_lap(cursor, b, db_user_id)
        if not lap_b:
            raise HTTPException(status_code=404, detail=f"Lap {b} not found")

        # Calculate delta time (time difference along spline/distance)
        delta = _compute_delta(lap_a, lap_b)

        cursor.close()
        return {
            "lap_a": lap_a,
            "lap_b": lap_b,
            "delta": delta,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")
    finally:
        release_connection(conn)


def _compute_delta(lap_a: dict, lap_b: dict) -> dict:
    """
    Compute the time delta between two laps.
    Uses time_ms channels aligned by index (simplistic approach).
    A negative delta means lap_b is faster at that point.
    """
    time_a = lap_a["telemetry"].get("time_ms", [])
    time_b = lap_b["telemetry"].get("time_ms", [])
    speed_a = lap_a["telemetry"].get("speed", [])
    speed_b = lap_b["telemetry"].get("speed", [])

    if not time_a or not time_b:
        return {"time_ms": [], "delta_ms": [], "summary": "No time data available"}

    # Simple delta: difference in elapsed time at each normalized position
    min_len = min(len(time_a), len(time_b))

    # Resample to common length using linear interpolation
    import numpy as np

    if len(time_a) != len(time_b):
        common_len = min(len(time_a), len(time_b), 1000)
        idx_a = np.linspace(0, len(time_a) - 1, common_len).astype(int)
        idx_b = np.linspace(0, len(time_b) - 1, common_len).astype(int)
        time_a_r = [time_a[i] for i in idx_a]
        time_b_r = [time_b[i] for i in idx_b]
    else:
        time_a_r = time_a
        time_b_r = time_b
        common_len = len(time_a)

    # Delta = cumulative time difference (positive = A slower)
    delta_ms = []
    for i in range(len(time_a_r)):
        delta_ms.append(round(time_a_r[i] - time_b_r[i], 1))

    # Generate position axis (0..1)
    positions = [round(i / max(len(delta_ms) - 1, 1), 4) for i in range(len(delta_ms))]

    lap_time_diff = (lap_a.get("lap_time_ms") or 0) - (lap_b.get("lap_time_ms") or 0)

    return {
        "positions": positions,
        "delta_ms": delta_ms,
        "lap_time_diff_ms": lap_time_diff,
        "summary": f"Lap A is {'slower' if lap_time_diff > 0 else 'faster'} by {abs(lap_time_diff)}ms",
    }
