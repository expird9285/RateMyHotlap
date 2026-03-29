"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Timer,
  Gauge,
  Car,
  MapPin,
  Layers,
  Share2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { TelemetryChart } from "@/components/TelemetryChart";
import api from "@/utils/api";
import { formatLapTime, gameBadgeColor } from "@/utils/format";

interface LapDetail {
  id: number;
  game: string;
  track: string;
  car: string;
  lap_number: number;
  lap_time_ms: number;
  is_valid: number;
  is_public: number;
  telemetry: Record<string, number[]>;
}

export default function LapDetailPage() {
  const { id } = useParams();
  const { session, loading } = useAuth();
  const router = useRouter();

  const [lap, setLap] = useState<LapDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [activeChannels, setActiveChannels] = useState([
    "speed",
    "throttle",
    "brake",
  ]);

  useEffect(() => {
    if (!loading && !session) router.push("/");
  }, [session, loading, router]);

  useEffect(() => {
    if (!session || !id) return;
    setFetching(true);
    api
      .get(`/laps/${id}`)
      .then((r) => setLap(r.data))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [session, id]);

  const channelOptions = [
    { key: "speed", label: "속도" },
    { key: "throttle", label: "스로틀" },
    { key: "brake", label: "브레이크" },
    { key: "steer", label: "스티어링" },
    { key: "rpm", label: "RPM" },
    { key: "gear", label: "기어" },
    { key: "g_lat", label: "Lateral G" },
    { key: "g_lon", label: "Long. G" },
  ];

  const toggleChannel = (key: string) => {
    setActiveChannels((prev) =>
      prev.includes(key)
        ? prev.filter((c) => c !== key)
        : [...prev, key]
    );
  };

  if (loading || !session) return null;

  if (fetching) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
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
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!lap) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
        <div
          className="card-static"
          style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}
        >
          랩을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const badge = gameBadgeColor(lap.game);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
      {/* Back */}
      <button
        className="btn-secondary"
        style={{ padding: "6px 14px", fontSize: 13, marginBottom: 20 }}
        onClick={() => router.push("/dashboard")}
      >
        <ArrowLeft size={14} />
        대시보드로 돌아가기
      </button>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-static"
        style={{ padding: "24px 28px", marginBottom: 20 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span
                className="badge"
                style={{ background: badge.bg, color: badge.text }}
              >
                {lap.game}
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {lap.track || "Unknown Track"}
              </h1>
            </div>

            <div
              style={{
                display: "flex",
                gap: 24,
                fontSize: 14,
                color: "var(--text-secondary)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Car size={15} />
                {lap.car || "Unknown Car"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Layers size={15} />
                Lap {lap.lap_number}
              </span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <p
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 800,
                color: "var(--accent)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatLapTime(lap.lap_time_ms)}
            </p>
            {!lap.is_valid && (
              <span
                className="badge"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "var(--error)",
                  marginTop: 4,
                }}
              >
                Invalid Lap
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Channel Selectors */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        {channelOptions
          .filter((ch) => lap.telemetry[ch.key])
          .map((ch) => {
            const active = activeChannels.includes(ch.key);
            return (
              <button
                key={ch.key}
                onClick={() => toggleChannel(ch.key)}
                style={{
                  padding: "6px 14px",
                  border: active
                    ? "1.5px solid var(--accent)"
                    : "1px solid var(--border)",
                  borderRadius: 999,
                  background: active ? "var(--accent-lighter)" : "var(--bg-card)",
                  color: active ? "var(--accent-dark)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {ch.label}
              </button>
            );
          })}
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <TelemetryChart
          telemetry={lap.telemetry}
          channels={activeChannels}
          height={400}
        />
      </motion.div>
    </div>
  );
}
