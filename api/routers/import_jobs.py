"""
Import jobs router — check import progress.
"""
from fastapi import APIRouter, Depends, HTTPException
import oracledb

from api.auth import get_current_user
from api.db import get_db
from api.crud import require_user_id

router = APIRouter(prefix="/import-jobs", tags=["import-jobs"])


@router.get("/{job_id}")
async def get_import_job(
    job_id: int,
    user: dict = Depends(get_current_user),
    conn: oracledb.Connection = Depends(get_db),
):
    """Get the status and result of an import job."""
    cursor = conn.cursor()
    user_id = require_user_id(cursor, user.get("id", ""))

    cursor.execute(
        """
        SELECT id, status, total_laps, imported_laps, failed_laps,
               warnings_json, created_at, finished_at
        FROM import_jobs
        WHERE id = :1 AND user_id = :2
        """,
        [job_id, user_id],
    )
    row = cursor.fetchone()
    cursor.close()

    if not row:
        raise HTTPException(status_code=404, detail="Import job not found")

    import json

    warnings_raw = row[5]
    warnings_str = (
        warnings_raw.read() if hasattr(warnings_raw, "read") else warnings_raw
    )

    return {
        "id": row[0],
        "status": row[1],
        "total_laps": row[2],
        "imported_laps": row[3],
        "failed_laps": row[4],
        "warnings": json.loads(warnings_str) if warnings_str else [],
        "created_at": row[6].isoformat() if row[6] else None,
        "finished_at": row[7].isoformat() if row[7] else None,
    }
