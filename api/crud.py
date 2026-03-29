"""
Shared CRUD operations — eliminates query duplication across routers.
"""
import json
from typing import Optional
import oracledb


# ─── Users ───

def get_user_id(cursor, supabase_user_id: str) -> Optional[int]:
    """Look up internal user_id by Supabase user ID."""
    cursor.execute(
        "SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id]
    )
    row = cursor.fetchone()
    return row[0] if row else None


def resolve_or_create_user(
    cursor, conn, supabase_user_id: str, user_data: dict
) -> int:
    """Look up internal user_id, creating a new row on first login."""
    existing = get_user_id(cursor, supabase_user_id)
    if existing:
        return existing

    email = user_data.get("email", "")
    username = email.split("@")[0] if email else "Racer"
    avatar_url = (user_data.get("user_metadata") or {}).get("avatar_url", "")

    id_var = cursor.var(int)
    cursor.execute(
        """
        DECLARE v_id NUMBER;
        BEGIN
            INSERT INTO users (supabase_user_id, email, username, avatar_url)
            VALUES (:1, :2, :3, :4)
            RETURNING id INTO v_id;
            :5 := v_id;
        END;
        """,
        [supabase_user_id, email, username, avatar_url, id_var],
    )
    conn.commit()
    return id_var.getvalue()


def require_user_id(cursor, supabase_user_id: str) -> int:
    """Get user_id or raise."""
    uid = get_user_id(cursor, supabase_user_id)
    if uid is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="User not found")
    return uid


# ─── Laps & Telemetry ───

def get_lap_with_telemetry(
    cursor, lap_id: int, user_id: Optional[int] = None
) -> Optional[dict]:
    """
    Fetch lap + telemetry. If user_id is provided, checks ownership or public flag.
    If user_id is None, fetches without ownership check (for share codes).
    """
    if user_id is not None:
        cursor.execute(
            """
            SELECT l.id, l.game, l.track, l.car, l.lap_number,
                   l.lap_time_ms, l.is_valid, l.is_public, t.points_json
            FROM laps l
            JOIN telemetry t ON l.id = t.lap_id
            WHERE l.id = :1 AND (l.user_id = :2 OR l.is_public = 1)
            """,
            [lap_id, user_id],
        )
    else:
        cursor.execute(
            """
            SELECT l.id, l.game, l.track, l.car, l.lap_number,
                   l.lap_time_ms, l.is_valid, l.is_public, t.points_json
            FROM laps l
            JOIN telemetry t ON l.id = t.lap_id
            WHERE l.id = :1
            """,
            [lap_id],
        )

    row = cursor.fetchone()
    if not row:
        return None

    points_raw = row[8]
    points_str = points_raw.read() if hasattr(points_raw, "read") else points_raw

    return {
        "id": row[0],
        "game": row[1],
        "track": row[2],
        "car": row[3],
        "lap_number": row[4],
        "lap_time_ms": row[5],
        "is_valid": row[6],
        "is_public": row[7],
        "telemetry": json.loads(points_str),
    }
