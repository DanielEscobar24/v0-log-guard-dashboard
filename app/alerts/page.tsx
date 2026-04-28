"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  XCircle,
  AlertTriangle,
  Radio,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Lock,
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { getAlerts, getAttackDistribution, type BackendAlert } from "@/lib/api"
import { alertSeverityClass, alertSeverityLabel } from "@/lib/label-styles"

const threatDistributionFallback = [
  { time: "00:00", logs: 0, alerts: 0 },
  { time: "06:00", logs: 0, alerts: 0 },
  { time: "12:00", logs: 0, alerts: 0 },
]

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<BackendAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"Todas" | "Críticas" | "Altas">("Todas")
  const [currentPage, setCurrentPage] = useState(1)
  const [chartRows, setChartRows] = useState<{ name: string; percentage: number }[]>([])

  const load = useCallback(async () => {
    try {
      setError(null)
      const [al, dist] = await Promise.all([getAlerts(200), getAttackDistribution()])
      setAlerts(al)
      const total = dist.reduce((a, b) => a + b.count, 0) || 1
      setChartRows(
        dist.slice(0, 5).map((d) => ({
          name: d.type,
          percentage: Math.round((d.count / total) * 1000) / 10,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar alertas")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const open = alerts.filter((a) => !a.acknowledged)
    const sev = (s: string) => s.toLowerCase()
    return {
      totalActive: open.length,
      critical: alerts.filter((a) => sev(a.severity) === "critical").length,
      highSeverity: alerts.filter((a) => sev(a.severity) === "high").length,
      inProgress: open.length,
    }
  }, [alerts])

  const filteredAlerts = alerts.filter((alert) => {
    const s = alert.severity.toLowerCase()
    if (filter === "Todas") return true
    if (filter === "Críticas") return s === "critical"
    if (filter === "Altas") return s === "high"
    return true
  })

  const pageSize = 15
  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize))

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return Number.isNaN(d.getTime()) ? ts : d.toLocaleString("es-ES")
  }

  return (
    <DashboardLayout>
      <Header />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alertas activas de red</h1>
            <p className="mt-1 text-sm text-muted-foreground">Datos desde la colección `alerts` (api-log-guard).</p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            <Button variant="outline" size="sm" className="border-border/40" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <div className="w-full overflow-x-auto">
              <div className="inline-flex whitespace-nowrap rounded-lg border border-border/40 bg-card p-1">
                {(["Todas", "Críticas", "Altas"] as const).map((f) => (
                  <Button
                    key={f}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 shrink-0 px-4",
                      filter === f
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    onClick={() => {
                      setFilter(f)
                      setCurrentPage(1)
                    }}
                  >
                    {f}
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

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sin reconocer</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{loading ? "—" : stats.totalActive}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00b4ff]/20">
                <TrendingUp className="h-5 w-5 text-[#00b4ff]" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Críticas</p>
                <p className="mt-1 text-3xl font-bold text-[#00b4ff]">{loading ? "—" : stats.critical}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ef4444]/20">
                <XCircle className="h-5 w-5 text-[#ef4444]" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Altas</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{loading ? "—" : stats.highSeverity}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f59e0b]/20">
                <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendientes</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{loading ? "—" : stats.inProgress}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#14b8a6]/20">
                <Radio className="h-5 w-5 text-[#14b8a6]" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-xl border border-border/40 bg-card">
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
                    Descripción
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                ) : (
                  paginatedAlerts.map((alert) => (
                    <tr key={alert.id} className="transition-colors hover:bg-background/30">
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
                      <td className="px-5 py-4 font-mono text-sm text-[#00b4ff]">{alert.source_ip}</td>
                      <td className="px-5 py-4 text-sm font-medium text-foreground">{alert.type}</td>
                      <td className="max-w-xs truncate px-5 py-4 text-sm text-muted-foreground">{alert.message}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border/40 px-5 py-4">
            <span className="text-sm text-muted-foreground">
              PÁGINA {currentPage}/{totalPages} — {filteredAlerts.length} alertas
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-border/40 bg-background/40"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-border/40 bg-background/40"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Distribución de etiquetas (logs, ≠ Normal)
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatDistributionFallback} barGap={4}>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="logs" fill="#475569" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="alerts" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Gráfico placeholder; los KPI y la tabla usan datos reales de la API.
            </p>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Vectores principales (logs)</h3>
            <div className="space-y-4">
              {chartRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos de distribución.</p>
              ) : (
                chartRows.map((vector, i) => (
                  <div key={vector.name}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm text-foreground">{vector.name}</span>
                      <span className="text-sm text-muted-foreground">{vector.percentage}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background/40">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, vector.percentage)}%`,
                          backgroundColor:
                            i === 0 ? "#00b4ff" : i === 1 ? "#8b5cf6" : i === 2 ? "#f59e0b" : "#64748b",
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
