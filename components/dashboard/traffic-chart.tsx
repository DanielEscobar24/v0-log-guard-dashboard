"use client"

import { useId, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatTrafficBucketFullLabel } from "@/lib/traffic-time"
import type { FilteredTimelineBucket } from "@/lib/api"

export interface TrafficChartPoint extends FilteredTimelineBucket {
  time: string
}

interface TrafficChartProps {
  data?: TrafficChartPoint[]
  totalFlows: number
  totalAttacks: number
  totalHighRisk: number
}

function formatAxisCount(value: number): string {
  const v = Number(value)
  if (!Number.isFinite(v)) return ""
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return String(Math.round(v))
}

function formatPreviewLabel(label: string) {
  return label === "Benign" ? "Normal" : label
}

function padTrafficChartData(points: TrafficChartPoint[]): TrafficChartPoint[] {
  if (points.length === 0) return []
  if (points.length >= 2) return points
  const p = points[0]
  return [
    { ...p, time: " " },
    p,
  ]
}

function TimelineTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: TrafficChartPoint }>
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null
  const row = payload[0].payload

  return (
    <div className="w-[280px] rounded-lg border border-border bg-popover px-3 py-3 text-sm shadow-md">
      <p className="mb-2 text-xs text-muted-foreground">
        {row.timestamp ? formatTrafficBucketFullLabel(row.timestamp) : row.time}
      </p>
      <div className="space-y-1 text-sm">
        <p className="text-foreground">Total: {row.total.toLocaleString()}</p>
        <p className="text-[#ff5d7d]">Attacks: {row.attacks.toLocaleString()}</p>
        <p className="text-[#ffb020]">High Risk: {row.highRisk.toLocaleString()}</p>
      </div>
      {row.preview.length > 0 && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Vista rápida del bucket</p>
          <div className="space-y-2">
            {row.preview.map((log) => (
              <div key={log.id} className="rounded-md bg-background/50 px-2 py-1.5">
                <p className="font-mono text-[11px] text-foreground">
                  {log.src_ip} → {log.dst_ip}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {log.protocol} · {formatPreviewLabel(log.label)} · {log.severity}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TrafficChart({ data = [], totalFlows, totalAttacks, totalHighRisk }: TrafficChartProps) {
  const gradientId = useId().replace(/:/g, "")
  const chartData = useMemo(() => padTrafficChartData(data), [data])
  const maxValue = useMemo(
    () => Math.max(1, ...data.map((point) => Math.max(point.total, point.attacks, point.highRisk))),
    [data],
  )

  return (
    <div className="bg-card rounded-xl border border-border/40 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Comportamiento del rango seleccionado
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Resume el volumen del lote filtrado y cómo evoluciona el riesgo dentro del periodo elegido.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Flows</p>
            <p className="text-lg font-semibold text-foreground">{totalFlows.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Attacks</p>
            <p className="text-lg font-semibold text-[#ff5d7d]">{totalAttacks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">High Risk</p>
            <p className="text-lg font-semibold text-[#ffb020]">{totalHighRisk.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#dce8ff]" />
          <span className="text-muted-foreground">Total flows</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5d7d]" />
          <span className="text-muted-foreground">Attacks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffb020]" />
          <span className="text-muted-foreground">High risk</span>
        </div>
      </div>

      <div className="h-[300px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No hay suficientes datos en el rango actual para construir la serie temporal.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`totalGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dce8ff" stopOpacity={0.36} />
                  <stop offset="100%" stopColor="#dce8ff" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id={`attackGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff5d7d" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#ff5d7d" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id={`highRiskGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffb020" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#ffb020" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickMargin={8}
                interval={chartData.length > 16 ? Math.floor(chartData.length / 8) : "preserveStartEnd"}
                minTickGap={18}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickFormatter={formatAxisCount}
                width={42}
                domain={[0, Math.ceil(maxValue * 1.15)]}
                allowDecimals={false}
              />
              <Tooltip content={<TimelineTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#dce8ff"
                strokeWidth={2.25}
                fill={`url(#totalGradient-${gradientId})`}
                isAnimationActive={false}
                activeDot={{ r: 5, fill: "#dce8ff", stroke: "var(--background)", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="attacks"
                stroke="#ff5d7d"
                strokeWidth={2.25}
                fill={`url(#attackGradient-${gradientId})`}
                isAnimationActive={false}
                activeDot={{ r: 5, fill: "#ff5d7d", stroke: "var(--background)", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="highRisk"
                stroke="#ffb020"
                strokeWidth={2.25}
                fill={`url(#highRiskGradient-${gradientId})`}
                isAnimationActive={false}
                activeDot={{ r: 5, fill: "#ffb020", stroke: "var(--background)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
