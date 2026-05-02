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
  acknowledgedAlerts: number
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
  ml_prediction?: string
  ml_severity?: string
  ml_confidence?: number
  ml_model_version?: string
  ml_model_type?: string
  ml_detection_source?: string
  ml_last_run_id?: string
  ml_last_scored_at?: string
  ml_reason?: string
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

export interface TimelinePreviewLog {
  id: string
  timestamp: string
  src_ip: string
  dst_ip: string
  protocol: string
  label: string
  severity: string
}

export interface FilteredTimelineBucket {
  timestamp: string
  total: number
  attacks: number
  highRisk: number
  preview: TimelinePreviewLog[]
}

export interface AttackTypeRow {
  type: string
  count: number
}

export interface DashboardRangeParams {
  from?: string
  to?: string
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

export interface ProtocolStatRow {
  protocol: string
  total: number
  attacks: number
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
  detection_source?: string
  ml_confidence?: number
  ml_model_version?: string
  inference_run_id?: string
}

export interface MlActiveModel {
  serviceName: string
  modelVersion: string
  modelType: string
  trainingDataset: string
  referenceF1: number
  inferenceMode: string
  trainedAt: string
  featureNames: string[]
  totalTrainingRows: number
  testRows: number
  isActive: boolean
  thresholdF1: number
}

export interface MlRiskySource {
  ip: string
  count: number
}

export interface MlRunSummary {
  runId: string
  status: string
  triggerSource: string
  startedAt: string
  finishedAt: string
  range: {
    from?: string
    to?: string
  }
  modelVersion: string
  modelType: string
  totalScored: number
  suspiciousCount: number
  benignCount: number
  averageConfidencePct: number
  suspiciousConfidencePct: number
  coveragePct: number
  collectionsWritten: string
  logsUpdated: number
  alertsCreated: number
  alertsEnriched: number
  trainedModel: boolean
  labelDistribution: Record<string, number>
  topRiskySources: MlRiskySource[]
}

export type AlertStatus = "open" | "acknowledged"

export interface AlertGroupPayload {
  type: string
  source_ip: string
  target_ip: string
  anchor_timestamp?: string
  acknowledged?: boolean
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

async function apiSend<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`
  const res = await fetch(normalizedPath, init)
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

function buildRangeQuery(params?: DashboardRangeParams) {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const suffix = q.toString() ? `?${q}` : ""
  return suffix
}

export function getDashboardStats(params?: DashboardRangeParams) {
  return apiGet<DashboardStats>(`/stats/dashboard${buildRangeQuery(params)}`)
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

export function getFilteredTimeline(params?: DashboardRangeParams) {
  return apiGet<FilteredTimelineBucket[]>(`/stats/timeline${buildRangeQuery(params)}`)
}

export function getAttackDistribution(params?: DashboardRangeParams) {
  return apiGet<AttackTypeRow[]>(`/stats/attacks${buildRangeQuery(params)}`)
}

export function getAlertTrend(hoursOrParams?: number | DashboardRangeParams) {
  if (typeof hoursOrParams === "number") {
    return apiGet<AlertTrendBucket[]>(`/stats/alerts-trend?hours=${hoursOrParams}`)
  }
  return apiGet<AlertTrendBucket[]>(`/stats/alerts-trend${buildRangeQuery(hoursOrParams)}`)
}

export function getTopSources(limit = 8, params?: DashboardRangeParams) {
  const q = new URLSearchParams()
  q.set("limit", String(limit))
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  return apiGet<TopSourceRow[]>(`/stats/top-sources?${q}`)
}

export function getProtocolStats(params?: DashboardRangeParams) {
  return apiGet<ProtocolStatRow[]>(`/stats/protocols${buildRangeQuery(params)}`)
}

export function getAlerts(limit = 100, params?: DashboardRangeParams) {
  const q = new URLSearchParams()
  q.set("limit", String(limit))
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  return apiGet<BackendAlert[]>(`/alerts?${q}`)
}

export function acknowledgeAlert(id: string) {
  return fetch(`/api/alerts/${encodeURIComponent(id)}/acknowledge`, {
    method: "PUT",
  }).then(async (res) => {
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`
      try {
        const payload = (await res.json()) as { error?: string }
        if (payload?.error) detail = payload.error
      } catch {}
      throw new Error(detail)
    }
    return res.json() as Promise<{ success: boolean }>
  })
}

export function unacknowledgeAlert(id: string) {
  return fetch(`/api/alerts/${encodeURIComponent(id)}/acknowledge`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ acknowledged: false }),
  }).then(async (res) => {
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`
      try {
        const payload = (await res.json()) as { error?: string }
        if (payload?.error) detail = payload.error
      } catch {}
      throw new Error(detail)
    }
    return res.json() as Promise<{ success: boolean }>
  })
}

export function updateAlertGroupAcknowledgement(payload: AlertGroupPayload) {
  return fetch("/api/alerts/group/acknowledge", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`
      try {
        const responsePayload = (await res.json()) as { error?: string }
        if (responsePayload?.error) detail = responsePayload.error
      } catch {}
      throw new Error(detail)
    }
    return res.json() as Promise<{ success: boolean; matchedCount: number; modifiedCount: number; acknowledged: boolean }>
  })
}

export function getActiveMlModel() {
  return apiGet<MlActiveModel>("/ml/models/active")
}

export function getLatestMlRun() {
  return apiGet<MlRunSummary>("/ml/runs/latest")
}

export function trainMlModel(payload?: { triggerSource?: string }) {
  return apiSend<MlActiveModel>("/ml/train", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  })
}

export function runMlRange(payload: {
  from: string
  to: string
  triggerSource?: string
  autoTrain?: boolean
  forceRetrain?: boolean
}) {
  return apiSend<MlRunSummary>("/ml/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}
