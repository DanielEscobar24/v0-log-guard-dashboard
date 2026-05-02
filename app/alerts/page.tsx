"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  RefreshCw,
  ShieldAlert,
  Siren,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from "recharts"
import {
  acknowledgeAlert,
  getActiveMlModel,
  getAlerts,
  getAlertTrend,
  getAttackDistribution,
  getLatestMlRun,
  unacknowledgeAlert,
  updateAlertGroupAcknowledgement,
  type AlertTrendBucket,
  type AttackTypeRow,
  type BackendAlert,
  type DashboardRangeParams,
  type MlActiveModel,
  type MlRunSummary,
} from "@/lib/api"
import { loadDashboardRange } from "@/lib/dashboard-range"
import { alertSeverityClass, alertSeverityLabel, labelBadgeClass } from "@/lib/label-styles"
import { ACTIVE_ML_MODEL, deriveAlertMlSignals } from "@/lib/ml-insights"
import { subscribeMlRunEvents } from "@/lib/ml-run-events"

type FilterMode = "Todas" | "Críticas" | "Altas" | "Reconocidas"

const ATTACK_VECTOR_COLORS = ["#ff7a1a", "#00c2ff", "#a855f7", "#ff4d8d", "#ffe066"]
const GROUPABLE_ATTACK_TYPES = new Set([
  "ddos",
  "port scan",
  "brute force",
  "web attack",
  "sql injection",
  "botnet",
  "infiltration",
  "heartbleed",
])
const ALERT_GROUP_WINDOW_MS = 10 * 60 * 1000

function isGroupableAttackType(type: string) {
  return GROUPABLE_ATTACK_TYPES.has(type.trim().toLowerCase())
}

function parseTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function belongsToAlertGroup(candidate: BackendAlert, anchor: BackendAlert) {
  if (candidate.type !== anchor.type) return false
  if (candidate.source_ip !== anchor.source_ip) return false
  if (candidate.target_ip !== anchor.target_ip) return false
  if (!isGroupableAttackType(anchor.type)) return false

  const candidateDate = parseTimestamp(candidate.timestamp)
  const anchorDate = parseTimestamp(anchor.timestamp)
  if (!candidateDate || !anchorDate) return false

  return Math.abs(candidateDate.getTime() - anchorDate.getTime()) <= ALERT_GROUP_WINDOW_MS
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateTimeRange(dateValue: string, endOfDay = false) {
  return `${dateValue}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
}

function formatAlertTrendTime(timestamp: string) {
  const iso = timestamp.includes("T") ? timestamp : timestamp.replace(" ", "T") + ":00Z"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return timestamp
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatAlertTrendTooltip(timestamp: string) {
  const iso = timestamp.includes("T") ? timestamp : timestamp.replace(" ", "T") + ":00Z"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return timestamp
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function AlertTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-2 text-xs text-muted-foreground">{label ? formatAlertTrendTooltip(label) : "Sin fecha"}</p>
      <p className="text-[#ffb020]">Alertas activas: {Number(payload[0]?.value ?? 0).toLocaleString()}</p>
    </div>
  )
}

function AlertDistributionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: { type?: string; count?: number }; value?: number }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 text-xs text-muted-foreground">{item.payload?.type ?? "Tipo de alerta"}</p>
      <p className="font-medium text-foreground">{Number(item.value ?? 0).toLocaleString()} alertas</p>
    </div>
  )
}

export default function AlertsPage() {
  const [appliedRange, setAppliedRange] = useState<DateRange | null>(null)
  const [hasHydratedRange, setHasHydratedRange] = useState(false)
  const [alerts, setAlerts] = useState<BackendAlert[]>([])
  const [trend, setTrend] = useState<AlertTrendBucket[]>([])
  const [vectors, setVectors] = useState<AttackTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>("Todas")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [activeMlModel, setActiveMlModel] = useState<MlActiveModel | null>(null)
  const [latestMlRun, setLatestMlRun] = useState<MlRunSummary | null>(null)

  useEffect(() => {
    setAppliedRange(loadDashboardRange())
    setHasHydratedRange(true)
  }, [])

  const rangeParams = useMemo<DashboardRangeParams | undefined>(() => {
    if (!appliedRange?.from || !appliedRange?.to) return undefined

    return {
      from: formatDateTimeRange(formatDateInput(appliedRange.from)),
      to: formatDateTimeRange(formatDateInput(appliedRange.to), true),
    }
  }, [appliedRange?.from, appliedRange?.to])

  const rangeLabel =
    appliedRange?.from && appliedRange?.to
      ? `${appliedRange.from.toLocaleDateString("es-ES")} - ${appliedRange.to.toLocaleDateString("es-ES")}`
      : "Rango actual"

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [alertsResponse, trendResponse, vectorResponse] = await Promise.all([
        getAlerts(200, rangeParams),
        getAlertTrend(rangeParams),
        getAttackDistribution(rangeParams),
      ])
      setAlerts(alertsResponse)
      setTrend(trendResponse)
      setVectors(vectorResponse)
      setSelectedAlertId((current) => current ?? alertsResponse[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar alertas")
    } finally {
      setLoading(false)
    }
  }, [rangeParams])

  const loadMlContext = useCallback(async () => {
    const [modelResult, latestRunResult] = await Promise.allSettled([getActiveMlModel(), getLatestMlRun()])
    setActiveMlModel(modelResult.status === "fulfilled" ? modelResult.value : null)
    setLatestMlRun(latestRunResult.status === "fulfilled" ? latestRunResult.value : null)
  }, [])

  useEffect(() => {
    if (!hasHydratedRange) return
    void load()
    void loadMlContext()
  }, [hasHydratedRange, load, loadMlContext])

  useEffect(() => {
    return subscribeMlRunEvents(() => {
      void load()
      void loadMlContext()
    })
  }, [load, loadMlContext])

  const stats = useMemo(() => {
    const open = alerts.filter((a) => !a.acknowledged)
    const acknowledged = alerts.filter((a) => a.acknowledged)
    const sev = (s: string) => s.toLowerCase()
    return {
      active: open.length,
      critical: open.filter((a) => sev(a.severity) === "critical").length,
      high: open.filter((a) => sev(a.severity) === "high").length,
      acknowledged: acknowledged.length,
    }
  }, [alerts])

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const severity = alert.severity.toLowerCase()
      if (filter === "Todas") return true
      if (filter === "Críticas") return severity === "critical" && !alert.acknowledged
      if (filter === "Altas") return severity === "high" && !alert.acknowledged
      if (filter === "Reconocidas") return alert.acknowledged
      return true
    })
  }, [alerts, filter])

  const pageSize = 12
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize))
  const activePage = Math.min(currentPage, totalPages)
  const paginatedAlerts = filteredAlerts.slice((activePage - 1) * pageSize, activePage * pageSize)
  const selectedAlert = paginatedAlerts.find((alert) => alert.id === selectedAlertId) ?? paginatedAlerts[0] ?? null

  const vectorRows = useMemo(() => {
    const total = vectors.reduce((sum, row) => sum + row.count, 0) || 1
    return vectors.slice(0, 5).map((row, index) => ({
      ...row,
      percentage: (row.count / total) * 100,
      color: ATTACK_VECTOR_COLORS[index % ATTACK_VECTOR_COLORS.length],
    }))
  }, [vectors])

  const formatTime = (ts: string) => {
    const date = new Date(ts)
    return Number.isNaN(date.getTime()) ? ts : date.toLocaleString("es-ES")
  }

  const relatedAlertCount = useMemo(() => {
    if (!selectedAlert || !isGroupableAttackType(selectedAlert.type)) return 1
    return alerts.filter((alert) => belongsToAlertGroup(alert, selectedAlert)).length
  }, [alerts, selectedAlert])
  const selectedAlertMl = useMemo(
    () => (selectedAlert ? deriveAlertMlSignals(selectedAlert, relatedAlertCount) : null),
    [relatedAlertCount, selectedAlert],
  )
  const averageAlertConfidence = useMemo(() => {
    if (alerts.length === 0) return 0
    const total = alerts.reduce((sum, alert) => sum + deriveAlertMlSignals(alert).confidencePct, 0)
    return total / alerts.length
  }, [alerts])
  const groupedCandidates = useMemo(
    () => alerts.filter((alert) => isGroupableAttackType(alert.type)).length,
    [alerts],
  )

  const handlesAlertGroup = Boolean(selectedAlert && isGroupableAttackType(selectedAlert.type) && relatedAlertCount > 1)

  const handleToggleAcknowledge = useCallback(async () => {
    if (!selectedAlert) return
    try {
      setAckLoadingId(selectedAlert.id)
      if (handlesAlertGroup) {
        await updateAlertGroupAcknowledgement({
          type: selectedAlert.type,
          source_ip: selectedAlert.source_ip,
          target_ip: selectedAlert.target_ip,
          anchor_timestamp: selectedAlert.timestamp,
          acknowledged: !selectedAlert.acknowledged,
        })
      } else {
        if (selectedAlert.acknowledged) {
          await unacknowledgeAlert(selectedAlert.id)
        } else {
          await acknowledgeAlert(selectedAlert.id)
        }
      }
      await load()
      setConfirmDialogOpen(false)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : selectedAlert.acknowledged
            ? "No se pudo anular el reconocimiento de la alerta"
            : "No se pudo reconocer la alerta",
      )
    } finally {
      setAckLoadingId(null)
    }
  }, [handlesAlertGroup, load, selectedAlert])

  const dialogActionLabel = selectedAlert?.acknowledged ? "Anular" : "Reconocer"
  const dialogDescription = selectedAlert
    ? selectedAlert.acknowledged
      ? handlesAlertGroup
        ? `Seguro quieres realizar esta acción? Se anulará el seguimiento del grupo y ${relatedAlertCount} alertas volverán a quedar abiertas.`
        : "Seguro quieres realizar esta acción? La alerta volverá a quedar como abierta para continuar su seguimiento."
      : handlesAlertGroup
        ? `Seguro quieres realizar esta acción? Se marcará como visualizado todo el grupo asociado a este evento (${relatedAlertCount} alertas relacionadas).`
        : "Seguro quieres realizar esta acción? La alerta quedará marcada como ya visualizada."
    : "Seguro quieres realizar esta acción?"

  return (
    <DashboardLayout>
      <Header />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Centro de alertas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Prioriza eventos detectados por severidad, estado y tipo de ataque a partir de la colección{" "}
              <code className="rounded bg-muted px-1">alerts</code>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Contexto temporal heredado del panel: <span className="font-medium text-foreground">{rangeLabel}</span>
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            <Button variant="outline" size="sm" className="border-border/40" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <div className="w-full overflow-x-auto">
              <div className="inline-flex whitespace-nowrap rounded-lg border border-border/40 bg-card p-1">
                {(["Todas", "Críticas", "Altas", "Reconocidas"] as const).map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 shrink-0 px-4",
                      filter === option
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    onClick={() => {
                      setFilter(option)
                      setCurrentPage(1)
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-300">
              {ACTIVE_ML_MODEL.serviceName}
            </span>
            <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {activeMlModel?.modelVersion ?? ACTIVE_ML_MODEL.modelVersion}
            </span>
            <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              scoring + priorización operativa
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Capa ML sobre el flujo de alertas
              </p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">
                Priorización asistida por modelo dentro de la misma vista
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                En lugar de abrir otro módulo, esta pantalla mostraría cómo <code className="rounded bg-background/60 px-1">Guard-logs-ML</code>{" "}
                enriquecería cada alerta con confianza, modelo activo y criterio de correlación antes de persistir el resumen en{" "}
                <code className="rounded bg-background/60 px-1">logguard_ml.ml_runs</code>.
              </p>
              {latestMlRun && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Última corrida: <span className="font-medium text-foreground">{latestMlRun.modelVersion}</span> sobre{" "}
                  {latestMlRun.totalScored.toLocaleString()} logs, con {latestMlRun.suspiciousCount.toLocaleString()} priorizados.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alertas enriquecidas</p>
                <p className="mt-2 text-sm font-medium text-foreground">{alerts.length.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Confianza media</p>
                <p className="mt-2 text-sm font-medium text-foreground">{averageAlertConfidence.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Candidatas a correlación</p>
                <p className="mt-2 text-sm font-medium text-foreground">{groupedCandidates.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Activas</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{loading ? "—" : stats.active}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#14b8a6]/20">
                <Siren className="h-5 w-5 text-[#14b8a6]" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Críticas</p>
                <p className="mt-1 text-3xl font-bold text-[#ef4444]">{loading ? "—" : stats.critical}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ef4444]/20">
                <ShieldAlert className="h-5 w-5 text-[#ef4444]" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Altas</p>
                <p className="mt-1 text-3xl font-bold text-[#f59e0b]">{loading ? "—" : stats.high}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f59e0b]/20">
                <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reconocidas</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{loading ? "—" : stats.acknowledged}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#64748b]/20">
                <CheckCircle2 className="h-5 w-5 text-[#94a3b8]" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-foreground">
              Distribución de alertas activas
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Muestra cómo se distribuyen las alertas activas por tipo de ataque.
            </p>
            <div className="h-[260px]">
              {vectorRows.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sin datos de distribución de alertas para este entorno.
                </p>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 sm:flex-row">
                  <div className="relative h-[220px] w-full sm:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={vectorRows}
                          dataKey="count"
                          nameKey="type"
                          innerRadius={62}
                          outerRadius={96}
                          paddingAngle={4}
                          stroke="transparent"
                        >
                          {vectorRows.map((entry) => (
                            <Cell key={entry.type} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<AlertDistributionTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-semibold text-foreground">{stats.active.toLocaleString()}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Alertas activas</span>
                    </div>
                  </div>

                  <div className="flex w-full flex-1 flex-col justify-center gap-3 sm:w-auto">
                    {vectorRows.map((row) => (
                      <div key={row.type} className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="truncate font-medium text-foreground">{row.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.count.toLocaleString()} alertas · {row.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Vectores principales</h3>
            <div className="space-y-4">
              {vectorRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos de distribución.</p>
              ) : (
                vectorRows.map((row) => (
                  <div key={row.type}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm text-foreground">{row.type}</span>
                      <span className="text-sm text-muted-foreground">{row.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background/40">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, row.percentage)}%`, backgroundColor: row.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-background/30">
                    <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Severidad
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Hora
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      SRC IP
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Tipo de ataque
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                        Cargando…
                      </td>
                    </tr>
                  ) : paginatedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                        No hay alertas para el filtro actual.
                      </td>
                    </tr>
                  ) : (
                    paginatedAlerts.map((alert) => {
                      const isSelected = selectedAlert?.id === alert.id
                      return (
                        <tr
                          key={alert.id}
                          className={cn(
                            "cursor-pointer border-b border-border/30 transition-colors hover:bg-background/30",
                            isSelected && "bg-slate-200/80 dark:bg-white/10",
                          )}
                          onClick={() => setSelectedAlertId(alert.id)}
                        >
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                "flex w-fit items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium",
                                alertSeverityClass(alert.severity),
                              )}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {alertSeverityLabel(alert.severity)}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-muted-foreground">{formatTime(alert.timestamp)}</td>
                          <td className="px-5 py-4 font-mono text-sm text-foreground">{alert.source_ip}</td>
                          <td className="px-5 py-4 text-sm font-medium text-foreground">{alert.type}</td>
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                "flex items-center gap-1.5 text-sm",
                                alert.acknowledged ? "text-[#64748b]" : "text-[#ef4444]",
                              )}
                            >
                              {alert.acknowledged ? <Lock className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              {alert.acknowledged ? "Reconocida" : "Abierta"}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 px-5 py-4">
              <span className="text-sm text-muted-foreground">
                Página {activePage}/{totalPages} — {filteredAlerts.length} alertas
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border/40 bg-background/40"
                  disabled={activePage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, Math.min(page, totalPages) - 1))}
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border/40 bg-background/40"
                  disabled={activePage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, Math.min(page, totalPages) + 1))}
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Detalle de alerta</h3>
                <p className="mt-1 text-xs text-muted-foreground">Selecciona una alerta para revisar su contexto y decidir su estado.</p>
              </div>
              {selectedAlert && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border/40"
                  disabled={ackLoadingId === selectedAlert.id}
                  onClick={() => setConfirmDialogOpen(true)}
                >
                  {ackLoadingId === selectedAlert.id
                    ? selectedAlert.acknowledged
                      ? "Anulando..."
                      : "Reconociendo..."
                    : selectedAlert.acknowledged
                      ? handlesAlertGroup
                        ? "Anular grupo"
                        : "Anular"
                      : handlesAlertGroup
                        ? "Reconocer grupo"
                        : "Reconocer"}
                </Button>
              )}
            </div>

            {selectedAlert ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-background/40 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Severidad</p>
                    <div className="mt-2">
                      <span
                        className={cn(
                          "flex w-fit items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium",
                          alertSeverityClass(selectedAlert.severity),
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {alertSeverityLabel(selectedAlert.severity)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-background/40 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                    <p className="mt-2 text-sm text-foreground">
                      {selectedAlert.acknowledged ? "Reconocida" : "Abierta"}
                    </p>
                  </div>
                </div>

                {selectedAlertMl && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Motor de detección</p>
                      <p className="mt-2 text-sm text-foreground">{selectedAlertMl.source}</p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Confianza ML</p>
                      <p className="mt-2 text-sm text-foreground">{selectedAlertMl.confidencePct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Modelo</p>
                      <p className="mt-2 text-sm text-foreground">{selectedAlertMl.modelVersion}</p>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-background/40 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Timestamp</p>
                  <p className="mt-2 font-mono text-sm text-foreground">{formatTime(selectedAlert.timestamp)}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-background/40 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Source IP</p>
                    <p className="mt-2 font-mono text-sm text-foreground">{selectedAlert.source_ip}</p>
                  </div>
                  <div className="rounded-lg bg-background/40 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Target IP</p>
                    <p className="mt-2 font-mono text-sm text-foreground">{selectedAlert.target_ip}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-background/40 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo detectado</p>
                  <div className="mt-2">
                    <span className={cn("rounded px-2.5 py-1 text-xs font-medium", labelBadgeClass(selectedAlert.type))}>
                      {selectedAlert.type}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-background/40 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</p>
                  <p className="mt-2 text-sm text-foreground">{selectedAlert.message}</p>
                </div>

                {selectedAlertMl && (
                  <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-sky-300">Justificación ML</p>
                    <p className="mt-2 text-sm text-foreground">{selectedAlertMl.rationale}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Corrida de referencia: <span className="font-medium text-foreground">{selectedAlertMl.runLabel}</span>
                    </p>
                  </div>
                )}

                {handlesAlertGroup && (
                  <div className="rounded-lg border border-[#f59e0b]/25 bg-[#f59e0b]/8 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-[#f59e0b]">Seguimiento agrupado</p>
                    <p className="mt-2 text-sm text-foreground">
                      Este evento se gestiona como un grupo DDoS de {relatedAlertCount} alertas con el mismo origen,
                      destino y tipo. La acción de reconocer o anular se aplica a todas en una sola operación.
                    </p>
                  </div>
                )}

                <div className="rounded-lg bg-background/40 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Log relacionado</p>
                  <p className="mt-2 font-mono text-sm text-foreground">{selectedAlert.log_id}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay alerta seleccionada.</p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogActionLabel} seguimiento de alerta</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(ackLoadingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={Boolean(ackLoadingId)} onClick={() => void handleToggleAcknowledge()}>
              {ackLoadingId ? "Procesando..." : dialogActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
