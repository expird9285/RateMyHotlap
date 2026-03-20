"""
Router for querying import job status.
"""
import json
from fastapi import APIRouter, Depends, HTTPException

from api.auth import get_current_user
from api.init_db import get_connection, release_connection

router = APIRouter(prefix="/api/upload", tags=["Import Jobs"])


@router.get("/{job_id}")
async def get_import_job_status(job_id: int, user: dict = Depends(get_current_user)):
    """Get the status of an import job."""
    supabase_user_id = user.get("id") or user.get("sub")

    conn = get_connection()
    try:
        cursor = conn.cursor()

        # Resolve internal user id
        cursor.execute(
            "SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id]
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=403, detail="User not found")
        db_user_id = row[0]

        # Fetch job  (must belong to user)
        cursor.execute(
            """
            SELECT id, user_id, raw_file_id, game, status,
                   total_laps, imported_laps, failed_laps,
                   warnings_json, created_at, finished_at
            FROM import_jobs
            WHERE id = :1 AND user_id = :2
            """,
            [job_id, db_user_id],
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Import job not found")

        columns = [col[0].lower() for col in cursor.description]
        job = dict(zip(columns, row))

        # Parse warnings JSON
        if job.get("warnings_json"):
            raw = job["warnings_json"]
            job["warnings"] = json.loads(raw.read() if hasattr(raw, "read") else raw)
        else:
            job["warnings"] = []
        job.pop("warnings_json", None)

        cursor.close()
        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        release_connection(conn)
