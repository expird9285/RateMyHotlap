"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      } else {
        setLoading(false);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleDiscordLogin = async () => {
    // Note: User needs to configure Discord OAuth in Supabase Dashboard
    const { error } = await supabase.auth.signInWithOAuth({ provider: "discord" });
    if (error) console.error("Error logging in:", error.message);
  };

  const handleGoogleLogin = async () => {
    // Note: User needs to configure Google OAuth in Supabase Dashboard
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    if (error) console.error("Error logging in:", error.message);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full p-8 bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800"
      >
        <h1 className="text-4xl font-bold mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          RateMyHotlap
        </h1>
        <p className="text-zinc-400 text-center mb-8">
          Upload and analyze your racing simulator telemetry using AI and community comparisons.
        </p>

        <div className="flex flex-col gap-4">
          <button 
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Sign in with Google
          </button>
          <button 
            onClick={handleDiscordLogin}
            className="flex items-center justify-center gap-2 bg-[#5865F2] text-white font-semibold py-3 px-4 rounded-xl hover:bg-[#4752c4] transition-colors"
          >
            Sign in with Discord
          </button>
        </div>
      </motion.div>
    </div>
  );
}
