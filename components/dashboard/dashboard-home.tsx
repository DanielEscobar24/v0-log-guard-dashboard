"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DateRange } from "react-day-picker"
import { Header } from "@/components/layout/header"
import { KPICard } from "@/components/dashboard/kpi-card"
import { LiveStreamTable } from "@/components/dashboard/live-stream-table"
import { TrafficChart, type TrafficChartPoint } from "@/components/dashboard/traffic-chart"
import {
  ProtocolDistributionPanel,
  SeverityBreakdownPanel,
  TopAttackTypesPanel,
  TopSourceIPsPanel,
} from "@/components/dashboard/sidebar-panels"
import {
  getAttackDistribution,
  getActiveMlModel,
  getDashboardStats,
  getFilteredTimeline,
  getProtocolStats,
  getTopSources,
  type AttackTypeRow,
  type DashboardRangeParams,
  type DashboardStats,
  type FilteredTimelineBucket,
  type MlActiveModel,
  type ProtocolStatRow,
  type TopSourceRow,
} from "@/lib/api"
import { getDefaultDashboardRange, loadDashboardRange, saveDashboardRange } from "@/lib/dashboard-range"
import { ACTIVE_ML_MODEL, deriveMlOverview } from "@/lib/ml-insights"
import { subscribeMlRunEvents } from "@/lib/ml-run-events"

const ATTACK_TYPE_COLORS: Record<string, string> = {
  ddos: "#ff7a1a",
  "port scan": "#00c2ff",
  portscan: "#00c2ff",
  "brute force": "#a855f7",
  bruteforce: "#a855f7",
  "web attack": "#8b5cf6",
  "sql injection": "#7c3aed",
  bot: "#ec4899",
  botnet: "#ec4899",
  infiltration: "#ffe066",
  heartbleed: "#dc2626",
  suspicious: "#7df9ff",
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff4d6d",
  high: "#ff9f1c",
  medium: "#00c2ff",
  low: "#7dffb3",
}

const FALLBACK_COLORS = ["#19e6cf", "#ff7a1a", "#00c2ff", "#a855f7", "#ff4d6d", "#ffe066"]

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
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

function attacksToPanelData(rows: AttackTypeRow[], total: number) {
  const t = total > 0 ? total : rows.reduce((a, b) => a + b.count, 0) || 1
  return rows.slice(0, 6).map((row, i) => ({
    name: row.type,
    value: row.count,
    percentage: Math.round((row.count / t) * 1000) / 10,
    color: ATTACK_TYPE_COLORS[row.type.toLowerCase()] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }))
}

function distributionToPanelData(
  rows: Record<string, number> | undefined,
  colorsByKey: Record<string, string>,
) {
  const entries = Object.entries(rows ?? {})
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])

  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1

  return entries.map(([name, value], index) => ({
    name,
    value,
    percentage: (value / total) * 100,
    color: colorsByKey[name.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }))
}

function protocolsToPanelData(rows: ProtocolStatRow[]) {
  return rows.slice(0, 5).map((row, index) => ({
    name: row.protocol || "Unknown",
    total: row.total,
    attacks: row.attacks,
    attackShare: row.total > 0 ? (row.attacks / row.total) * 100 : 0,
    color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }))
}

function timelineToChartData(rows: FilteredTimelineBucket[]): TrafficChartPoint[] {
  return rows.map((row) => ({
    ...row,
    time: row.timestamp.slice(11, 16),
  }))
}

export function DashboardHome() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getDefaultDashboardRange)
  const [hasHydratedRange, setHasHydratedRange] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [attacks, setAttacks] = useState<AttackTypeRow[]>([])
  const [sources, setSources] = useState<TopSourceRow[]>([])
  const [protocols, setProtocols] = useState<ProtocolStatRow[]>([])
  const [timeline, setTimeline] = useState<FilteredTimelineBucket[]>([])
  const [activeMlModel, setActiveMlModel] = useState<MlActiveModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const rangeParams = useMemo<DashboardRangeParams | undefined>(() => {
    if (!selectedRange.from || !selectedRange.to) return undefined

    return {
      from: formatDateTimeRange(formatDateInput(selectedRange.from)),
      to: formatDateTimeRange(formatDateInput(selectedRange.to), true),
    }
  }, [selectedRange.from, selectedRange.to])

  const load = useCallback(async () => {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId

    setError(null)
    const results = await Promise.allSettled([
      getDashboardStats(rangeParams),
      getAttackDistribution(rangeParams),
      getTopSources(8, rangeParams),
      getProtocolStats(rangeParams),
      getFilteredTimeline(rangeParams),
    ])

    if (requestSequence.current !== requestId) {
      return
    }

    const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined
    if (err) {
      setError(err.reason instanceof Error ? err.reason.message : String(err.reason))
    }
    if (results[0].status === "fulfilled") setStats(results[0].value)
    if (results[1].status === "fulfilled") setAttacks(results[1].value)
    if (results[2].status === "fulfilled") setSources(results[2].value)
    if (results[3].status === "fulfilled") setProtocols(results[3].value)
    if (results[4].status === "fulfilled") setTimeline(results[4].value)
  }, [rangeParams])

  const loadActiveModel = useCallback(async () => {
    try {
      setActiveMlModel(await getActiveMlModel())
    } catch {
      setActiveMlModel(null)
    }
  }, [])

  useEffect(() => {
    setSelectedRange(loadDashboardRange())
    setHasHydratedRange(true)
  }, [])

  useEffect(() => {
    if (!hasHydratedRange) return
    saveDashboardRange(selectedRange)
  }, [hasHydratedRange, selectedRange])

  useEffect(() => {
    if (!hasHydratedRange) return
    void load()
    void loadActiveModel()
  }, [hasHydratedRange, load, loadActiveModel])

  useEffect(() => {
    return subscribeMlRunEvents(() => {
      void load()
      void loadActiveModel()
    })
  }, [load, loadActiveModel])

  const attackTotal = stats ? stats.totalAttacks : 0
  const severityDistribution = distributionToPanelData(stats?.bySeverity, SEVERITY_COLORS)
  const criticalCount =
    (stats?.bySeverity?.critical ?? 0) + (stats?.bySeverity?.high ?? 0)
  const dominantProtocol = protocols[0]
  const dominantProtocolShare = dominantProtocol?.total && stats?.totalLogs
    ? ((dominantProtocol.total / stats.totalLogs) * 100).toFixed(2)
    : "0.00"
  const leadingSource = sources[0]
  const mlOverview = useMemo(
    () => deriveMlOverview({ stats, attacks, sources, protocols }),
    [attacks, protocols, sources, stats],
  )

  return (
    <>
      <Header />

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>API:</strong> {error}. En local arranca el api-log-guard en el puerto `4000`; en
            Vercel define <code className="rounded bg-muted px-1">API_GATEWAY_URL</code> con la URL
            pública del backend y vuelve a desplegar.
          </div>
        )}

        <div className="mb-6">
          <LiveStreamTable
            initialRange={selectedRange}
            onRangeApply={(range) => setSelectedRange(range)}
            onMlRunComplete={() => {
              void load()
              void loadActiveModel()
            }}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="overflow-hidden rounded-xl border border-sky-500/20 bg-[linear-gradient(180deg,rgba(14,165,233,0.10),rgba(15,23,42,0.02))] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-300">
                {ACTIVE_ML_MODEL.serviceName}
              </span>
              <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {activeMlModel?.inferenceMode ?? ACTIVE_ML_MODEL.inferenceMode}
              </span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Modelo ML activo</p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">
                {activeMlModel?.modelVersion ?? ACTIVE_ML_MODEL.modelVersion} · {activeMlModel?.modelType ?? ACTIVE_ML_MODEL.modelType}
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Esta capa ya representa la integración prevista sin abrir otra vista: un servicio dedicado entrena,
                versiona y puntúa eventos antes de enriquecer <code className="rounded bg-background/60 px-1">logs</code>,
                <code className="ml-1 rounded bg-background/60 px-1">alerts</code> y un resumen persistido en
                <code className="ml-1 rounded bg-background/60 px-1">logguard_ml.ml_runs</code>.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Dataset base</p>
                <p className="mt-2 text-sm text-foreground">{activeMlModel?.trainingDataset ?? ACTIVE_ML_MODEL.trainingDataset}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">F1 de referencia</p>
                <p className="mt-2 text-sm text-foreground">{((activeMlModel?.referenceF1 ?? ACTIVE_ML_MODEL.referenceF1) * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Señal dominante</p>
                <p className="mt-2 text-sm text-foreground">{mlOverview.topSignal}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Salida esperada</p>
                <p className="mt-2 text-sm text-foreground">{mlOverview.outputTarget}</p>
              </div>
            </div>
          </div>

          <KPICard
            title="Eventos Priorizados"
            value={`${mlOverview.suspiciousCount}/${mlOverview.totalLogs || 0}`}
            titleClassName="text-sky-300"
            valueClassName="text-sky-300"
            subtitle={`${mlOverview.suspiciousCount.toLocaleString()} flujos pasarían a correlación o alerta si el modelo se ejecuta sobre el rango.`}
            detail={`Origen líder: ${mlOverview.topSource}. Protocolo dominante: ${mlOverview.dominantProtocol}.`}
          />

          <KPICard
            title="Confianza Esperada"
            value={`${mlOverview.averageConfidencePct.toFixed(1)}%`}
            titleClassName="text-[#14b8a6]"
            valueClassName="text-[#14b8a6]"
            subtitle={`Latencia estimada de corrida batch: ${mlOverview.inferenceLatencyMs} ms.`}
            detail={`Modo de detección: ${mlOverview.detectionMode}.`}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <TrafficChart
              data={timelineToChartData(timeline)}
              totalFlows={stats?.totalLogs ?? 0}
              totalAttacks={stats?.totalAttacks ?? 0}
              totalHighRisk={criticalCount}
            />
          </div>
          <KPICard
            title="Dominant Protocol"
            value={dominantProtocol?.protocol ?? "—"}
            titleClassName="text-[#7dd3fc]"
            valueClassName="text-[#7dd3fc]"
            subtitle={`${dominantProtocolShare}% del total viaja por este protocolo.`}
            detail={
              dominantProtocol
                ? `${dominantProtocol.total.toLocaleString()} flujos observados, ${dominantProtocol.attacks.toLocaleString()} marcados como ataque.`
                : "Sin suficientes datos agregados por protocolo."
            }
          />
          <KPICard
            title="Alert Follow-up"
            value={stats ? `${stats.activeAlerts}/${stats.acknowledgedAlerts}` : "—"}
            titleClassName="text-[#f59e0b]"
            valueClassName="text-[#f8fafc]"
            subtitle={
              stats
                ? `${stats.activeAlerts.toLocaleString()} alertas siguen abiertas y ${stats.acknowledgedAlerts.toLocaleString()} ya fueron reconocidas.`
                : "Sin resumen operativo de alertas."
            }
            detail="Este bloque refleja seguimiento operativo; reconocer alertas no elimina el ataque detectado de los logs."
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SeverityBreakdownPanel items={severityDistribution} />
          <ProtocolDistributionPanel items={protocolsToPanelData(protocols)} />
          <TopAttackTypesPanel items={attacksToPanelData(attacks, attackTotal)} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <TopSourceIPsPanel items={sources.map((s) => ({ ip: s.ip, flows: s.attacks, labels: s.types }))} />
          <KPICard
            title="Lead Source"
            value={leadingSource?.ip ?? "—"}
            titleClassName="text-[#c4b5fd]"
            valueClassName="text-lg text-[#c4b5fd]"
            subtitle={
              leadingSource
                ? `${leadingSource.attacks.toLocaleString()} eventos maliciosos asociados a este origen.`
                : "Sin IP de origen sospechosa para resumir."
            }
            detail={
              leadingSource
                ? `Tipos asociados: ${leadingSource.types.slice(0, 3).join(", ")}.`
                : "Aparecerá cuando existan registros clasificados como ataque."
            }
          />
        </div>
      </div>
    </>
  )
}
