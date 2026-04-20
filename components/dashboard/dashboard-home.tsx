"use client"

import { useCallback, useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { KPICard } from "@/components/dashboard/kpi-card"
import { TrafficChart } from "@/components/dashboard/traffic-chart"
import { LiveStreamTable } from "@/components/dashboard/live-stream-table"
import { TopAttackTypesPanel, TopSourceIPsPanel, FiltersPanel } from "@/components/dashboard/sidebar-panels"
import {
  getAttackDistribution,
  getDashboardStats,
  getLogs,
  getTopSources,
  getTrafficStats,
  type AttackTypeRow,
  type BackendLog,
  type DashboardStats,
  type TopSourceRow,
  type TrafficBucket,
} from "@/lib/api"
import { formatTrafficBucketAxisLabel } from "@/lib/traffic-time"

const COLORS = ["#00b4ff", "#8b5cf6", "#f59e0b", "#f97316", "#14b8a6", "#64748b"]

function trafficToChartData(rows: TrafficBucket[]) {
  return rows.map((r) => ({
    time: formatTrafficBucketAxisLabel(r.timestamp),
    benign: r.benign,
    attacks: r.attacks,
    bucketUtc: r.timestamp,
  }))
}

function attacksToPanelData(rows: AttackTypeRow[], total: number) {
  const t = total > 0 ? total : rows.reduce((a, b) => a + b.count, 0) || 1
  return rows.slice(0, 6).map((row, i) => ({
    name: row.type,
    percentage: Math.round((row.count / t) * 1000) / 10,
    color: COLORS[i % COLORS.length],
  }))
}

export function DashboardHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [traffic, setTraffic] = useState<TrafficBucket[]>([])
  const [logs, setLogs] = useState<BackendLog[]>([])
  const [attacks, setAttacks] = useState<AttackTypeRow[]>([])
  const [sources, setSources] = useState<TopSourceRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const results = await Promise.allSettled([
      getDashboardStats(),
      getTrafficStats(24),
      getLogs({ limit: 8, page: 1 }),
      getAttackDistribution(),
      getTopSources(8),
    ])
    const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined
    if (err) {
      setError(err.reason instanceof Error ? err.reason.message : String(err.reason))
    }
    if (results[0].status === "fulfilled") setStats(results[0].value)
    if (results[1].status === "fulfilled") setTraffic(results[1].value)
    if (results[2].status === "fulfilled") setLogs(results[2].value.logs)
    if (results[3].status === "fulfilled") setAttacks(results[3].value)
    if (results[4].status === "fulfilled") setSources(results[4].value)
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 15000)
    return () => clearInterval(id)
  }, [load])

  const attackTotal = stats ? stats.totalAttacks : 0

  return (
    <>
      <Header />

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>API:</strong> {error}. Arranca el api-gateway (p. ej. puerto 4000) y define{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_API_URL</code> en{" "}
            <code className="rounded bg-muted px-1">.env.local</code>.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <KPICard
            title="Total_Flows"
            value={stats?.totalLogs?.toLocaleString() ?? "—"}
            sparklineColor="#00b4ff"
          />
          <KPICard
            title="Attacks"
            value={stats?.totalAttacks?.toLocaleString() ?? "—"}
            sparklineColor="#f97316"
          />
          <KPICard
            title="Benign"
            value={stats?.totalBenign?.toLocaleString() ?? "—"}
            sparklineColor="#14b8a6"
          />
          <KPICard
            title="Active_Alerts"
            value={stats?.activeAlerts?.toLocaleString() ?? "—"}
            status={stats && stats.activeAlerts > 0 ? "CRITICAL" : undefined}
            sparklineColor="#ef4444"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-6 lg:col-span-3">
            <TrafficChart data={trafficToChartData(traffic)} />
            <LiveStreamTable logs={logs} onRefresh={() => void load()} />
          </div>
          <div className="space-y-6">
            <TopAttackTypesPanel items={attacksToPanelData(attacks, attackTotal)} />
            <TopSourceIPsPanel
              items={sources.map((s) => ({ ip: s.ip, flows: s.attacks }))}
            />
            <FiltersPanel />
          </div>
        </div>
      </div>
    </>
  )
}
