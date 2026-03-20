"""
Import orchestrator — dispatches parsing by file type and writes results to DB.
"""
import json
from datetime import datetime
from typing import Optional

from api.init_db import get_connection, release_connection
from api.importers.acc_ld import parse_ld_bytes


def run_import(
    job_id: int,
    raw_file_id: int,
    db_user_id: int,
    game: str,
    file_content: bytes,
    file_ext: str,
) -> None:
    """
    Execute the import pipeline:
     1. Update job → processing
     2. Parse file → list of NormalizedLap dicts
     3. Store each lap in `laps` + `telemetry`
     4. Update job → success / failed / partial_success
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # ── 1. Mark job as processing ──
        cursor.execute(
            "UPDATE import_jobs SET status = 'processing' WHERE id = :1", [job_id]
        )
        conn.commit()

        # ── 2. Parse ──
        normalized_laps = []
        all_warnings = []
        parse_error: Optional[str] = None

        try:
            if file_ext == "ld":
                normalized_laps = parse_ld_bytes(file_content)
            elif file_ext == "duckdb":
                # LMU parser is still a stub — mark accordingly
                all_warnings.append("LMU DuckDB import is not yet implemented.")
            else:
                parse_error = f"Unsupported file extension: .{file_ext}"
        except Exception as e:
            parse_error = str(e)

        if parse_error:
            cursor.execute(
                """
                UPDATE import_jobs
                SET status = 'failed',
                    warnings_json = :1,
                    finished_at = :2
                WHERE id = :3
                """,
                [json.dumps([parse_error]), datetime.utcnow(), job_id],
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

                # Collect warnings
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
                        VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)
                        RETURNING id INTO v_id;
                        :10 := v_id;
                    END;
                    """,
                    [
                        db_user_id,
                        meta.get("game", game),
                        meta.get("track"),
                        meta.get("car"),
                        meta.get("lap_number"),
                        meta.get("lap_time_ms"),
                        1 if meta.get("is_valid", True) else 0,
                        datetime.utcnow(),
                        datetime.utcnow(),
                        lap_id_var,
                    ],
                )
                lap_id = lap_id_var.getvalue()[0]

                # Insert telemetry (channels as JSON)
                telemetry_json = json.dumps(channels)
                cursor.execute(
                    "INSERT INTO telemetry (lap_id, points_json) VALUES (:1, :2)",
                    [lap_id, telemetry_json],
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
            SET status = :1,
                total_laps = :2,
                imported_laps = :3,
                failed_laps = :4,
                warnings_json = :5,
                finished_at = :6
            WHERE id = :7
            """,
            [
                status,
                total,
                imported_count,
                failed_count,
                json.dumps(all_warnings) if all_warnings else None,
                datetime.utcnow(),
                job_id,
            ],
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
                    warnings_json = :1,
                    finished_at = :2
                WHERE id = :3
                """,
                [json.dumps([str(e)]), datetime.utcnow(), job_id],
            )
            conn.commit()
            cursor2.close()
        except Exception:
            pass
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        release_connection(conn)
