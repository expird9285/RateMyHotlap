"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileUp, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import api from "@/utils/api";

interface UploadModalProps {
  onClose: () => void;
}

type GameType = "ACC" | "LMU";

export function UploadModal({ onClose }: UploadModalProps) {
  const { session } = useAuth();
  const [game, setGame] = useState<GameType>("ACC");
  const [telemetryFile, setTelemetryFile] = useState<File | null>(null);
  const [setupFile, setSetupFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    jobId?: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const telemetryInputRef = useRef<HTMLInputElement>(null);
  const setupInputRef = useRef<HTMLInputElement>(null);

  const telemetryAccept = game === "ACC" ? ".ld" : ".duckdb";
  const telemetryLabel =
    game === "ACC" ? "텔레메트리 파일 (.ld)" : "텔레메트리 파일 (.duckdb)";

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (game === "ACC") {
        if (ext === "ld") setTelemetryFile(file);
        else if (ext === "ldx") setSetupFile(file);
      } else {
        if (ext === "duckdb") setTelemetryFile(file);
      }
    },
    [game]
  );

  const handleUpload = async () => {
    if (!telemetryFile || !session) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("game", game);
      formData.append("telemetry_file", telemetryFile);
      if (setupFile && game === "ACC") {
        formData.append("setup_file", setupFile);
      }

      const res = await api.post("/upload", formData);
      setResult({
        ok: true,
        message: `업로드 성공! ${res.data.import_job_id ? "임포트 처리중..." : ""}`,
        jobId: res.data.import_job_id,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || err.message || "업로드에 실패했습니다.";
      setResult({ ok: false, message: msg });
    } finally {
      setUploading(false);
    }
  };

  const clearFiles = () => {
    setTelemetryFile(null);
    setSetupFile(null);
    setResult(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="card-static"
          style={{
            width: "100%",
            maxWidth: 520,
            padding: 0,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              텔레메트리 업로드
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: 4,
                borderRadius: "var(--radius-sm)",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: "20px 24px" }}>
            {/* ─── Game Toggle ─── */}
            <div
              style={{
                display: "flex",
                background: "var(--bg-app)",
                borderRadius: "var(--radius-md)",
                padding: 4,
                marginBottom: 20,
              }}
            >
              {(["ACC", "LMU"] as GameType[]).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGame(g);
                    clearFiles();
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    background: game === g ? "var(--bg-card)" : "transparent",
                    boxShadow: game === g ? "var(--shadow-sm)" : "none",
                    color:
                      game === g ? "var(--accent)" : "var(--text-secondary)",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {g === "ACC"
                    ? "🏁 ACC"
                    : "🏎️ LMU"}
                </button>
              ))}
            </div>

            {/* ─── Drop Zone ─── */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${
                  dragOver ? "var(--accent)" : "var(--border)"
                }`,
                borderRadius: "var(--radius-lg)",
                padding: "32px 20px",
                textAlign: "center",
                background: dragOver
                  ? "var(--accent-lighter)"
                  : "var(--bg-app)",
                transition: "all 0.2s ease",
                marginBottom: 16,
                cursor: "pointer",
              }}
              onClick={() => telemetryInputRef.current?.click()}
            >
              <FileUp
                size={36}
                style={{
                  color: dragOver ? "var(--accent)" : "var(--text-muted)",
                  marginBottom: 8,
                }}
              />
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--text-primary)",
                }}
              >
                {telemetryFile
                  ? telemetryFile.name
                  : "클릭하거나 파일을 드래그하세요"}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {telemetryLabel}
              </p>

              <input
                ref={telemetryInputRef}
                type="file"
                accept={telemetryAccept}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setTelemetryFile(f);
                }}
              />
            </div>

            {/* ─── LDX file (ACC only) ─── */}
            {game === "ACC" && (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  background: "var(--bg-card)",
                  transition: "border-color 0.2s",
                }}
                onClick={() => setupInputRef.current?.click()}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--accent-light)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {setupFile ? setupFile.name : "셋업 파일 (.ldx)"}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    선택사항 — 차량·트랙 메타데이터 포함
                  </p>
                </div>
                <Upload size={16} color="var(--text-muted)" />

                <input
                  ref={setupInputRef}
                  type="file"
                  accept=".ldx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSetupFile(f);
                  }}
                />
              </div>
            )}

            {/* ─── Result ─── */}
            {result && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  marginBottom: 16,
                  background: result.ok
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(239,68,68,0.08)",
                  border: `1px solid ${
                    result.ok
                      ? "rgba(34,197,94,0.2)"
                      : "rgba(239,68,68,0.2)"
                  }`,
                }}
              >
                {result.ok ? (
                  <CheckCircle
                    size={18}
                    style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }}
                  />
                ) : (
                  <AlertCircle
                    size={18}
                    style={{ color: "var(--error)", flexShrink: 0, marginTop: 1 }}
                  />
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: result.ok ? "#166534" : "#991b1b",
                    lineHeight: 1.5,
                  }}
                >
                  {result.message}
                </p>
              </div>
            )}

            {/* ─── Actions ─── */}
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button className="btn-secondary" onClick={onClose}>
                취소
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={!telemetryFile || uploading}
              >
                {uploading ? (
                  <>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    업로드
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AnimatePresence>
  );
}
