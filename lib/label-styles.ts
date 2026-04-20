/**
 * Colores de badge según etiqueta del backend (Benign, Port Scan, DDoS, …).
 */

export function labelBadgeClass(label: string): string {
  const u = label.toLowerCase()
  if (u.includes("benign")) return "bg-[#14b8a6] text-white"
  if (u.includes("ddos")) return "bg-[#ef4444] text-white"
  if (u.includes("port")) return "bg-[#f97316] text-white"
  if (u.includes("brute")) return "bg-[#f59e0b] text-[#0f172a]"
  if (u.includes("web") || u.includes("sql")) return "bg-[#8b5cf6] text-white"
  if (u.includes("bot")) return "bg-[#ef4444] text-white"
  if (u.includes("infiltration")) return "bg-[#f59e0b] text-[#0f172a]"
  return "bg-[#64748b] text-white"
}

export function alertSeverityClass(severity: string): string {
  const u = severity.toLowerCase()
  if (u === "critical") return "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30"
  if (u === "high") return "bg-[#f97316]/20 text-[#f97316] border-[#f97316]/30"
  if (u === "medium") return "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30"
  return "bg-[#14b8a6]/20 text-[#14b8a6] border-[#14b8a6]/30"
}

export function alertSeverityLabel(severity: string): string {
  return severity.toUpperCase()
}
