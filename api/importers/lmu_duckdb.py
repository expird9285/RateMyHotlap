"""
LMU .duckdb telemetry importer — converts Le Mans Ultimate telemetry to NormalizedLap.

LMU (built on rFactor 2 engine) exports telemetry as DuckDB database files.
Each file typically has a main telemetry table with rFactor 2-style column names.
"""
import os
import tempfile
from typing import List, Dict, Any, Optional, Tuple

import duckdb
import numpy as np


# ─── Channel Mapping ───
# rFactor 2 / LMU internal names → our NormalizedLap channel names
_CHANNEL_MAP: Dict[str, str] = {
    # Speed (m/s → km/h conversion needed)
    "mspeed": "speed",
    "speed": "speed",
    "vcar": "speed",
    # Throttle (0-1 → 0-100 conversion needed)
    "munfilteredthrottle": "throttle",
    "mthrottle": "throttle",
    "throttle": "throttle",
    # Brake (0-1 → 0-100 conversion needed)
    "munfilteredbrake": "brake",
    "mbrake": "brake",
    "brake": "brake",
    # Steering
    "munfilteredsteering": "steer",
    "msteering": "steer",
    "steer": "steer",
    "steering": "steer",
    # RPM
    "menginerpm": "rpm",
    "mrpm": "rpm",
    "rpm": "rpm",
    "enginerpm": "rpm",
    # Gear
    "mgear": "gear",
    "gear": "gear",
    # Lateral G
    "mlocalaccellat": "g_lat",
    "glat": "g_lat",
    "lateralacceleration": "g_lat",
    # Longitudinal G
    "mlocalaccellon": "g_lon",
    "glon": "g_lon",
    "longitudinalacceleration": "g_lon",
    # Spline / normalised position
    "mlapdist": "spline",
    "mnormalizedpathlateral": "spline",
    "lapdist": "spline",
    "normalizedlapdist": "spline",
}

# Columns that indicate lap boundaries
_LAP_COLUMNS = ["mlapnumber", "lapnumber", "mlap", "lap"]

# Columns for elapsed time
_TIME_COLUMNS = [
    "melapsedtime", "mcurrentet", "elapsedtime",
    "timestamp", "time", "et",
]

# Columns for lap start time (used for lap splitting)
_LAP_START_COLUMNS = ["mlapstartet", "lapstartet"]

# Channels that must be present for a valid import
_REQUIRED_CHANNELS = {"speed", "throttle", "brake"}
_OPTIONAL_CHANNELS = {"steer", "gear", "rpm", "g_lat", "g_lon", "spline"}

# Channels that need unit conversion
_SPEED_MPS_THRESHOLD = 100  # If max speed < 100, likely m/s not km/h


def parse_duckdb_bytes(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Parse an LMU .duckdb telemetry file and return a list of NormalizedLap dicts.

    Strategy:
      1. Write bytes to temp file (DuckDB needs file access)
      2. Inspect tables and discover the telemetry data table
      3. Map columns to internal channel names
      4. Split by lap number if available
      5. Build NormalizedLap for each lap
    """
    with tempfile.NamedTemporaryFile(suffix=".duckdb", delete=False) as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    try:
        return _parse_duckdb_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _parse_duckdb_file(file_path: str) -> List[Dict[str, Any]]:
    """Core parsing logic operating on a file path."""
    con = duckdb.connect(file_path, read_only=True)
    try:
        # ── 1. Discover tables ──
        tables = _discover_tables(con)
        if not tables:
            raise RuntimeError("No tables found in DuckDB file")

        # ── 2. Find the main telemetry table ──
        telem_table, columns = _find_telemetry_table(con, tables)
        if telem_table is None:
            raise RuntimeError(
                f"Could not identify telemetry table. "
                f"Tables found: {tables}"
            )

        # ── 3. Map columns ──
        channel_mapping, time_col, lap_col, lap_start_col = _map_columns(columns)

        import_warnings: List[str] = []
        missing_channels: List[str] = []

        # Check required channels
        mapped_internals = set(channel_mapping.values())
        for req in _REQUIRED_CHANNELS:
            if req not in mapped_internals:
                missing_channels.append(req)

        if len(missing_channels) == len(_REQUIRED_CHANNELS):
            raise RuntimeError(
                f"All critical channels missing. Available columns: {columns}"
            )
        elif missing_channels:
            import_warnings.append(f"Missing required channels: {missing_channels}")

        for opt in _OPTIONAL_CHANNELS:
            if opt not in mapped_internals:
                missing_channels.append(opt)

        # ── 4. Read data ──
        select_cols = list(channel_mapping.keys())
        if time_col and time_col not in select_cols:
            select_cols.append(time_col)
        if lap_col and lap_col not in select_cols:
            select_cols.append(lap_col)
        if lap_start_col and lap_start_col not in select_cols:
            select_cols.append(lap_start_col)

        quoted_cols = [f'"{c}"' for c in select_cols]
        query = f"SELECT {', '.join(quoted_cols)} FROM \"{telem_table}\" ORDER BY rowid"
        df = con.execute(query).fetchnumpy()

        if not df or len(next(iter(df.values()))) == 0:
            raise RuntimeError("Telemetry table is empty")

        # ── 5. Convert & build channels ──
        raw_channels: Dict[str, np.ndarray] = {}
        for db_col, internal_name in channel_mapping.items():
            if db_col in df and internal_name not in raw_channels:
                arr = np.array(df[db_col], dtype=np.float64)
                # Apply unit conversions
                arr = _convert_units(internal_name, arr)
                raw_channels[internal_name] = arr

        # Build time channel
        time_data = None
        if time_col and time_col in df:
            time_data = np.array(df[time_col], dtype=np.float64)

        # ── 6. Split by laps ──
        lap_data = None
        if lap_col and lap_col in df:
            lap_data = np.array(df[lap_col], dtype=np.float64)

        lap_start_data = None
        if lap_start_col and lap_start_col in df:
            lap_start_data = np.array(df[lap_start_col], dtype=np.float64)

        laps = _split_into_laps(
            raw_channels, time_data, lap_data, lap_start_data,
            missing_channels, import_warnings,
        )

        return laps

    finally:
        con.close()


def _discover_tables(con) -> List[str]:
    """List all tables in the DuckDB database."""
    result = con.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'main'"
    ).fetchall()
    return [r[0] for r in result]


def _find_telemetry_table(
    con, tables: List[str]
) -> Tuple[Optional[str], List[str]]:
    """
    Identify the main telemetry table by checking which table
    has the most telemetry-like columns.
    """
    best_table = None
    best_score = 0
    best_columns: List[str] = []

    for table in tables:
        try:
            cols_result = con.execute(
                f'PRAGMA table_info("{table}")'
            ).fetchall()
            col_names = [r[1] for r in cols_result]

            # Score: how many columns match known telemetry names
            score = 0
            for col in col_names:
                col_lower = col.lower()
                if col_lower in _CHANNEL_MAP:
                    score += 2
                elif col_lower in _LAP_COLUMNS:
                    score += 1
                elif col_lower in _TIME_COLUMNS:
                    score += 1

            if score > best_score:
                best_score = score
                best_table = table
                best_columns = col_names
        except Exception:
            continue

    return best_table, best_columns


def _map_columns(
    columns: List[str],
) -> Tuple[Dict[str, str], Optional[str], Optional[str], Optional[str]]:
    """
    Map DB columns to internal channel names.
    Also identify time, lap number, and lap start columns.
    """
    channel_mapping: Dict[str, str] = {}  # db_col → internal_name
    time_col: Optional[str] = None
    lap_col: Optional[str] = None
    lap_start_col: Optional[str] = None

    for col in columns:
        col_lower = col.lower()

        # Check telemetry channels
        if col_lower in _CHANNEL_MAP:
            internal = _CHANNEL_MAP[col_lower]
            if internal not in channel_mapping.values():
                channel_mapping[col] = internal

        # Check time columns
        if time_col is None and col_lower in _TIME_COLUMNS:
            time_col = col

        # Check lap number columns
        if lap_col is None and col_lower in _LAP_COLUMNS:
            lap_col = col

        # Check lap start columns
        if lap_start_col is None and col_lower in _LAP_START_COLUMNS:
            lap_start_col = col

    return channel_mapping, time_col, lap_col, lap_start_col


def _convert_units(channel_name: str, data: np.ndarray) -> np.ndarray:
    """Apply unit conversions where needed."""
    if channel_name == "speed":
        # If max value < threshold, assume m/s → convert to km/h
        max_val = np.nanmax(data) if len(data) > 0 else 0
        if max_val < _SPEED_MPS_THRESHOLD:
            data = data * 3.6

    elif channel_name in ("throttle", "brake"):
        # If values are in 0-1 range, convert to 0-100
        max_val = np.nanmax(data) if len(data) > 0 else 0
        if max_val <= 1.05:  # small tolerance
            data = data * 100.0

    return data


def _split_into_laps(
    channels: Dict[str, np.ndarray],
    time_data: Optional[np.ndarray],
    lap_data: Optional[np.ndarray],
    lap_start_data: Optional[np.ndarray],
    missing_channels: List[str],
    import_warnings: List[str],
) -> List[Dict[str, Any]]:
    """Split telemetry data into individual laps."""
    total_len = max((len(v) for v in channels.values()), default=0)
    if total_len == 0:
        raise RuntimeError("No data points found")

    # Determine lap boundaries
    lap_boundaries: List[Tuple[int, int, int]] = []  # (start_idx, end_idx, lap_num)

    if lap_data is not None:
        # Split by lap number column
        lap_numbers = lap_data.astype(int)
        unique_laps = sorted(set(lap_numbers))

        for lap_num in unique_laps:
            if lap_num < 0:
                continue  # Skip invalid laps
            indices = np.where(lap_numbers == lap_num)[0]
            if len(indices) < 10:  # Skip very short segments
                continue
            lap_boundaries.append((indices[0], indices[-1] + 1, lap_num))

    elif lap_start_data is not None and time_data is not None:
        # Split by lap start time changes
        lap_starts = np.where(np.diff(lap_start_data) > 0)[0] + 1
        boundaries = [0] + lap_starts.tolist() + [total_len]

        for i in range(len(boundaries) - 1):
            start = boundaries[i]
            end = boundaries[i + 1]
            if end - start < 10:
                continue
            lap_boundaries.append((start, end, i + 1))
    else:
        # No lap splitting available — treat entire session as one lap
        lap_boundaries.append((0, total_len, 1))
        import_warnings.append(
            "No lap boundary data found; entire session treated as one lap"
        )

    # Build NormalizedLap for each lap
    laps: List[Dict[str, Any]] = []

    for start_idx, end_idx, lap_num in lap_boundaries:
        lap_channels: Dict[str, list] = {}

        for ch_name, ch_data in channels.items():
            segment = ch_data[start_idx:end_idx]
            # Replace NaN with 0
            segment = np.nan_to_num(segment, nan=0.0)
            lap_channels[ch_name] = [round(float(v), 3) for v in segment]

        # Build time_ms for this lap segment
        segment_len = end_idx - start_idx
        if time_data is not None:
            time_segment = time_data[start_idx:end_idx]
            start_time = time_segment[0]
            lap_channels["time_ms"] = [
                round((t - start_time) * 1000, 1) for t in time_segment
            ]
            lap_time_ms = int((time_segment[-1] - start_time) * 1000)
        else:
            # Estimate sample rate and generate time_ms
            sample_rate = 60  # default assumption
            dt_ms = 1000.0 / sample_rate
            lap_channels["time_ms"] = [round(i * dt_ms, 1) for i in range(segment_len)]
            lap_time_ms = int(segment_len * dt_ms)
            import_warnings.append(
                f"Lap {lap_num}: No time column found; estimated at {sample_rate}Hz"
            )

        # Skip laps shorter than 5 seconds (likely outlap/error)
        if lap_time_ms < 5000:
            continue

        # Determine sample rate
        sample_rate_hz = 60
        if len(lap_channels["time_ms"]) > 1:
            dt = lap_channels["time_ms"][1] - lap_channels["time_ms"][0]
            if dt > 0:
                sample_rate_hz = int(round(1000.0 / dt))

        laps.append({
            "meta": {
                "game": "LMU",
                "track": "Unknown Track",
                "car": "Unknown Car",
                "lap_number": lap_num,
                "lap_time_ms": lap_time_ms,
                "is_valid": True,
                "sample_rate_hz": sample_rate_hz,
            },
            "channels": lap_channels,
            "source": {
                "format": "duckdb",
                "missing_channels": list(missing_channels),
                "import_warnings": list(import_warnings),
            },
        })

    if not laps:
        raise RuntimeError(
            "No valid laps extracted. All segments were too short or empty."
        )

    return laps
