"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Gauge, Trophy, Clock, ExternalLink } from "lucide-react";
import { TelemetryChart } from "@/components/TelemetryChart";
import { formatLapTime, formatDelta, gameBadgeColor } from "@/utils/format";

export default function SharedPage() {
  const { code } = useParams();
  const [data, setData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/share/${code}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setFetching(false));
  }, [code]);

  if (fetching) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
          공유된 비교를 불러오는 중...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 500, margin: "80px auto", padding: 20 }}>
        <div
          className="card-static"
          style={{
            padding: "60px 40px",
            textAlign: "center",
          }}
        >
          <Gauge
            size={48}
            style={{ margin: "0 auto 16px", opacity: 0.2 }}
          />
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            공유 링크를 찾을 수 없습니다
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--text-secondary)",
            }}
          >
            만료되었거나 잘못된 링크일 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const { lap_a, lap_b } = data;
  const deltaMs = lap_a.lap_time_ms - lap_b.lap_time_ms;
  const aFaster = deltaMs <= 0;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background:
              "linear-gradient(135deg, var(--accent), var(--accent-dark))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Gauge size={20} color="#fff" />
        </div>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            RateMyHotlap — 공유된 비교
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            {lap_a.track || "Unknown Track"} · {lap_a.game}
          </p>
        </div>
      </motion.div>

      {/* Comparison Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
                  <Trophy size={14} color="var(--secondary)" style={{ marginLeft: "auto" }} />
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
                {lap.car || "Unknown Car"}
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

      {/* Delta */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
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
          시간차:
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
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <TelemetryChart
          telemetry={lap_a.telemetry}
          overlayTelemetry={lap_b.telemetry}
          overlayLabel="B"
          channels={["speed", "throttle", "brake"]}
          height={400}
        />
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ textAlign: "center", marginTop: 32 }}
      >
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--accent)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          RateMyHotlap에서 나만의 텔레메트리 분석하기
          <ExternalLink size={14} />
        </a>
      </motion.div>
    </div>
  );
}
