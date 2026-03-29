"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChannelConfig {
  key: string;
  label: string;
  color: string;
  unit: string;
}

const CHANNEL_PRESETS: Record<string, ChannelConfig> = {
  speed: { key: "speed", label: "속도", color: "#0d9488", unit: "km/h" },
  throttle: {
    key: "throttle",
    label: "스로틀",
    color: "#22c55e",
    unit: "%",
  },
  brake: { key: "brake", label: "브레이크", color: "#ef4444", unit: "%" },
  steer: { key: "steer", label: "스티어링", color: "#f59e0b", unit: "°" },
  rpm: { key: "rpm", label: "RPM", color: "#8b5cf6", unit: "rpm" },
  gear: { key: "gear", label: "기어", color: "#64748b", unit: "" },
  g_lat: {
    key: "g_lat",
    label: "Lateral G",
    color: "#ec4899",
    unit: "G",
  },
  g_lon: {
    key: "g_lon",
    label: "Longitudinal G",
    color: "#06b6d4",
    unit: "G",
  },
};

interface TelemetryChartProps {
  telemetry: Record<string, number[]>;
  channels?: string[];
  height?: number;
  /** For overlay: a second set of telemetry data */
  overlayTelemetry?: Record<string, number[]>;
  overlayLabel?: string;
}

export function TelemetryChart({
  telemetry,
  channels = ["speed", "throttle", "brake"],
  height = 320,
  overlayTelemetry,
  overlayLabel = "B",
}: TelemetryChartProps) {
  if (!telemetry || !telemetry.time_ms) return null;

  // Build chart data
  const timeData = telemetry.time_ms;
  const maxPoints = 600;
  const step = Math.max(1, Math.floor(timeData.length / maxPoints));

  const chartData = [];
  for (let i = 0; i < timeData.length; i += step) {
    const point: Record<string, number> = {
      time: Math.round(timeData[i] / 100) / 10, // seconds with 1 decimal
    };
    for (const ch of channels) {
      if (telemetry[ch]) {
        point[ch] = telemetry[ch][i] ?? 0;
      }
      if (overlayTelemetry?.[ch]) {
        const overlayIdx = Math.round(
          (i / timeData.length) *
            ((overlayTelemetry.time_ms?.length || timeData.length) - 1)
        );
        point[`${ch}_overlay`] =
          overlayTelemetry[ch][overlayIdx] ?? 0;
      }
    }
    chartData.push(point);
  }

  const activeChannels = channels.filter((ch) => telemetry[ch]);

  return (
    <div
      className="card-static"
      style={{
        padding: "16px 12px 8px",
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 12, bottom: 4, left: -10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={{
              value: "시간 (s)",
              position: "insideBottomRight",
              offset: -4,
              style: { fontSize: 11, fill: "var(--text-muted)" },
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              boxShadow: "var(--shadow-md)",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />

          {activeChannels.map((ch) => {
            const config = CHANNEL_PRESETS[ch] || {
              key: ch,
              label: ch,
              color: "#94a3b8",
              unit: "",
            };
            return (
              <Line
                key={ch}
                type="monotone"
                dataKey={ch}
                name={config.label}
                stroke={config.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
            );
          })}

          {/* Overlay lines */}
          {overlayTelemetry &&
            activeChannels.map((ch) => {
              const config = CHANNEL_PRESETS[ch];
              if (!config || !overlayTelemetry[ch]) return null;
              return (
                <Line
                  key={`${ch}_overlay`}
                  type="monotone"
                  dataKey={`${ch}_overlay`}
                  name={`${config.label} (${overlayLabel})`}
                  stroke={config.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={{ r: 3 }}
                  opacity={0.6}
                />
              );
            })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
