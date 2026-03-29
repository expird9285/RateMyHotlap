/**
 * Shared formatting utilities — eliminates duplication across page files.
 */

/**
 * Format lap time in milliseconds to mm:ss.SSS display string.
 * e.g. 93456 → "1:33.456"
 */
export function formatLapTime(ms: number): string {
  if (!ms || ms <= 0) return "--:--.---";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Format delta time in ms to a signed string.
 * e.g. 1234 → "+1.234", -567 → "-0.567"
 */
export function formatDelta(deltaMs: number): string {
  const sign = deltaMs >= 0 ? "+" : "-";
  const abs = Math.abs(deltaMs);
  return `${sign}${(abs / 1000).toFixed(3)}`;
}

/**
 * Get a human-readable relative time string.
 * e.g. "2 hours ago", "3 days ago"
 */
export function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffSec = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}일 전`;
  return then.toLocaleDateString("ko-KR");
}

/**
 * Get game badge color class name.
 */
export function gameBadgeColor(game: string): {
  bg: string;
  text: string;
} {
  switch (game?.toUpperCase()) {
    case "ACC":
      return { bg: "#f0fdf4", text: "#16a34a" };
    case "LMU":
      return { bg: "#eff6ff", text: "#2563eb" };
    default:
      return { bg: "#f1f5f9", text: "#64748b" };
  }
}
