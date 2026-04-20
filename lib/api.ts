/**
 * Cliente HTTP hacia el api-gateway (Mongo + stats).
 * Configura en .env.local: NEXT_PUBLIC_API_URL=http://localhost:4000
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "")

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
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function getDashboardStats() {
  return apiGet<DashboardStats>("/api/stats/dashboard")
}

export function getLogs(params?: { limit?: number; page?: number }) {
  const q = new URLSearchParams()
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.page) q.set("page", String(params.page))
  const suffix = q.toString() ? `?${q}` : ""
  return apiGet<LogsResponse>(`/api/logs${suffix}`)
}

export function getTrafficStats(hours = 24) {
  return apiGet<TrafficBucket[]>(`/api/stats/traffic?hours=${hours}`)
}

export function getAttackDistribution() {
  return apiGet<AttackTypeRow[]>("/api/stats/attacks")
}

export function getTopSources(limit = 8) {
  return apiGet<TopSourceRow[]>(`/api/stats/top-sources?limit=${limit}`)
}

export function getAlerts(limit = 100) {
  return apiGet<BackendAlert[]>(`/api/alerts?limit=${limit}`)
}
