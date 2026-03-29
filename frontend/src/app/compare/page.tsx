"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Trophy, Clock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { TelemetryChart } from "@/components/TelemetryChart";
import api from "@/utils/api";
import { formatLapTime, formatDelta, gameBadgeColor } from "@/utils/format";

function CompareContent() {
  const searchParams = useSearchParams();
  const { session, loading } = useAuth();
  const router = useRouter();

  const lapAId = searchParams.get("lap_a");
  const lapBId = searchParams.get("lap_b");

  const [data, setData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [activeChannels, setActiveChannels] = useState([
    "speed",
    "throttle",
    "brake",
  ]);

  useEffect(() => {
    if (!loading && !session) router.push("/");
  }, [session, loading, router]);

  useEffect(() => {
    if (!session || !lapAId || !lapBId) return;
    setFetching(true);
    api
      .get(`/compare?lap_a=${lapAId}&lap_b=${lapBId}`)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [session, lapAId, lapBId]);

  const handleShare = async () => {
    if (!lapAId || !lapBId) return;
    setSharing(true);
    try {
      const res = await api.post("/share", {
        lap_a_id: parseInt(lapAId),
        lap_b_id: parseInt(lapBId),
      });
      setShareCode(res.data.share_code);
      navigator.clipboard.writeText(
        `${window.location.origin}/share/${res.data.share_code}`
      );
    } catch {
    } finally {
      setSharing(false);
    }
  };

  const channelOptions = [
    { key: "speed", label: "속도" },
    { key: "throttle", label: "스로틀" },
    { key: "brake", label: "브레이크" },
    { key: "steer", label: "스티어링" },
    { key: "rpm", label: "RPM" },
  ];

  const toggleChannel = (key: string) => {
    setActiveChannels((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
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

  if (!data) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
        <div
          className="card-static"
          style={{
            padding: 60,
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          비교 데이터를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  const { lap_a, lap_b, telemetry_a, telemetry_b, delta_time } = data;
  const deltaMs = lap_a.lap_time_ms - lap_b.lap_time_ms;
  const aFaster = deltaMs <= 0;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <button
          className="btn-secondary"
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft size={14} />
          대시보드
        </button>

        <button
          className="btn-primary"
          style={{ padding: "8px 16px", fontSize: 13 }}
          onClick={handleShare}
          disabled={sharing}
        >
          <Share2 size={14} />
          {shareCode ? "링크 복사됨!" : "공유 링크 생성"}
        </button>
      </div>

      {/* Comparison Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {[
          { label: "A", lap: lap_a, faster: aFaster },
          { label: "B", lap: lap_b, faster: !aFaster },
        ].map(({ label, lap, faster }) => {
          const badge = gameBadgeColor(lap.game);
          return (
            <div
              key={label}
              className="card-static"
              style={{
                padding: "20px 22px",
                border: faster
                  ? "1.5px solid var(--accent)"
                  : "1px solid var(--border-light)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: faster ? "var(--accent)" : "var(--border)",
                    color: faster ? "#fff" : "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
                <span
                  className="badge"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {lap.game}
                </span>
                {faster && (
                  <Trophy
                    size={14}
                    color="var(--secondary)"
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {lap.track}
              </p>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {lap.car} · Lap {lap.lap_number}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  color: faster ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                {formatLapTime(lap.lap_time_ms)}
              </p>
            </div>
          );
        })}
      </motion.div>

      {/* Delta Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-static"
        style={{
          padding: "14px 22px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <Clock size={16} color="var(--text-muted)" />
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          시간 차이:
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: aFaster ? "var(--accent)" : "var(--error)",
          }}
        >
          {formatDelta(deltaMs)}s
        </span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          ({aFaster ? "A" : "B"}가 더 빠름)
        </span>
      </motion.div>

      {/* Channel Selectors */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        {channelOptions
          .filter((ch) => telemetry_a[ch.key] || telemetry_b[ch.key])
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
                  background: active
                    ? "var(--accent-lighter)"
                    : "var(--bg-card)",
                  color: active
                    ? "var(--accent-dark)"
                    : "var(--text-secondary)",
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
      </div>

      {/* Overlay Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <TelemetryChart
          telemetry={telemetry_a}
          overlayTelemetry={telemetry_b}
          overlayLabel="B"
          channels={activeChannels}
          height={400}
        />
      </motion.div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "50vh",
          }}
        >
          로딩 중...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
