import axios from "axios";
import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL });

// Attach auth token to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ─── Laps ───

export interface Lap {
  id: number;
  game: string;
  track: string | null;
  car: string | null;
  lap_number: number | null;
  lap_time_ms: number | null;
  is_valid: number;
  is_public: number;
  uploaded_at: string | null;
}

export interface LapDetail extends Lap {
  telemetry: Record<string, number[]>;
}

export async function fetchLaps(filters?: {
  game?: string;
  track?: string;
  car?: string;
  search?: string;
}): Promise<Lap[]> {
  const params = new URLSearchParams();
  if (filters?.game) params.set("game", filters.game);
  if (filters?.track) params.set("track", filters.track);
  if (filters?.car) params.set("car", filters.car);
  if (filters?.search) params.set("search", filters.search);
  const { data } = await api.get(`/api/laps?${params.toString()}`);
  return data;
}

export async function fetchLapDetail(id: number): Promise<LapDetail> {
  const { data } = await api.get(`/api/laps/${id}`);
  return data;
}

// ─── Upload ───

export interface UploadResult {
  message: string;
  job_id: number;
  raw_file_id: number;
  object_key: string;
}

export async function uploadTelemetry(
  file: File,
  ldxFile?: File | null,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("telemetry_file", file);
  if (ldxFile) {
    formData.append("ldx_file", ldxFile);
  }
  const { data } = await api.post("/api/upload", formData, {
    onUploadProgress: (e) => {
      if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

export interface ImportJob {
  id: number;
  status: string;
  total_laps: number | null;
  imported_laps: number | null;
  failed_laps: number | null;
  warnings: string[];
}

export async function fetchImportJob(jobId: number): Promise<ImportJob> {
  const { data } = await api.get(`/api/upload/${jobId}`);
  return data;
}

// ─── Compare ───

export interface CompareResult {
  lap_a: LapDetail;
  lap_b: LapDetail;
  delta: {
    positions: number[];
    delta_ms: number[];
    lap_time_diff_ms: number;
    summary: string;
  };
}

export async function compareLaps(a: number, b: number): Promise<CompareResult> {
  const { data } = await api.get(`/api/compare?a=${a}&b=${b}`);
  return data;
}

// ─── Share ───

export async function createShareCode(
  lapIdA: number,
  lapIdB: number
): Promise<{ code: string; url: string }> {
  const { data } = await api.post("/api/share", {
    lap_id_a: lapIdA,
    lap_id_b: lapIdB,
  });
  return data;
}

export async function fetchSharedComparison(code: string) {
  // No auth needed for shared links
  const { data } = await axios.get(`${API_URL}/api/share/${code}`);
  return data;
}

export default api;
