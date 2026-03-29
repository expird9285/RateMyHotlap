"""
Upload router — handles file upload, OCI backup, and import job creation.
Supports ACC (.ld + .ldx) and LMU (.duckdb) files.
"""
import hashlib
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
import oracledb

from api.auth import get_current_user
from api.db import get_db
from api.crud import resolve_or_create_user
from api.storage import upload_file_to_oci

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("")
async def upload_files(
    game: str = Form(...),
    telemetry_file: UploadFile = File(...),
    setup_file: UploadFile = File(None),
    user: dict = Depends(get_current_user),
    conn: oracledb.Connection = Depends(get_db),
):
    """
    Upload telemetry file(s).
    - ACC: telemetry_file = .ld, setup_file = .ldx (optional)
    - LMU: telemetry_file = .duckdb
    """
    game = game.upper()
    if game not in ("ACC", "LMU"):
        raise HTTPException(status_code=400, detail="Unsupported game. Use ACC or LMU.")

    filename = telemetry_file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Validate file type per game
    if game == "ACC" and ext != "ld":
        raise HTTPException(status_code=400, detail="ACC requires a .ld file")
    if game == "LMU" and ext != "duckdb":
        raise HTTPException(status_code=400, detail="LMU requires a .duckdb file")

    file_content = await telemetry_file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()

    # Read optional LDX file
    ldx_content = None
    if setup_file:
        ldx_content = await setup_file.read()

    cursor = conn.cursor()

    # ── 1. Get or create user ──
    supabase_uid = user.get("id", "")
    db_user_id = resolve_or_create_user(cursor, conn, supabase_uid, user)

    # ── 2. Check duplicate (by sha256 hash) ──
    cursor.execute(
        "SELECT id FROM raw_files WHERE sha256 = :hash AND user_id = :uid",
        {"hash": file_hash, "uid": db_user_id},
    )
    if cursor.fetchone():
        raise HTTPException(status_code=409, detail="This file has already been uploaded")

    # ── 3. Upload to OCI Object Storage ──
    storage_key = f"{supabase_uid}/{file_hash}.{ext}"
    try:
        upload_file_to_oci(file_content, storage_key)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Storage upload failed: {e}"
        )

    # ── 4. Insert raw_files record ──
    raw_id_var = cursor.var(int)
    cursor.execute(
        """
        DECLARE v_id NUMBER;
        BEGIN
            INSERT INTO raw_files
                (user_id, game, file_type, original_name,
                 object_key, sha256, size_bytes)
            VALUES (:uid, :game, :ftype, :fname,
                    :okey, :sha, :fsize)
            RETURNING id INTO v_id;
            :ret := v_id;
        END;
        """,
        {
            "uid": db_user_id,
            "game": game,
            "ftype": ext,
            "fname": filename,
            "okey": storage_key,
            "sha": file_hash,
            "fsize": len(file_content),
            "ret": raw_id_var,
        },
    )
    raw_file_id = raw_id_var.getvalue()

    # ── 5. Create import job ──
    job_id_var = cursor.var(int)
    cursor.execute(
        """
        DECLARE v_id NUMBER;
        BEGIN
            INSERT INTO import_jobs
                (raw_file_id, user_id, game, status, created_at)
            VALUES (:rid, :uid, :game, 'pending', :cat)
            RETURNING id INTO v_id;
            :ret := v_id;
        END;
        """,
        {
            "rid": raw_file_id,
            "uid": db_user_id,
            "game": game,
            "cat": datetime.utcnow(),
            "ret": job_id_var,
        },
    )
    job_id = job_id_var.getvalue()
    conn.commit()

    # ── 6. Start import in background thread ──
    from api.importer_service import run_import

    threading.Thread(
        target=run_import,
        args=(job_id, raw_file_id, db_user_id, game, file_content, ext),
        kwargs={"ldx_content": ldx_content},
        daemon=True,
    ).start()

    cursor.close()
    return {
        "message": "Upload successful — import started",
        "raw_file_id": raw_file_id,
        "import_job_id": job_id,
    }
