import hashlib
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import Optional

from ..auth import get_current_user
from ..storage import upload_file_to_oci
from ..init_db import get_connection

router = APIRouter(prefix="/api/upload", tags=["Upload"])

@router.post("")
async def upload_files(
    telemetry_file: UploadFile = File(...),
    setup_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    supabase_user_id = user.get("sub")
    if not supabase_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    # DB 연결 및 유저 ID 조회
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 유저가 DB에 없으면 생성 (upsert 로직 단순화)
        cursor.execute("SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id])
        row = cursor.fetchone()
        if row:
            db_user_id = row[0]
        else:
            email = user.get("email", "")
            cursor.execute(
                "INSERT INTO users (supabase_user_id, email, username) VALUES (:1, :2, :3) RETURNING id INTO :4",
                [supabase_user_id, email, email.split('@')[0] if email else "Racer"]
            )
            # Cannot use RETURNING INTO directly with simple execute easily without var, so let's do simple insert then select
            conn.commit()
            cursor.execute("SELECT id FROM users WHERE supabase_user_id = :1", [supabase_user_id])
            db_user_id = cursor.fetchone()[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # 파일명 기반 게임/타입 판별
    original_name = telemetry_file.filename or "unknown"
    ext = original_name.split('.')[-1].lower()
    
    if ext == "ld":
        game = "ACC"
        file_type = "telemetry_ld"
    elif ext == "duckdb":
        game = "LMU"
        file_type = "telemetry_duckdb"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .ld or .duckdb")

    # 파일 읽기 및 해시 계산
    content = await telemetry_file.read()
    size_bytes = len(content)
    file_hash = hashlib.sha256(content).hexdigest()

    # Object Storage Key 생성
    date_str = datetime.utcnow().strftime("%Y/%m/%d")
    unique_id = str(uuid.uuid4())
    object_key = f"raw/user_{db_user_id}/{game.lower()}/{date_str}/{unique_id}_session.{ext}"

    # OCI 업로드
    try:
        upload_file_to_oci(content, object_key, content_type="application/octet-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")

    # 메타데이터 기록 및 Job 생성
    try:
        # raw_files insert
        cursor.execute("""
            INSERT INTO raw_files 
            (user_id, game, file_type, original_name, object_key, sha256, size_bytes, mime_type, upload_status)
            VALUES (:1, :2, :3, :4, :5, :6, :7, :8, 'uploaded')
        """, [db_user_id, game, file_type, original_name, object_key, file_hash, size_bytes, telemetry_file.content_type])
        
        # get identity id
        cursor.execute("SELECT MAX(id) FROM raw_files WHERE object_key = :1", [object_key])
        raw_file_id = cursor.fetchone()[0]

        # import_jobs 생성
        cursor.execute("""
            INSERT INTO import_jobs (user_id, raw_file_id, game, status)
            VALUES (:1, :2, :3, 'pending')
        """, [db_user_id, raw_file_id, game])
        
        conn.commit()
        
        cursor.execute("SELECT MAX(id) FROM import_jobs WHERE raw_file_id = :1", [raw_file_id])
        job_id = cursor.fetchone()[0]

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database insert failed: {str(e)}")
    finally:
        cursor.close()
        conn.close()

    # TODO: 비동기 워커로 job_id 전달하여 import 실행
    
    return {
        "message": "File uploaded successfully",
        "job_id": job_id,
        "raw_file_id": raw_file_id,
        "object_key": object_key
    }
