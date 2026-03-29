"""
Laps router — list & retrieve lap details with telemetry.
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query
import oracledb

from api.auth import get_current_user
from api.db import get_db
from api.crud import require_user_id, get_lap_with_telemetry

router = APIRouter(prefix="/laps", tags=["laps"])


@router.get("")
async def list_laps(
    game: str = Query(None),
    track: str = Query(None),
    car: str = Query(None),
    user: dict = Depends(get_current_user),
    conn: oracledb.Connection = Depends(get_db),
):
    """List all laps for the current user, with optional filters."""
    cursor = conn.cursor()
    user_id = require_user_id(cursor, user.get("id", ""))

    query = """
        SELECT id, game, track, car, lap_number, lap_time_ms,
               is_valid, is_public, recorded_at
        FROM laps
        WHERE user_id = :u_id
    """
    params: dict = {"u_id": user_id}

    if game:
        query += " AND game = :game"
        params["game"] = game
    if track:
        query += " AND track = :track"
        params["track"] = track
    if car:
        query += " AND car = :car"
        params["car"] = car

    query += " ORDER BY recorded_at DESC NULLS LAST"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()

    return [
        {
            "id": r[0],
            "game": r[1],
            "track": r[2],
            "car": r[3],
            "lap_number": r[4],
            "lap_time_ms": r[5],
            "is_valid": r[6],
            "is_public": r[7],
            "recorded_at": r[8].isoformat() if r[8] else None,
        }
        for r in rows
    ]


@router.get("/{lap_id}")
async def get_lap_detail(
    lap_id: int,
    user: dict = Depends(get_current_user),
    conn: oracledb.Connection = Depends(get_db),
):
    """Get detailed lap data with telemetry channels."""
    cursor = conn.cursor()
    user_id = require_user_id(cursor, user.get("id", ""))
    lap = get_lap_with_telemetry(cursor, lap_id, user_id)
    cursor.close()

    if not lap:
        raise HTTPException(status_code=404, detail="Lap not found")

    return lap


@router.patch("/{lap_id}/visibility")
async def toggle_visibility(
    lap_id: int,
    user: dict = Depends(get_current_user),
    conn: oracledb.Connection = Depends(get_db),
):
    """Toggle the is_public flag of a lap."""
    cursor = conn.cursor()
    user_id = require_user_id(cursor, user.get("id", ""))

    cursor.execute(
        """
        UPDATE laps
        SET is_public = CASE WHEN is_public = 1 THEN 0 ELSE 1 END
        WHERE id = :lid AND user_id = :u_id
        """,
        {"lid": lap_id, "u_id": user_id},
    )
    if cursor.rowcount == 0:
        cursor.close()
        raise HTTPException(status_code=404, detail="Lap not found")

    conn.commit()
    cursor.close()
    return {"message": "Visibility toggled"}
