"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Search, Filter, Clock, Trophy, ChevronRight, GitCompare } from "lucide-react";
import { fetchLaps, uploadTelemetry, fetchImportJob, type Lap, type ImportJob } from "@/utils/api";

function formatLapTime(ms: number | null): string {
  if (!ms) return "--:--.---";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [gameFilter, setGameFilter] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compare selection
  const [selectedLaps, setSelectedLaps] = useState<number[]>([]);

  useEffect(() => {
    if (!authLoading && !session) router.push("/");
  }, [authLoading, session, router]);

  const loadLaps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLaps({
        game: gameFilter || undefined,
        search: search || undefined,
      });
      setLaps(data);
    } catch (e) {
      console.error("Failed to load laps:", e);
    } finally {
      setLoading(false);
    }
  }, [gameFilter, search]);

  useEffect(() => {
    if (session) loadLaps();
  }, [session, loadLaps]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImportJob(null);
    setUploadProgress(0);
    try {
      const result = await uploadTelemetry(file, setUploadProgress);
      // Poll import job status
      const poll = async () => {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          try {
            const job = await fetchImportJob(result.job_id);
            setImportJob(job);
            if (["success", "failed", "partial_success"].includes(job.status)) {
              loadLaps();
              return;
            }
          } catch { break; }
        }
      };
      poll();
    } catch (err) {
      setImportJob({ id: 0, status: "failed", total_laps: 0, imported_laps: 0, failed_laps: 0, warnings: ["Upload failed. Please try again."] });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleLapSelect = (id: number) => {
    setSelectedLaps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
    );
  };

  const canCompare = selectedLaps.length === 2;

  if (authLoading || !session) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top bar: Upload + Compare */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-1">My Laps</h2>
          <p className="text-zinc-500 text-sm">{laps.length} laps uploaded</p>
        </div>
        <div className="flex gap-3">
          {canCompare && (
            <button
              onClick={() => router.push(`/compare?a=${selectedLaps[0]}&b=${selectedLaps[1]}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20"
            >
              <GitCompare size={16} /> Compare Selected
            </button>
          )}
          <input type="file" accept=".ld,.duckdb" className="hidden" ref={fileInputRef} onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
          >
            <Upload size={16} /> {uploading ? `Uploading ${uploadProgress}%` : "Upload File"}
          </button>
        </div>
      </div>

      {/* Import job status */}
      <AnimatePresence>
        {importJob && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className={`mb-6 p-4 rounded-xl border text-sm ${
              importJob.status === "success" ? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
              : importJob.status === "failed" ? "bg-red-950/50 border-red-800 text-red-300"
              : importJob.status === "partial_success" ? "bg-yellow-950/50 border-yellow-800 text-yellow-300"
              : "bg-zinc-900 border-zinc-700 text-zinc-300"
            }`}
          >
            <div className="font-semibold mb-1">
              Import {importJob.status === "success" ? "Complete ✓" : importJob.status === "failed" ? "Failed ✗" : importJob.status === "processing" ? "Processing..." : importJob.status}
            </div>
            {importJob.imported_laps != null && <p>Imported: {importJob.imported_laps} laps</p>}
            {importJob.warnings?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs opacity-80">{importJob.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadLaps()}
            placeholder="Search tracks, cars..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>
        {["", "ACC"].map((g) => (
          <button
            key={g}
            onClick={() => { setGameFilter(g); setTimeout(loadLaps, 50); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              gameFilter === g ? "bg-blue-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {g || "All Games"}
          </button>
        ))}
      </div>

      {/* Lap list */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : laps.length === 0 ? (
        <div className="text-center py-20">
          <Upload className="mx-auto mb-4 text-zinc-700" size={48} />
          <p className="text-zinc-500 mb-2">No laps yet</p>
          <p className="text-zinc-600 text-sm">Upload an ACC .ld file to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {laps.map((lap, i) => (
            <motion.div
              key={lap.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => toggleLapSelect(lap.id)}
              className={`group flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                selectedLaps.includes(lap.id)
                  ? "bg-blue-950/40 border-blue-700 ring-1 ring-blue-500/30"
                  : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              {/* Selection indicator */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                selectedLaps.includes(lap.id) ? "border-blue-400 bg-blue-500" : "border-zinc-700"
              }`}>
                {selectedLaps.includes(lap.id) && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>

              {/* Game badge */}
              <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                lap.game === "ACC" ? "bg-red-900/50 text-red-400" : "bg-blue-900/50 text-blue-400"
              }`}>{lap.game}</span>

              {/* Track + Car */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{lap.track || "Unknown Track"}</div>
                <div className="text-zinc-500 text-sm truncate">{lap.car || "Unknown Car"}</div>
              </div>

              {/* Lap time */}
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-lg font-semibold text-emerald-400">{formatLapTime(lap.lap_time_ms)}</div>
                <div className="text-zinc-600 text-xs">
                  {lap.uploaded_at ? new Date(lap.uploaded_at).toLocaleDateString() : ""}
                </div>
              </div>

              {/* View detail arrow */}
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/laps/${lap.id}`); }}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight size={18} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {selectedLaps.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-4 text-sm">
          <span className="text-zinc-400">{selectedLaps.length}/2 laps selected</span>
          {canCompare && (
            <button
              onClick={() => router.push(`/compare?a=${selectedLaps[0]}&b=${selectedLaps[1]}`)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-all"
            >
              Compare →
            </button>
          )}
          <button onClick={() => setSelectedLaps([])} className="text-zinc-500 hover:text-white transition-colors">Clear</button>
        </div>
      )}
    </div>
  );
}
