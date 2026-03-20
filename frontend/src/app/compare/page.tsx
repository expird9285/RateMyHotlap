"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { compareLaps, createShareCode, type CompareResult } from "@/utils/api";
import TelemetryChart from "@/components/TelemetryChart";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Copy, Check } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

function formatLapTime(ms: number | null): string {
  if (!ms) return "--:--.---";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  const lapA = Number(searchParams.get("a"));
  const lapB = Number(searchParams.get("b"));

  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) { router.push("/"); return; }
    if (!session || !lapA || !lapB) return;
    setLoading(true);
    compareLaps(lapA, lapB)
      .then(setResult)
      .catch(e => setError(e?.response?.data?.detail || "Comparison failed"))
      .finally(() => setLoading(false));
  }, [lapA, lapB, session, authLoading, router]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const { code } = await createShareCode(lapA, lapB);
      setShareCode(code);
    } catch (e) {
      alert("Failed to create share link");
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${shareCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (error || !result) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-red-400 mb-4">{error || "No comparison data"}</p>
        <button onClick={() => router.back()} className="text-blue-400 hover:underline">← Go back</button>
      </div>
    );
  }

  const { lap_a, lap_b, delta } = result;
  const deltaData = delta.positions.map((pos, i) => ({
    position: pos,
    delta: delta.delta_ms[i],
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 text-sm transition-colors">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-blue-800/50 rounded-2xl p-5">
          <div className="text-xs text-blue-400 font-semibold mb-1 uppercase">Lap A</div>
          <div className="font-bold truncate">{lap_a.track}</div>
          <div className="text-zinc-400 text-sm truncate">{lap_a.car}</div>
          <div className="font-mono text-2xl text-emerald-400 mt-2">{formatLapTime(lap_a.lap_time_ms)}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center">
          <div className="text-xs text-zinc-500 uppercase mb-1">Difference</div>
          <div className={`font-mono text-3xl font-bold ${delta.lap_time_diff_ms > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {delta.lap_time_diff_ms > 0 ? "+" : ""}{(delta.lap_time_diff_ms / 1000).toFixed(3)}s
          </div>
          <div className="text-zinc-500 text-xs mt-1">{delta.summary}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-orange-800/50 rounded-2xl p-5">
          <div className="text-xs text-orange-400 font-semibold mb-1 uppercase">Lap B</div>
          <div className="font-bold truncate">{lap_b.track}</div>
          <div className="text-zinc-400 text-sm truncate">{lap_b.car}</div>
          <div className="font-mono text-2xl text-emerald-400 mt-2">{formatLapTime(lap_b.lap_time_ms)}</div>
        </motion.div>
      </div>

      {/* Share button */}
      <div className="flex justify-end mb-6 gap-3">
        {shareCode ? (
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm">
            <span className="text-zinc-400">Share:</span>
            <code className="text-emerald-400 font-mono">{shareCode}</code>
            <button onClick={handleCopy} className="p-1 hover:bg-zinc-800 rounded transition-colors">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-zinc-400" />}
            </button>
          </div>
        ) : (
          <button onClick={handleShare} disabled={sharing}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-all disabled:opacity-50">
            <Share2 size={14} /> {sharing ? "Creating..." : "Create Share Link"}
          </button>
        )}
      </div>

      {/* Delta chart */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Delta Time (A - B)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={deltaData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="position" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={v => (v * 100).toFixed(0) + "%"} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={v => (v / 1000).toFixed(1) + "s"} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px" }}
              formatter={(v: number) => [(v / 1000).toFixed(3) + "s", "Delta"]}
              labelFormatter={v => `Position: ${(v * 100).toFixed(0)}%`} />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="delta" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Overlay charts */}
      {["speed", "throttle", "brake"].map(ch => (
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
    </div>
  );
}
