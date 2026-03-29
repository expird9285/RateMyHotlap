"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { UploadModal } from "@/components/UploadModal";
import {
  Gauge,
  LayoutDashboard,
  Upload,
  LogOut,
  Menu,
  X,
} from "lucide-react";

export function Navbar() {
  const { session, signOut } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-light)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
        }}
      >
        {/* Logo */}
        <Link
          href={session ? "/dashboard" : "/"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, var(--accent), var(--accent-dark))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Gauge size={20} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>RateMyHotlap</span>
        </Link>

        {/* Desktop nav */}
        {session && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            className="desktop-nav"
          >
            <Link href="/dashboard" style={{ textDecoration: "none" }}>
              <button className="btn-secondary" style={{ padding: "8px 16px" }}>
                <LayoutDashboard size={16} />
                대시보드
              </button>
            </Link>
            <button
              className="btn-primary"
              style={{ padding: "8px 16px" }}
              onClick={() => setShowUpload(true)}
            >
              <Upload size={16} />
              업로드
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "8px 16px" }}
              onClick={signOut}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        {/* Mobile hamburger */}
        {session && (
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}
      </nav>

      {/* Mobile dropdown */}
      {session && mobileOpen && (
        <div
          style={{
            position: "fixed",
            top: 64,
            left: 0,
            right: 0,
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--border)",
            padding: 16,
            zIndex: 99,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
          className="animate-fade-in"
        >
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <button
              className="btn-secondary"
              style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => setMobileOpen(false)}
            >
              <LayoutDashboard size={16} />
              대시보드
            </button>
          </Link>
          <button
            className="btn-primary"
            style={{ width: "100%" }}
            onClick={() => {
              setShowUpload(true);
              setMobileOpen(false);
            }}
          >
            <Upload size={16} />
            업로드
          </button>
          <button
            className="btn-secondary"
            style={{ width: "100%" }}
            onClick={signOut}
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
      `}</style>
    </>
  );
}
