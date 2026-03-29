"""
Compare router — compare two laps and compute delta time.
"""
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
import oracledb

from api.auth import get_current_user
from api.db import get_db
from api.crud import require_user_id, get_lap_with_telemetry

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("")
async def compare_laps(
    lap_a: int = Query(...),
    lap_b: int = Query(...),
    user: dict = Depends(get_current_user),
    conn: oracledb.Connection = Depends(get_db),
):
    """Compare two laps and return overlay + delta time data."""
    if lap_a == lap_b:
        raise HTTPException(status_code=400, detail="Cannot compare a lap with itself")

    cursor = conn.cursor()
    user_id = require_user_id(cursor, user.get("id", ""))

    data_a = get_lap_with_telemetry(cursor, lap_a, user_id)
    data_b = get_lap_with_telemetry(cursor, lap_b, user_id)
    cursor.close()

    if not data_a:
        raise HTTPException(status_code=404, detail=f"Lap {lap_a} not found")
    if not data_b:
        raise HTTPException(status_code=404, detail=f"Lap {lap_b} not found")

    # ── Compute delta time ──
    delta = _compute_delta(data_a["telemetry"], data_b["telemetry"])

    return {
        "lap_a": {k: v for k, v in data_a.items() if k != "telemetry"},
        "lap_b": {k: v for k, v in data_b.items() if k != "telemetry"},
        "telemetry_a": data_a["telemetry"],
        "telemetry_b": data_b["telemetry"],
        "delta_time": delta,
    }


def _compute_delta(telem_a: dict, telem_b: dict) -> list:
    """
    Compute cumulative time delta (A − B) per normalised distance.
    Positive = B is faster; Negative = A is faster.
    """
    try:
        time_a = np.array(telem_a.get("time_ms", []), dtype=np.float64)
        time_b = np.array(telem_b.get("time_ms", []), dtype=np.float64)

        if len(time_a) == 0 or len(time_b) == 0:
            return []

        # Normalise to common length via interpolation
        n = min(len(time_a), len(time_b))
        norm_dist = np.linspace(0, 1, n)
        interp_a = np.interp(norm_dist, np.linspace(0, 1, len(time_a)), time_a)
        interp_b = np.interp(norm_dist, np.linspace(0, 1, len(time_b)), time_b)

        delta_ms = interp_a - interp_b
        return [round(float(d), 1) for d in delta_ms]
    except Exception:
        return []
