"""
File upload router — handles telemetry and setup file uploads.
"""
import hashlib
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import Optional

from api.auth import get_current_user
from api.storage import upload_file_to_oci
from api.init_db import get_connection, release_connection
from api.importer_service import run_import

router = APIRouter(prefix="/api/upload", tags=["Upload"])


def _resolve_or_create_user(cursor, conn, supabase_user_id: str, user: dict) -> int:
    """Look up internal user_id, creating a new row if first login."""
    cursor.execute(
        "SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id]
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    email = user.get("email", "")
    username = email.split("@")[0] if email else "Racer"
    avatar_url = (user.get("user_metadata") or {}).get("avatar_url", "")

    # Use the sequence value via a PL/SQL block to avoid RETURNING INTO quirks
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
    return id_var.getvalue()[0]


@router.post("")
async def upload_files(
    telemetry_file: UploadFile = File(...),
    setup_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    supabase_user_id = user.get("id") or user.get("sub")
    if not supabase_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    conn = get_connection()
    try:
        cursor = conn.cursor()
        db_user_id = _resolve_or_create_user(cursor, conn, supabase_user_id, user)

        # ── Determine game/type from extension ──
        original_name = telemetry_file.filename or "unknown"
        ext = original_name.rsplit(".", 1)[-1].lower()

        if ext == "ld":
            game, file_type = "ACC", "telemetry_ld"
        elif ext == "duckdb":
            game, file_type = "LMU", "telemetry_duckdb"
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload .ld or .duckdb",
            )

        # ── Read file & hash ──
        content = await telemetry_file.read()
        size_bytes = len(content)
        file_hash = hashlib.sha256(content).hexdigest()

        # ── Upload to OCI Object Storage ──
        date_str = datetime.utcnow().strftime("%Y/%m/%d")
        unique_id = str(uuid.uuid4())
        object_key = f"raw/user_{db_user_id}/{game.lower()}/{date_str}/{unique_id}_session.{ext}"

        try:
            upload_file_to_oci(content, object_key)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Storage upload failed: {str(e)}"
            )

        # ── Insert raw_files ──
        raw_file_id_var = cursor.var(int)
        cursor.execute(
            """
            DECLARE v_id NUMBER;
            BEGIN
                INSERT INTO raw_files
                    (user_id, game, file_type, original_name, object_key,
                     sha256, size_bytes, mime_type, upload_status)
                VALUES (:1, :2, :3, :4, :5, :6, :7, :8, 'uploaded')
                RETURNING id INTO v_id;
                :9 := v_id;
            END;
            """,
            [
                db_user_id, game, file_type, original_name, object_key,
                file_hash, size_bytes, telemetry_file.content_type or "application/octet-stream",
                raw_file_id_var,
            ],
        )

        raw_file_id = raw_file_id_var.getvalue()[0]

        # ── Create import_job ──
        job_id_var = cursor.var(int)
        cursor.execute(
            """
            DECLARE v_id NUMBER;
            BEGIN
                INSERT INTO import_jobs (user_id, raw_file_id, game, status)
                VALUES (:1, :2, :3, 'pending')
                RETURNING id INTO v_id;
                :4 := v_id;
            END;
            """,
            [db_user_id, raw_file_id, game, job_id_var],
        )
        conn.commit()
        job_id = job_id_var.getvalue()[0]

        # ── Run import (synchronous for now) ──
        try:
            run_import(
                job_id=job_id,
                raw_file_id=raw_file_id,
                db_user_id=db_user_id,
                game=game,
                file_content=content,
                file_ext=ext,
            )
        except Exception as e:
            # Import failure is non-fatal for the upload response
            print(f"⚠ Import failed for job {job_id}: {e}")

        return {
            "message": "File uploaded successfully",
            "job_id": job_id,
            "raw_file_id": raw_file_id,
            "object_key": object_key,
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        release_connection(conn)
