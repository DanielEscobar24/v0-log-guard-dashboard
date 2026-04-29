"use client"

import { memo, useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { TrafficChart, type TrafficChartPoint } from "@/components/dashboard/traffic-chart"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { List, type RowComponentProps } from "react-window"
import { Monitor, Pause, Play } from "lucide-react"
import {
  getAlerts,
  getDashboardStats,
  getFilteredTimeline,
  getLogs,
  type AlertStatus,
  type BackendAlert,
  type BackendLog,
  type DashboardStats,
  type FilteredTimelineBucket,
} from "@/lib/api"
import { labelBadgeClass } from "@/lib/label-styles"

const protocolColors: Record<string, string> = {
  TCP: "border-[#00b4ff]/30 bg-[#00b4ff]/20 text-[#00b4ff]",
  UDP: "border-[#14b8a6]/30 bg-[#14b8a6]/20 text-[#14b8a6]",
  ICMP: "border-[#f59e0b]/30 bg-[#f59e0b]/20 text-[#f59e0b]",
  HTTPS: "border-[#8b5cf6]/30 bg-[#8b5cf6]/20 text-[#8b5cf6]",
}

function protoClass(p: string) {
  return protocolColors[p] ?? "border-border/40 bg-muted/30 text-foreground"
}

function timelineToChartData(rows: FilteredTimelineBucket[]): TrafficChartPoint[] {
  return rows.map((row) => ({
    ...row,
    time: row.timestamp.slice(11, 16),
  }))
}

const LIVE_LOG_ROW_HEIGHT = 56
const LIVE_LOG_TABLE_HEIGHT = 520
const LIVE_LOG_GRID_COLUMNS =
  "minmax(150px,1fr) minmax(180px,1fr) minmax(180px,1fr) minmax(110px,0.8fr) minmax(120px,0.9fr) minmax(140px,0.9fr)"

type LiveLogRowProps = {
  logs: EnrichedLog[]
  selectedLogId: string | null
  onSelect: (logId: string) => void
  formatTime: (timestamp: string) => string
}

type EnrichedLog = BackendLog & {
  alertStatus?: AlertStatus
  alertCount?: number
}

const LiveLogVirtualRow = memo(function LiveLogVirtualRow({
  index,
  style,
  logs,
  selectedLogId,
  onSelect,
  formatTime,
}: RowComponentProps<LiveLogRowProps>) {
  const log = logs[index]

  if (!log) return null

  const isSelected = selectedLogId === log.id

  return (
    <div
      style={style}
      className={cn(
        "cursor-pointer border-b border-border/30 transition-colors hover:bg-background/30",
        isSelected && "bg-slate-200/80 dark:bg-white/10",
      )}
      onClick={() => onSelect(log.id)}
    >
      <div className="grid h-full items-center px-5" style={{ gridTemplateColumns: LIVE_LOG_GRID_COLUMNS }}>
        <div className="pr-4 font-mono text-sm text-muted-foreground">{formatTime(log.timestamp)}</div>
        <div className="pr-4 font-mono text-sm font-medium text-foreground">{log.src_ip}</div>
        <div className="pr-4 font-mono text-sm text-foreground">{log.dst_ip}</div>
        <div className="pr-4">
          <span className={cn("rounded border px-2.5 py-1 text-xs font-medium", protoClass(log.protocol))}>
            {log.protocol}
          </span>
        </div>
        <div className="pr-4 text-sm text-muted-foreground">{log.duration?.toFixed(3) ?? "—"}</div>
        <div>
          <span className={cn("rounded px-2.5 py-1 text-xs font-medium", labelBadgeClass(log.label))}>
            {log.label === "Benign" ? "Normal" : log.label}
          </span>
          {log.alertStatus && (
            <span
              className={cn(
                "ml-2 rounded border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
                log.alertStatus === "acknowledged"
                  ? "border-[#64748b]/40 bg-[#64748b]/15 text-[#94a3b8]"
                  : "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]",
              )}
            >
              {log.alertStatus === "acknowledged" ? "Reconocida" : "Abierta"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

export default function LiveLogsPage() {
  const [logs, setLogs] = useState<EnrichedLog[]>([])
  const [timeline, setTimeline] = useState<FilteredTimelineBucket[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const enrichLogsWithAlerts = useCallback((inputLogs: BackendLog[], relatedAlerts: BackendAlert[]) => {
    const alertsByLogId = new Map<string, BackendAlert[]>()

    for (const alert of relatedAlerts) {
      if (!alert.log_id) continue
      const current = alertsByLogId.get(alert.log_id) ?? []
      current.push(alert)
      alertsByLogId.set(alert.log_id, current)
    }

    return inputLogs.map((log) => {
      const logAlerts = alertsByLogId.get(log.id) ?? []
      const hasOpen = logAlerts.some((alert) => !alert.acknowledged)
      const hasAcknowledged = logAlerts.some((alert) => alert.acknowledged)
      const alertStatus: AlertStatus | undefined = hasOpen ? "open" : hasAcknowledged ? "acknowledged" : undefined

      return {
        ...log,
        alertStatus,
        alertCount: logAlerts.length,
      }
    })
  }, [])

  const load = useCallback(async () => {
    try {
      setError(null)
      const [logsResponse, timelineResponse, statsResponse, alertsResponse] = await Promise.all([
        getLogs({ limit: 50, page: 1 }),
        getFilteredTimeline(),
        getDashboardStats(),
        getAlerts(500),
      ])
      const enrichedLogs = enrichLogsWithAlerts(logsResponse.logs, alertsResponse)
      setLogs(enrichedLogs)
      setTimeline(timelineResponse)
      setStats(statsResponse)
      setSelectedLogId((current) => current ?? enrichedLogs[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar logs")
    } finally {
      setLoading(false)
    }
  }, [enrichLogsWithAlerts])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => void load(), 8000)
    return () => clearInterval(id)
  }, [isLive, load])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return timestamp
    return date
      .toLocaleTimeString("es-ES", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      })
      .replace(",", ".")
  }

  const normalCount = logs.filter((l) => l.label === "Benign").length
  const threatCount = logs.length - normalCount
  const highRiskCount = (stats?.bySeverity?.high ?? 0) + (stats?.bySeverity?.critical ?? 0)
  const normalPercent = logs.length ? ((normalCount / logs.length) * 100).toFixed(1) : "0"
  const threatPercent = logs.length ? ((threatCount / logs.length) * 100).toFixed(1) : "0"
  const selectedLog = logs.find((log) => log.id === selectedLogId) ?? logs[0] ?? null
  const logsWithOpenAlerts = logs.filter((log) => log.alertStatus === "open").length
  const logsWithAcknowledgedAlerts = logs.filter((log) => log.alertStatus === "acknowledged").length

  return (
    <DashboardLayout>
      <Header />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logs en vivo</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#14b8a6]" />
                <span className="text-sm font-medium text-[#14b8a6]">MongoDB vía API</span>
              </span>
              <span className="text-sm text-muted-foreground">Colección `logs`</span>
              {stats && (
                <span className="text-sm text-muted-foreground">
                  Seguimiento: {stats.activeAlerts} abiertas / {stats.acknowledgedAlerts} reconocidas
                </span>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            <Button
              variant="outline"
              className={cn(
                "h-10 min-w-28 justify-center border-border/40",
                isLive
                  ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300",
              )}
              onClick={() => setIsLive((current) => !current)}
            >
              {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isLive ? "Pausar" : "Reanudar"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error} — Revisa <code className="rounded bg-muted px-1">API_GATEWAY_URL</code> en
            Vercel o que el api-log-guard esté corriendo en `localhost:4000`.
          </div>
        )}

        <div className="mb-6">
          <TrafficChart
            data={timelineToChartData(timeline)}
            totalFlows={stats?.totalLogs ?? 0}
            totalAttacks={stats?.totalAttacks ?? 0}
            totalHighRisk={highRiskCount}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
          <div
            className="grid border-b border-border/40 bg-background/30 px-5 py-4"
            style={{ gridTemplateColumns: LIVE_LOG_GRID_COLUMNS }}
          >
            <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Timestamp
            </div>
            <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              SRC IP
            </div>
            <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              DST IP
            </div>
            <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Proto
            </div>
            <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Duración (s)
            </div>
            <div className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Label
            </div>
          </div>

          {loading ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Cargando…</div>
          ) : (
            <List
              rowComponent={LiveLogVirtualRow}
              rowCount={logs.length}
              rowHeight={LIVE_LOG_ROW_HEIGHT}
              rowProps={{
                logs,
                selectedLogId,
                onSelect: setSelectedLogId,
                formatTime,
              }}
              style={{ height: LIVE_LOG_TABLE_HEIGHT, width: "100%" }}
            />
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Documento seleccionado
              </span>
            </div>
            {selectedLog ? (
              <pre className="overflow-x-auto rounded-lg border border-border/40 bg-background/40 p-4 font-mono text-xs text-muted-foreground">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un registro para ver su detalle.</p>
            )}
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Muestra en pantalla</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              La tabla muestra una ventana reciente de {logs.length.toLocaleString()} eventos y usa virtualización para mantener el
              rendimiento estable.
            </p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#14b8a6]" />
                  Normal
                </span>
                <span>{normalPercent}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                  Amenaza
                </span>
                <span>{threatPercent}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Estado de actualización</span>
                <span>{isLive ? "Automático" : "Manual"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Logs con alerta abierta</span>
                <span>{logsWithOpenAlerts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Logs con alerta reconocida</span>
                <span>{logsWithAcknowledgedAlerts}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
