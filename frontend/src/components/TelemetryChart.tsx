"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend
} from "recharts";
import { useMemo } from "react";

interface TelemetryChartProps {
  channels: Record<string, number[]>;
  /** Which channels to display */
  visibleChannels?: string[];
  /** X-axis key: "time_ms" or "spline" */
  xAxis?: string;
  /** Title of the chart */
  title?: string;
  /** Height in px */
  height?: number;
  /** For overlays: second dataset */
  overlayChannels?: Record<string, number[]>;
  overlayLabel?: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  speed: "#3b82f6",
  throttle: "#22c55e",
  brake: "#ef4444",
  steer: "#f59e0b",
  rpm: "#a855f7",
  gear: "#06b6d4",
  g_lat: "#ec4899",
  g_lon: "#f97316",
};

const CHANNEL_LABELS: Record<string, string> = {
  speed: "Speed (km/h)",
  throttle: "Throttle (%)",
  brake: "Brake (%)",
  steer: "Steer (°)",
  rpm: "RPM",
  gear: "Gear",
  g_lat: "G Lat",
  g_lon: "G Lon",
};

function downsample(data: any[], targetPoints: number): any[] {
  if (data.length <= targetPoints) return data;
  const step = Math.ceil(data.length / targetPoints);
  return data.filter((_, i) => i % step === 0);
}

export default function TelemetryChart({
  channels,
  visibleChannels,
  xAxis = "time_ms",
  title,
  height = 300,
  overlayChannels,
  overlayLabel,
}: TelemetryChartProps) {
  const shownChannels = visibleChannels
    ?? Object.keys(channels).filter((k) => k !== "time_ms" && k !== "spline");

  const chartData = useMemo(() => {
    const xData = channels[xAxis] || [];
    const len = xData.length;
    if (len === 0) return [];

    const rows = [];
    for (let i = 0; i < len; i++) {
      const row: any = { x: xData[i] };
      for (const ch of shownChannels) {
        row[ch] = channels[ch]?.[i] ?? null;
        if (overlayChannels) {
          row[`${ch}_b`] = overlayChannels[ch]?.[i] ?? null;
        }
      }
      rows.push(row);
    }
    return downsample(rows, 600);
  }, [channels, overlayChannels, xAxis, shownChannels]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
        No telemetry data available
      </div>
    );
  }

  const xLabel = xAxis === "time_ms" ? "Time (s)" : "Track Position";

  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="x"
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickFormatter={(v) =>
              xAxis === "time_ms" ? `${(v / 1000).toFixed(0)}s` : v.toFixed(2)
            }
          />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={(v) =>
              xAxis === "time_ms" ? `${(v / 1000).toFixed(2)}s` : `Pos: ${v}`
            }
          />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />

          {shownChannels.map((ch) => (
            <Line
              key={ch}
              type="monotone"
              dataKey={ch}
              name={CHANNEL_LABELS[ch] || ch}
              stroke={CHANNEL_COLORS[ch] || "#71717a"}
              strokeWidth={1.5}
              dot={false}
              animationDuration={0}
            />
          ))}

          {overlayChannels &&
            shownChannels.map((ch) => (
              <Line
                key={`${ch}_b`}
                type="monotone"
                dataKey={`${ch}_b`}
                name={`${CHANNEL_LABELS[ch] || ch} (${overlayLabel || "B"})`}
                stroke={CHANNEL_COLORS[ch] || "#71717a"}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                animationDuration={0}
                opacity={0.6}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
