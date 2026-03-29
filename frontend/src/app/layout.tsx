import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "RateMyHotlap — 텔레메트리 분석",
  description:
    "ACC, LMU 레이싱 시뮬레이터 텔레메트리 분석 및 비교 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ minHeight: "calc(100vh - 64px)", paddingTop: "64px" }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
