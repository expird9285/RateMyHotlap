import json
from fastapi import APIRouter, Depends, HTTPException
from ..auth import get_current_user
from ..init_db import get_connection

router = APIRouter(prefix="/api/laps", tags=["Laps"])

@router.get("")
async def get_laps(user: dict = Depends(get_current_user)):
    supabase_user_id = user.get("sub")
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get internal user id
        cursor.execute("SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id])
        row = cursor.fetchone()
        if not row:
            return []
        db_user_id = row[0]
        
        cursor.execute("""
            SELECT id, game, track, car, lap_number, lap_time_ms, is_valid, is_public, uploaded_at
            FROM laps
            WHERE user_id = :1
            ORDER BY uploaded_at DESC
        """, [db_user_id])
        
        columns = [col[0].lower() for col in cursor.description]
        laps = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        return laps
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/{lap_id}")
async def get_lap_detail(lap_id: int, user: dict = Depends(get_current_user)):
    # Note: Access control to confirm the lap belongs to the user or is public
    supabase_user_id = user.get("sub")
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id])
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=403, detail="Not authorized")
        db_user_id = row[0]
        
        cursor.execute("""
            SELECT l.game, l.track, l.car, l.lap_time_ms, t.points_json
            FROM laps l
            JOIN telemetry t ON l.id = t.lap_id
            WHERE l.id = :1 AND (l.user_id = :2 OR l.is_public = 1)
        """, [lap_id, db_user_id])
        
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Lap not found")
            
        lap_data = {
            "game": row[0],
            "track": row[1],
            "car": row[2],
            "lap_time_ms": row[3],
            "telemetry": json.loads(row[4].read() if hasattr(row[4], 'read') else row[4])
        }
        
        cursor.close()
        conn.close()
        return lap_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
