"""
Import orchestrator — dispatches parsing by file type and writes results to DB.
"""
import json
from datetime import datetime
from typing import Optional

from api.init_db import get_connection, release_connection
from api.importers.acc_ld import parse_ld_bytes
from api.importers.lmu_duckdb import parse_duckdb_bytes


def run_import(
    job_id: int,
    raw_file_id: int,
    db_user_id: int,
    game: str,
    file_content: bytes,
    file_ext: str,
    ldx_content: Optional[bytes] = None,
) -> None:
    """
    Execute the import pipeline:
     1. Update job → processing
     2. Parse file → list of NormalizedLap dicts
     3. Store each lap in `laps` + `telemetry`
     4. Update job → success / failed / partial_success
    """
    conn = get_connection()
    cursor = None
    try:
        cursor = conn.cursor()

        # ── 1. Mark job as processing ──
        cursor.execute(
            "UPDATE import_jobs SET status = 'processing' WHERE id = :jid",
            {"jid": job_id},
        )
        conn.commit()

        # ── 2. Parse ──
        normalized_laps = []
        all_warnings = []
        parse_error: Optional[str] = None

        try:
            if file_ext == "ld":
                normalized_laps = parse_ld_bytes(
                    file_content, ldx_content=ldx_content
                )
            elif file_ext == "duckdb":
                normalized_laps = parse_duckdb_bytes(file_content)
            else:
                parse_error = f"Unsupported file extension: .{file_ext}"
        except Exception as e:
            parse_error = str(e)

        if parse_error:
            cursor.execute(
                """
                UPDATE import_jobs
                SET status = 'failed',
                    warnings_json = :warn,
                    finished_at = :fat
                WHERE id = :jid
                """,
                {
                    "warn": json.dumps([parse_error]),
                    "fat": datetime.utcnow(),
                    "jid": job_id,
                },
            )
            conn.commit()
            return

        # ── 3. Store laps + telemetry ──
        imported_count = 0
        failed_count = 0

        for lap in normalized_laps:
            try:
                meta = lap["meta"]
                channels = lap["channels"]
                source = lap.get("source", {})

                all_warnings.extend(source.get("import_warnings", []))

                # Insert lap
                lap_id_var = cursor.var(int)
                cursor.execute(
                    """
                    DECLARE v_id NUMBER;
                    BEGIN
                        INSERT INTO laps
                            (user_id, game, track, car, lap_number,
                             lap_time_ms, is_valid, recorded_at, uploaded_at)
                        VALUES (:u_id, :game, :track, :car, :lnum,
                                :ltime, :valid, :rec, :upl)
                        RETURNING id INTO v_id;
                        :ret := v_id;
                    END;
                    """,
                    {
                        "u_id": db_user_id,
                        "game": meta.get("game", game),
                        "track": meta.get("track"),
                        "car": meta.get("car"),
                        "lnum": meta.get("lap_number"),
                        "ltime": meta.get("lap_time_ms"),
                        "valid": 1 if meta.get("is_valid", True) else 0,
                        "rec": datetime.utcnow(),
                        "upl": datetime.utcnow(),
                        "ret": lap_id_var,
                    },
                )
                lap_id = lap_id_var.getvalue()

                # Insert telemetry (channels as JSON)
                telemetry_json = json.dumps(channels)
                cursor.execute(
                    "INSERT INTO telemetry (lap_id, points_json) VALUES (:lid, :pts)",
                    {"lid": lap_id, "pts": telemetry_json},
                )

                imported_count += 1

            except Exception as e:
                failed_count += 1
                all_warnings.append(f"Failed to store lap: {e}")

        # ── 4. Update job status ──
        total = imported_count + failed_count
        if failed_count == 0 and imported_count > 0:
            status = "success"
        elif imported_count > 0 and failed_count > 0:
            status = "partial_success"
        else:
            status = "failed"

        cursor.execute(
            """
            UPDATE import_jobs
            SET status = :stat,
                total_laps = :total,
                imported_laps = :imp,
                failed_laps = :fail,
                warnings_json = :warn,
                finished_at = :fat
            WHERE id = :jid
            """,
            {
                "stat": status,
                "total": total,
                "imp": imported_count,
                "fail": failed_count,
                "warn": json.dumps(all_warnings) if all_warnings else None,
                "fat": datetime.utcnow(),
                "jid": job_id,
            },
        )
        conn.commit()
        print(f"✓ Import job {job_id}: {status} ({imported_count}/{total} laps)")

    except Exception as e:
        conn.rollback()
        # Last-resort: mark job as failed
        try:
            cursor2 = conn.cursor()
            cursor2.execute(
                """
                UPDATE import_jobs
                SET status = 'failed',
                    warnings_json = :warn,
                    finished_at = :fat
                WHERE id = :jid
                """,
                {
                    "warn": json.dumps([str(e)]),
                    "fat": datetime.utcnow(),
                    "jid": job_id,
                },
            )
            conn.commit()
            cursor2.close()
        except Exception:
            pass
        raise
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        release_connection(conn)
