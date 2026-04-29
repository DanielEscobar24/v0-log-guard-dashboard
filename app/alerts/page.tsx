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
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  acknowledgeAlert,
  getAlerts,
  getAlertTrend,
  getAttackDistribution,
  unacknowledgeAlert,
  updateAlertGroupAcknowledgement,
  type AlertTrendBucket,
  type AttackTypeRow,
  type BackendAlert,
  type DashboardRangeParams,
} from "@/lib/api"
import { loadDashboardRange } from "@/lib/dashboard-range"
import { alertSeverityClass, alertSeverityLabel, labelBadgeClass } from "@/lib/label-styles"

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

export default function AlertsPage() {
  const [appliedRange, setAppliedRange] = useState<DateRange | null>(null)
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

  useEffect(() => {
    setAppliedRange(loadDashboardRange())
  }, [])

  const rangeParams: DashboardRangeParams | undefined =
    appliedRange?.from && appliedRange?.to
      ? {
          from: formatDateTimeRange(formatDateInput(appliedRange.from)),
          to: formatDateTimeRange(formatDateInput(appliedRange.to), true),
        }
      : undefined

  const rangeLabel =
    appliedRange?.from && appliedRange?.to
      ? `${appliedRange.from.toLocaleDateString("es-ES")} - ${appliedRange.to.toLocaleDateString("es-ES")}`
      : "Rango actual"

  const load = useCallback(async () => {
    try {
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
  }, [rangeParams?.from, rangeParams?.to])

  useEffect(() => {
    void load()
  }, [load])

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
  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedAlert = alerts.find((alert) => alert.id === selectedAlertId) ?? paginatedAlerts[0] ?? null

  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  useEffect(() => {
    if (!selectedAlertId && paginatedAlerts[0]?.id) {
      setSelectedAlertId(paginatedAlerts[0].id)
    }
  }, [paginatedAlerts, selectedAlertId])

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
        ? `Seguro quieres realizar esta accion? Se anulara el seguimiento del grupo y ${relatedAlertCount} alertas volveran a quedar abiertas.`
        : "Seguro quieres realizar esta accion? La alerta volvera a quedar como abierta para continuar su seguimiento."
      : handlesAlertGroup
        ? `Seguro quieres realizar esta accion? Se marcara como visualizado todo el grupo asociado a este evento (${relatedAlertCount} alertas relacionadas).`
        : "Seguro quieres realizar esta accion? La alerta quedara marcada como ya visualizada."
    : "Seguro quieres realizar esta accion?"

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
                    onClick={() => setFilter(option)}
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
              Evolución de alertas activas
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Muestra cómo se concentraron las alertas abiertas por franja temporal.
            </p>
            <div className="h-[260px]">
              {trend.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sin datos temporales de alertas para este entorno.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="alertsTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      tickFormatter={formatAlertTrendTime}
                      minTickGap={18}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<AlertTrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="activeAlerts"
                      stroke="#f59e0b"
                      strokeWidth={2.25}
                      fill="url(#alertsTrendGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
                Página {currentPage}/{totalPages} — {filteredAlerts.length} alertas
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border/40 bg-background/40"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border/40 bg-background/40"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
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

                {handlesAlertGroup && (
                  <div className="rounded-lg border border-[#f59e0b]/25 bg-[#f59e0b]/8 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-[#f59e0b]">Seguimiento agrupado</p>
                    <p className="mt-2 text-sm text-foreground">
                      Este evento se gestiona como un grupo DDoS de {relatedAlertCount} alertas con el mismo origen,
                      destino y tipo. La accion de reconocer o anular se aplica a todas en una sola operacion.
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
