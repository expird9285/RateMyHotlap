"""
ACC .ld file importer — converts MoTeC telemetry to NormalizedLap.
"""
import os
import tempfile
from typing import List, Dict, Any

from api.importers.ldparser import ldData


# ACC channel name → internal channel name mapping
# ACC channel names vary by version; this covers common ones
_CHANNEL_MAP = {
    # Speed
    "speed": "speed",
    "ground speed": "speed",
    "gnd speed": "speed",
    # Throttle
    "throttle": "throttle",
    "throttle pos": "throttle",
    # Brake
    "brake": "brake",
    "brake pos": "brake",
    # Steering
    "steer angle": "steer",
    "steered angle": "steer",
    "steer": "steer",
    # Gear
    "gear": "gear",
    # RPM
    "rpms": "rpm",
    "rpm": "rpm",
    "engine rpm": "rpm",
    # G-forces
    "g force lat": "g_lat",
    "g_lat": "g_lat",
    "lat acc": "g_lat",
    "g force lon": "g_lon",
    "g_lon": "g_lon",
    "lon acc": "g_lon",
    # Lap distance / spline
    "lap dist": "spline",
    "ndist": "spline",
    "normalised car pos": "spline",
}

# Channels that must be present for a valid import
_REQUIRED_CHANNELS = {"speed", "throttle", "brake"}
# Channels that are nice to have but optional
_OPTIONAL_CHANNELS = {"steer", "gear", "rpm", "g_lat", "g_lon", "spline"}


def parse_ld_bytes(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Parse ACC .ld file content and return a list of NormalizedLap dicts.

    Since ACC .ld files typically contain a single session (not split by lap),
    the entire session is returned as one lap. Lap splitting via Lap Beacon
    can be added later.
    """
    # ldparser needs a file path, so write to a temp file
    with tempfile.NamedTemporaryFile(suffix=".ld", delete=False) as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    try:
        ld = ldData.fromfile(tmp_path)
    except Exception as e:
        raise RuntimeError(f"Failed to parse .ld file: {e}")
    finally:
        os.unlink(tmp_path)

    # ── Extract metadata ──
    head = ld.head
    track = head.venue or "Unknown Track"
    car = head.vehicleid or "Unknown Car"
    driver = head.driver or ""

    # ── Map channels ──
    mapped: Dict[str, list] = {}
    missing_channels: List[str] = []
    import_warnings: List[str] = []
    available_names = list(ld)  # channel names

    for chan in ld.channs:
        norm_name = chan.name.lower().strip()
        internal = _CHANNEL_MAP.get(norm_name)
        if internal and internal not in mapped:
            try:
                data = chan.data
                mapped[internal] = data.tolist()
            except Exception as exc:
                import_warnings.append(f"Channel '{chan.name}' read error: {exc}")

    # Check required channels
    for req in _REQUIRED_CHANNELS:
        if req not in mapped:
            missing_channels.append(req)

    if missing_channels:
        all_required_missing = all(r in missing_channels for r in _REQUIRED_CHANNELS)
        if all_required_missing:
            raise RuntimeError(
                f"Critical channels missing: {missing_channels}. "
                f"Available channels: {available_names}"
            )
        import_warnings.append(f"Missing required channels: {missing_channels}")

    # Check optional channels
    for opt in _OPTIONAL_CHANNELS:
        if opt not in mapped:
            missing_channels.append(opt)

    # ── Build time_ms channel ──
    # Pick the longest channel as the reference length
    max_len = max((len(v) for v in mapped.values()), default=0)

    if max_len == 0:
        raise RuntimeError("No data points found in .ld file")

    # Determine sample rate from first available channel
    sample_rate = 100  # default
    for chan in ld.channs:
        norm_name = chan.name.lower().strip()
        if _CHANNEL_MAP.get(norm_name) in mapped:
            sample_rate = chan.freq if chan.freq > 0 else 100
            break

    # Generate time_ms based on sample rate
    dt_ms = 1000.0 / sample_rate
    mapped["time_ms"] = [round(i * dt_ms, 1) for i in range(max_len)]

    # Estimate lap time
    lap_time_ms = int(max_len * dt_ms) if max_len > 0 else 0

    # ── Build NormalizedLap ──
    normalized = {
        "meta": {
            "game": "ACC",
            "track": track,
            "car": car,
            "lap_number": 1,
            "lap_time_ms": lap_time_ms,
            "is_valid": True,
            "sample_rate_hz": sample_rate,
        },
        "channels": mapped,
        "source": {
            "format": "ld",
            "missing_channels": missing_channels,
            "import_warnings": import_warnings,
        },
    }

    return [normalized]
