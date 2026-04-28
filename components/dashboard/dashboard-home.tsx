"use client"

import { useCallback, useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { KPICard } from "@/components/dashboard/kpi-card"
import { LiveStreamTable } from "@/components/dashboard/live-stream-table"
import {
  LabelDistributionPanel,
  TopAttackTypesPanel,
  // TopSourceIPsPanel,
} from "@/components/dashboard/sidebar-panels"
import {
  getAttackDistribution,
  getDashboardStats,
  getLogs,
  getTopSources,
  type AttackTypeRow,
  type BackendLog,
  type DashboardStats,
  type TopSourceRow,
} from "@/lib/api"

const ATTACK_TYPE_COLORS: Record<string, string> = {
  ddos: "#ff7a1a",
  "port scan": "#00c2ff",
  portscan: "#00c2ff",
  "brute force": "#a855f7",
  bruteforce: "#a855f7",
  bot: "#ff4d8d",
  infiltration: "#ffe066",
  suspicious: "#7df9ff",
}

const LABEL_COLORS: Record<string, string> = {
  benign: "#19e6cf",
  normal: "#19e6cf",
  ddos: "#ff7a1a",
  "port scan": "#00c2ff",
  portscan: "#00c2ff",
  "brute force": "#a855f7",
  bruteforce: "#a855f7",
  bot: "#ff4d8d",
  infiltration: "#ffe066",
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff4d6d",
  high: "#ff9f1c",
  medium: "#00c2ff",
  low: "#7dffb3",
}

const FALLBACK_COLORS = ["#19e6cf", "#ff7a1a", "#00c2ff", "#a855f7", "#ff4d6d", "#ffe066"]

function attacksToPanelData(rows: AttackTypeRow[], total: number) {
  const t = total > 0 ? total : rows.reduce((a, b) => a + b.count, 0) || 1
  return rows.slice(0, 6).map((row, i) => ({
    name: row.type,
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

export function DashboardHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [logs, setLogs] = useState<BackendLog[]>([])
  const [attacks, setAttacks] = useState<AttackTypeRow[]>([])
  const [sources, setSources] = useState<TopSourceRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const results = await Promise.allSettled([
      getDashboardStats(),
      getLogs({ limit: 8, page: 1 }),
      getAttackDistribution(),
      getTopSources(8),
    ])
    const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined
    if (err) {
      setError(err.reason instanceof Error ? err.reason.message : String(err.reason))
    }
    if (results[0].status === "fulfilled") setStats(results[0].value)
    if (results[1].status === "fulfilled") setLogs(results[1].value.logs)
    if (results[2].status === "fulfilled") setAttacks(results[2].value)
    if (results[3].status === "fulfilled") setSources(results[3].value)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const attackTotal = stats ? stats.totalAttacks : 0
  const attackRate = stats ? Number(stats.attackRate) : 0
  const benignRate = stats && stats.totalLogs > 0 ? ((stats.totalBenign / stats.totalLogs) * 100).toFixed(2) : "0.00"
  const labelDistribution = distributionToPanelData(stats?.byLabel, LABEL_COLORS)
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

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Total_Flows"
            value={stats?.totalLogs?.toLocaleString() ?? "—"}
            titleClassName="kpi-neon-white"
            valueClassName="kpi-neon-white"
            subtitle="Registros acumulados en la colección `logs`."
            detail="Representa el volumen total cargado en la base de datos."
          />
          <KPICard
            title="Attacks"
            value={stats?.totalAttacks?.toLocaleString() ?? "—"}
            titleClassName="kpi-neon-red"
            valueClassName="kpi-neon-red"
            subtitle={`${attackRate.toFixed(2)}% del total de flujos fueron clasificados como ataque.`}
            detail="Incluye todos los labels distintos de `Normal`."
          />
          <KPICard
            title="Normal"
            value={stats?.totalBenign?.toLocaleString() ?? "—"}
            titleClassName="kpi-neon-green"
            valueClassName="kpi-neon-green"
            subtitle={`${benignRate}% del total de flujos fueron clasificados como normales.`}
            detail="Corresponde al tráfico normal acumulado en Mongo."
          />
          <LabelDistributionPanel items={labelDistribution} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-6 lg:col-span-3">
            <LiveStreamTable initialLogs={logs} />
          </div>
          <div className="space-y-6">
            <TopAttackTypesPanel items={attacksToPanelData(attacks, attackTotal)} />
            {/* <TopSourceIPsPanel
              items={sources.map((s) => ({ ip: s.ip, flows: s.attacks }))}
            /> */}
          </div>
        </div>
      </div>
    </>
  )
}
