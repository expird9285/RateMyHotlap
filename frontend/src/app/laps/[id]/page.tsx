"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { fetchLapDetail, type LapDetail } from "@/utils/api";
import TelemetryChart from "@/components/TelemetryChart";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Car, MapPin, Gauge } from "lucide-react";

function formatLapTime(ms: number | null): string {
  if (!ms) return "--:--.---";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

export default function LapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [lap, setLap] = useState<LapDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [xAxis, setXAxis] = useState<"time_ms" | "spline">("time_ms");
  const [visibleChannels, setVisibleChannels] = useState<string[]>(["speed", "throttle", "brake"]);

  useEffect(() => {
    if (!authLoading && !session) { router.push("/"); return; }
    if (!session || !id) return;
    setLoading(true);
    fetchLapDetail(Number(id))
      .then(setLap)
      .catch((e) => setError(e?.response?.data?.detail || "Failed to load lap"))
      .finally(() => setLoading(false));
  }, [id, session, authLoading, router]);

  const allChannels = lap ? Object.keys(lap.telemetry).filter(k => k !== "time_ms" && k !== "spline") : [];

  const channelToggle = (ch: string) => {
    setVisibleChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (error || !lap) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-red-400 mb-4">{error || "Lap not found"}</p>
        <button onClick={() => router.back()} className="text-blue-400 hover:underline">← Go back</button>
      </div>
    );
  }

  const channelColors: Record<string, string> = {
    speed: "bg-blue-500", throttle: "bg-green-500", brake: "bg-red-500",
    steer: "bg-yellow-500", rpm: "bg-purple-500", gear: "bg-cyan-500",
    g_lat: "bg-pink-500", g_lon: "bg-orange-500"
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="flex flex-col sm:flex-row gap-6 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/50 text-red-400">{lap.game}</span>
              <h1 className="text-2xl font-bold">{lap.track || "Unknown Track"}</h1>
            </div>
            <p className="text-zinc-400 flex items-center gap-2"><Car size={14} /> {lap.car || "Unknown Car"}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center min-w-[200px]">
            <div className="text-zinc-500 text-xs uppercase mb-1">Lap Time</div>
            <div className="font-mono text-3xl font-bold text-emerald-400">{formatLapTime(lap.lap_time_ms)}</div>
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="text-sm text-zinc-500 mr-2">X-Axis:</div>
        {(["time_ms", "spline"] as const).map(ax => (
          <button
            key={ax}
            onClick={() => lap.telemetry[ax] ? setXAxis(ax) : null}
            disabled={!lap.telemetry[ax]}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              xAxis === ax ? "bg-blue-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30"
            }`}
          >
            {ax === "time_ms" ? "Time" : "Track Position"}
          </button>
        ))}

        <div className="w-px h-6 bg-zinc-800 mx-2" />
        <div className="text-sm text-zinc-500 mr-2">Channels:</div>
        {allChannels.map(ch => (
          <button
            key={ch}
            onClick={() => channelToggle(ch)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              visibleChannels.includes(ch) ? "bg-zinc-800 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-600"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${channelColors[ch] || "bg-zinc-500"}`} />
            {ch}
          </button>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6"
      >
        <TelemetryChart
          channels={lap.telemetry}
          visibleChannels={visibleChannels}
          xAxis={xAxis}
          height={400}
          title="Telemetry Data"
        />
      </motion.div>

      {/* Individual channel charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {visibleChannels.map(ch => (
          <motion.div
            key={ch}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4"
          >
            <TelemetryChart
              channels={lap.telemetry}
              visibleChannels={[ch]}
              xAxis={xAxis}
              height={200}
              title={ch.charAt(0).toUpperCase() + ch.slice(1)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
