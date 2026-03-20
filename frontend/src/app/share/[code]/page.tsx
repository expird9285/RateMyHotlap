"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchSharedComparison } from "@/utils/api";
import TelemetryChart from "@/components/TelemetryChart";
import { motion } from "framer-motion";
import { Eye, Gauge } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

function formatLapTime(ms: number | null): string {
  if (!ms) return "--:--.---";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

export default function SharePage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    fetchSharedComparison(code)
      .then(setData)
      .catch(e => setError(e?.response?.data?.detail || "Share code not found or expired"))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Gauge className="text-zinc-700 mb-4" size={48} />
        <p className="text-red-400 mb-2 text-lg">{error || "Not found"}</p>
        <p className="text-zinc-500 text-sm">This share link may have expired or is invalid.</p>
      </div>
    );
  }

  const { lap_a, lap_b, view_count } = data;
  const timeDiff = (lap_a?.lap_time_ms || 0) - (lap_b?.lap_time_ms || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Public header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Gauge className="text-blue-400" size={24} />
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            RateMyHotlap
          </span>
          <span className="text-zinc-600 text-sm ml-4">Shared Comparison</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Eye size={14} /> {view_count} views
        </div>
      </div>

      {/* Lap cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-blue-800/50 rounded-2xl p-5">
          <div className="text-xs text-blue-400 font-semibold mb-1 uppercase">Lap A</div>
          <div className="font-bold">{lap_a?.track}</div>
          <div className="text-zinc-400 text-sm">{lap_a?.car}</div>
          <div className="font-mono text-2xl text-emerald-400 mt-2">{formatLapTime(lap_a?.lap_time_ms)}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center">
          <div className="text-xs text-zinc-500 uppercase mb-1">Difference</div>
          <div className={`font-mono text-3xl font-bold ${timeDiff > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {timeDiff > 0 ? "+" : ""}{(timeDiff / 1000).toFixed(3)}s
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-orange-800/50 rounded-2xl p-5">
          <div className="text-xs text-orange-400 font-semibold mb-1 uppercase">Lap B</div>
          <div className="font-bold">{lap_b?.track}</div>
          <div className="text-zinc-400 text-sm">{lap_b?.car}</div>
          <div className="font-mono text-2xl text-emerald-400 mt-2">{formatLapTime(lap_b?.lap_time_ms)}</div>
        </motion.div>
      </div>

      {/* Overlay charts */}
      {lap_a?.telemetry && lap_b?.telemetry && ["speed", "throttle", "brake"].map(ch => (
        <motion.div key={ch} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-4">
          <TelemetryChart
            channels={lap_a.telemetry}
            overlayChannels={lap_b.telemetry}
            overlayLabel="B"
            visibleChannels={[ch]}
            height={250}
            title={`${ch.charAt(0).toUpperCase() + ch.slice(1)} — A (solid) vs B (dashed)`}
          />
        </motion.div>
      ))}

      <div className="text-center mt-12 text-zinc-600 text-sm">
        <a href="/" className="text-blue-400 hover:underline">Create your own analysis →</a>
      </div>
    </div>
  );
}
