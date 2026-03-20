"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, LogOut, FileBarChart, History } from "lucide-react";
import axios from "axios";

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
      } else {
        setSession(session);
        setLoading(false);
      }
    };
    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("telemetry_file", file);

    try {
      const token = session?.access_token;
      // In development, assume backend runs on localhost:8000
      const response = await axios.post("http://localhost:8000/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`
        }
      });
      alert(`Upload successful! Job ID: ${response.data.job_id}`);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 w-full px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          RateMyHotlap
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-zinc-400 text-sm hidden sm:inline">{session?.user?.email}</span>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors text-zinc-300"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Upload Widget */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-1 md:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-800/50 rounded-2xl p-8 border border-zinc-800 shadow-xl flex flex-col items-center justify-center min-h-[400px]"
          >
            <div className="bg-blue-500/10 p-6 rounded-full mb-6">
              <Upload className="text-blue-400" size={48} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Upload Telemetry</h2>
            <p className="text-zinc-400 mb-8 text-center max-w-sm">
              Select your Assetto Corsa Competizione (.ld) or Le Mans Ultimate (.duckdb) telemetry file to begin analysis.
            </p>
            
            <input 
              type="file" 
              accept=".ld,.duckdb" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {uploading ? "Uploading..." : "Select File"}
            </button>
          </motion.div>

          {/* Sidebar Modules */}
          <div className="flex flex-col gap-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-4">
                <History className="text-emerald-400" size={24} />
                <h3 className="text-lg font-semibold">Recent Laps</h3>
              </div>
              <div className="flex flex-col gap-3">
                <div className="text-zinc-500 text-sm text-center py-8">
                  No laps uploaded yet.
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-4">
                <FileBarChart className="text-purple-400" size={24} />
                <h3 className="text-lg font-semibold">Stats Overview</h3>
              </div>
              <div className="flex flex-col gap-3">
                 <div className="text-zinc-500 text-sm py-4">
                  Upload your first lap to unlock AI insights and community comparisons.
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
