"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, File as FileIcon, CheckCircle2 } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, ldxFile: File | null) => Promise<void>;
  uploading: boolean;
  uploadProgress: number;
}

export default function UploadModal({
  isOpen,
  onClose,
  onUpload,
  uploading,
  uploadProgress,
}: UploadModalProps) {
  const [ldFile, setLdFile] = useState<File | null>(null);
  const [ldxFile, setLdxFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent, type: "ld" | "ldx") => {
    e.preventDefault();
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (type === "ld") setLdFile(file);
      else setLdxFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "ld" | "ldx") => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === "ld") setLdFile(file);
      else setLdxFile(file);
    }
  };

  const handleUpload = () => {
    if (!ldFile) return;
    onUpload(ldFile, ldxFile);
  };

  const resetAndClose = () => {
    if (uploading) return;
    setLdFile(null);
    setLdxFile(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                <h3 className="text-xl font-bold">Upload Telemetry</h3>
                <button
                  onClick={resetAndClose}
                  disabled={uploading}
                  className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* LD File Upload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-zinc-300">Data File (.ld / .duckdb) <span className="text-red-400">*</span></label>
                  </div>
                  <label
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "ld")}
                    className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      ldFile ? "border-emerald-500/50 bg-emerald-950/20" : "border-zinc-700 bg-zinc-800/50 hover:border-blue-500/50 hover:bg-zinc-800"
                    } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input type="file" accept=".ld,.duckdb" className="hidden" onChange={(e) => handleFileChange(e, "ld")} disabled={uploading} />
                    {ldFile ? (
                      <div className="flex items-center gap-3 text-emerald-400">
                        <CheckCircle2 size={24} />
                        <span className="font-medium truncate max-w-[200px]">{ldFile.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-zinc-400 gap-2">
                        <Upload size={24} />
                        <span className="text-sm">Click or drag file here</span>
                      </div>
                    )}
                  </label>
                </div>

                {/* LDX File Upload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-zinc-300">Meta File (.ldx)</label>
                    <span className="text-xs text-zinc-500">Optional, but needed for ACC</span>
                  </div>
                  <label
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "ldx")}
                    className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      ldxFile ? "border-emerald-500/50 bg-emerald-950/20" : "border-zinc-700 bg-zinc-800/50 hover:border-blue-500/50 hover:bg-zinc-800"
                    } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input type="file" accept=".ldx" className="hidden" onChange={(e) => handleFileChange(e, "ldx")} disabled={uploading} />
                    {ldxFile ? (
                      <div className="flex items-center gap-3 text-emerald-400">
                        <CheckCircle2 size={24} />
                        <span className="font-medium truncate max-w-[200px]">{ldxFile.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-zinc-400 gap-2">
                        <FileIcon size={24} />
                        <span className="text-sm">Click or drag file here</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="p-5 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                <button
                  onClick={resetAndClose}
                  disabled={uploading}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!ldFile || uploading}
                  className="relative px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden min-w-[120px]"
                >
                  {uploading ? (
                    <>
                      <div className="absolute inset-0 bg-blue-700/50" style={{ width: `${uploadProgress}%` }} />
                      <span className="relative z-10 w-full text-center">Uploading {uploadProgress}%</span>
                    </>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
