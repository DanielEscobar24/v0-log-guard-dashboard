/**
 * Cliente HTTP del dashboard.
 *
 * El navegador habla siempre con rutas relativas de Next (`/api/...`).
 * En Vercel, Next actúa como proxy server-side hacia el gateway real usando `API_GATEWAY_URL`,
 * así evitamos exponer `localhost` o URLs internas en el build del frontend.
 */

export interface DashboardStats {
  totalLogs: number
  totalAttacks: number
  totalBenign: number
  activeAlerts: number
  attackRate: string | number
  byLabel: Record<string, number>
  bySeverity: Record<string, number>
}

export interface BackendLog {
  _id?: string
  id: string
  timestamp: string
  src_ip: string
  src_port: number
  dst_ip: string
  dst_port: number
  protocol: string
  bytes_sent: number
  bytes_received: number
  packets: number
  duration: number
  label: string
  severity: string
  confidence: number
}

export interface LogsResponse {
  logs: BackendLog[]
  pagination: { page: number; limit: number; total: number; pages: number }
  summary?: {
    bySeverity: Record<string, number>
  }
}

export interface TrafficBucket {
  timestamp: string
  benign: number
  attacks: number
  total: number
}

export interface AttackTypeRow {
  type: string
  count: number
}

export interface AlertTrendBucket {
  timestamp: string
  activeAlerts: number
}

export interface TopSourceRow {
  ip: string
  attacks: number
  types: string[]
}

export interface BackendAlert {
  _id?: string
  id: string
  timestamp: string
  type: string
  severity: string
  source_ip: string
  target_ip: string
  message: string
  log_id: string
  acknowledged: boolean
}

async function apiGet<T>(path: string): Promise<T> {
  const normalizedPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`
  const res = await fetch(normalizedPath, { cache: "no-store" })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const payload = (await res.json()) as { error?: string }
      if (payload?.error) {
        detail = payload.error
      }
    } catch {}
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function getDashboardStats() {
  return apiGet<DashboardStats>("/stats/dashboard")
}

export function getLogs(params?: { limit?: number; page?: number; from?: string; to?: string }) {
  const q = new URLSearchParams()
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.page) q.set("page", String(params.page))
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const suffix = q.toString() ? `?${q}` : ""
  return apiGet<LogsResponse>(`/logs${suffix}`)
}

export function getTrafficStats(hours?: number) {
  const suffix = typeof hours === "number" ? `?hours=${hours}` : ""
  return apiGet<TrafficBucket[]>(`/stats/traffic${suffix}`)
}

export function getAttackDistribution() {
  return apiGet<AttackTypeRow[]>("/stats/attacks")
}

export function getAlertTrend(hours?: number) {
  const suffix = typeof hours === "number" ? `?hours=${hours}` : ""
  return apiGet<AlertTrendBucket[]>(`/stats/alerts-trend${suffix}`)
}

export function getTopSources(limit = 8) {
  return apiGet<TopSourceRow[]>(`/stats/top-sources?limit=${limit}`)
}

export function getAlerts(limit = 100) {
  return apiGet<BackendAlert[]>(`/alerts?limit=${limit}`)
}
