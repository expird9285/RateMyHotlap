"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Timer,
  Trophy,
  GitCompare,
  Filter,
  ChevronDown,
  ChevronRight,
  Gauge,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import api from "@/utils/api";
import { formatLapTime, gameBadgeColor, timeAgo } from "@/utils/format";

interface Lap {
  id: number;
  game: string;
  track: string;
  car: string;
  lap_number: number;
  lap_time_ms: number;
  is_valid: number;
  is_public: number;
  recorded_at: string;
}

export default function DashboardPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [laps, setLaps] = useState<Lap[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filterGame, setFilterGame] = useState<string>("");
  const [filterTrack, setFilterTrack] = useState<string>("");
  const [selectedLaps, setSelectedLaps] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.push("/");
    }
  }, [session, loading, router]);

  useEffect(() => {
    if (!session) return;
    setFetching(true);
    api
      .get("/laps")
      .then((r) => setLaps(r.data))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [session]);

  // Distinct values for filters
  const games = useMemo(
    () => [...new Set(laps.map((l) => l.game))],
    [laps]
  );
  const tracks = useMemo(() => {
    const filtered = filterGame
      ? laps.filter((l) => l.game === filterGame)
      : laps;
    return [...new Set(filtered.map((l) => l.track).filter(Boolean))];
  }, [laps, filterGame]);

  const filteredLaps = useMemo(() => {
    let result = laps;
    if (filterGame) result = result.filter((l) => l.game === filterGame);
    if (filterTrack) result = result.filter((l) => l.track === filterTrack);
    return result;
  }, [laps, filterGame, filterTrack]);

  // Stats
  const bestLap = useMemo(() => {
    const valid = filteredLaps.filter((l) => l.is_valid && l.lap_time_ms > 0);
    return valid.length > 0
      ? valid.reduce((a, b) => (a.lap_time_ms < b.lap_time_ms ? a : b))
      : null;
  }, [filteredLaps]);

  const toggleSelect = (id: number) => {
    setSelectedLaps((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selectedLaps.length === 2) {
      router.push(
        `/compare?lap_a=${selectedLaps[0]}&lap_b=${selectedLaps[1]}`
      );
    }
  };

  if (loading || !session) return null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 24 }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 4,
            color: "var(--text-primary)",
          }}
        >
          대시보드
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
          업로드된 랩 데이터를 확인하고 비교해 보세요
        </p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card-static" style={{ padding: "20px 22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-sm)",
                background: "var(--accent-lighter)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Gauge size={18} color="var(--accent)" />
            </div>
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              총 랩 수
            </span>
          </div>
          <p
            style={{
              fontSize: 28,
              fontWeight: 800,
              margin: 0,
              color: "var(--text-primary)",
            }}
          >
            {filteredLaps.length}
          </p>
        </div>

        <div className="card-static" style={{ padding: "20px 22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-sm)",
                background: "#fef3c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trophy size={18} color="#f59e0b" />
            </div>
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              베스트 랩
            </span>
          </div>
          <p
            style={{
              fontSize: 28,
              fontWeight: 800,
              margin: 0,
              color: "var(--accent)",
            }}
          >
            {bestLap ? formatLapTime(bestLap.lap_time_ms) : "--:--.---"}
          </p>
          {bestLap && (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                margin: "4px 0 0",
              }}
            >
              {bestLap.track} · {bestLap.car}
            </p>
          )}
        </div>

        <div className="card-static" style={{ padding: "20px 22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-sm)",
                background: "#ede9fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={18} color="#8b5cf6" />
            </div>
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              트랙 수
            </span>
          </div>
          <p
            style={{
              fontSize: 28,
              fontWeight: 800,
              margin: 0,
              color: "var(--text-primary)",
            }}
          >
            {new Set(filteredLaps.map((l) => l.track).filter(Boolean)).size}
          </p>
        </div>
      </motion.div>

      {/* Filters + Compare */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card-static"
        style={{
          padding: "14px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: 13 }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} />
            필터
            <ChevronDown
              size={14}
              style={{
                transform: showFilters ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {showFilters && (
            <>
              <select
                className="input"
                style={{
                  width: "auto",
                  padding: "6px 12px",
                  fontSize: 13,
                }}
                value={filterGame}
                onChange={(e) => {
                  setFilterGame(e.target.value);
                  setFilterTrack("");
                }}
              >
                <option value="">전체 게임</option>
                {games.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                className="input"
                style={{
                  width: "auto",
                  padding: "6px 12px",
                  fontSize: 13,
                }}
                value={filterTrack}
                onChange={(e) => setFilterTrack(e.target.value)}
              >
                <option value="">전체 트랙</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {selectedLaps.length === 2 && (
          <button
            className="btn-primary"
            style={{ padding: "8px 16px", fontSize: 13 }}
            onClick={handleCompare}
          >
            <GitCompare size={14} />
            비교하기
          </button>
        )}
        {selectedLaps.length > 0 && selectedLaps.length < 2 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            비교할 랩을 1개 더 선택하세요
          </span>
        )}
      </motion.div>

      {/* Laps List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {fetching ? (
          <div
            className="card-static"
            style={{
              padding: 60,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: "3px solid var(--border)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            데이터를 불러오는 중...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredLaps.length === 0 ? (
          <div
            className="card-static"
            style={{
              padding: 60,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <Gauge
              size={40}
              style={{ margin: "0 auto 12px", opacity: 0.3 }}
            />
            <p style={{ margin: 0, fontWeight: 500 }}>
              아직 업로드된 랩이 없습니다
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              상단의 업로드 버튼으로 텔레메트리 파일을 추가해 보세요
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredLaps.map((lap, i) => {
              const selected = selectedLaps.includes(lap.id);
              const badge = gameBadgeColor(lap.game);
              return (
                <motion.div
                  key={lap.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="card"
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    cursor: "pointer",
                    border: selected
                      ? "1.5px solid var(--accent)"
                      : "1px solid var(--border-light)",
                    background: selected
                      ? "var(--accent-lighter)"
                      : "var(--bg-card)",
                  }}
                  onClick={() => toggleSelect(lap.id)}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: selected
                        ? "2px solid var(--accent)"
                        : "2px solid var(--border)",
                      background: selected ? "var(--accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {selected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M3 6L5 8L9 4"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        className="badge"
                        style={{
                          background: badge.bg,
                          color: badge.text,
                        }}
                      >
                        {lap.game}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {lap.track || "Unknown Track"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        fontSize: 13,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span>{lap.car || "Unknown Car"}</span>
                      <span>Lap {lap.lap_number}</span>
                      {lap.recorded_at && (
                        <span>{timeAgo(lap.recorded_at)}</span>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color:
                          bestLap?.id === lap.id
                            ? "var(--accent)"
                            : "var(--text-primary)",
                      }}
                    >
                      {formatLapTime(lap.lap_time_ms)}
                    </p>
                    {!lap.is_valid && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--error)",
                          fontWeight: 500,
                        }}
                      >
                        Invalid
                      </span>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight
                    size={18}
                    color="var(--text-muted)"
                    style={{ flexShrink: 0, cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/laps/${lap.id}`);
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
