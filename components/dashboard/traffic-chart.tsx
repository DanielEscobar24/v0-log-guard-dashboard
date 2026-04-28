"use client"

import { useId, useMemo } from "react"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { formatTrafficBucketFullLabel } from "@/lib/traffic-time"

export interface TrafficChartPoint {
  time: string
  benign: number
  attacks: number
  /** ISO/UTC del api-log-guard (`YYYY-MM-DD HH:00`) para tooltips con fecha local. */
  bucketUtc?: string
}

interface TrafficChartProps {
  /** Si viene vacío, se muestra mensaje hasta que el API devuelva datos. */
  data?: TrafficChartPoint[]
}

/** Escala legible: sin forzar "k" con valores bajos (evita "0k" parecido a "Ok"). */
function formatAxisCount(value: number): string {
  const v = Number(value)
  if (!Number.isFinite(v)) return ""
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 10_000) return `${(v / 1000).toFixed(0)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

/**
 * Recharts no dibuja bien un Area con 1 solo punto (path degenerado).
 * Añadimos un punto hermano a la izquierda para formar un segmento horizontal visible.
 */
function padTrafficChartData(points: TrafficChartPoint[]): TrafficChartPoint[] {
  if (points.length === 0) return []
  if (points.length >= 2) return points
  const p = points[0]
  return [
    { time: " ", benign: p.benign, attacks: p.attacks, bucketUtc: p.bucketUtc },
    { time: p.time, benign: p.benign, attacks: p.attacks, bucketUtc: p.bucketUtc },
  ]
}

function TrafficTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: TrafficChartPoint; value?: number; dataKey?: string | number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const title = row?.bucketUtc ? formatTrafficBucketFullLabel(row.bucketUtc) : label
  return (
    <div
      className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md"
      style={{ color: "var(--popover-foreground)" }}
    >
      <p className="mb-2 text-xs text-muted-foreground">{title}</p>
      {payload.map((entry, i) => {
        const key = String(entry.dataKey ?? "")
        const v = Number(entry.value)
        if (key === "benign") {
          return (
            <p key={i} className="text-[#00b4ff]">
              Benign: {v.toLocaleString()} events
            </p>
          )
        }
        if (key === "attacks") {
          return (
            <p key={i} className="text-[#f59e0b]">
              Attacks: {v.toLocaleString()} alerts
            </p>
          )
        }
        return null
      })}
    </div>
  )
}

export function TrafficChart({ data = [] }: TrafficChartProps) {
  const gradientId = useId().replace(/:/g, "")

  const chartData = useMemo(() => padTrafficChartData(data), [data])

  const { maxBenign, maxAttacks } = useMemo(() => {
    const rows = data.length > 0 ? data : []
    const mb = Math.max(0, ...rows.map((d) => d.benign), 1)
    const ma = Math.max(0, ...rows.map((d) => d.attacks), 1)
    return {
      maxBenign: Math.ceil(mb * 1.12) || 1,
      maxAttacks: Math.ceil(ma * 1.12) || 1,
    }
  }, [data])

  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Network Traffic Volume Over Time
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ventana: <strong>histórico completo</strong> · Inicio: primer registro disponible · Fin: último registro disponible
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs sm:mt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00b4ff]" />
            <span className="text-muted-foreground">Benign</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
            <span className="text-muted-foreground">Attacks</span>
          </div>
        </div>
      </div>
      
      <div className="h-[240px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin datos de tráfico aún (o el gateway no responde). Comprueba{" "}
            <code className="mx-1 rounded bg-muted px-1">GET /api/stats/traffic</code>.
          </p>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 14, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={`benignGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00b4ff" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#00b4ff" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id={`attackGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickMargin={8}
              interval={chartData.length > 14 ? Math.floor(chartData.length / 8) : "preserveStartEnd"}
              minTickGap={16}
              tickFormatter={(v) => (typeof v === "string" && v.trim() === "" ? "" : String(v))}
            />
            <YAxis 
              yAxisId="benign"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              domain={[0, maxBenign]}
              allowDecimals={false}
              label={{
                value: "Benign (events)",
                angle: -90,
                position: "insideLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
              tickFormatter={formatAxisCount}
              tickMargin={10}
              width={48}
            />
            <YAxis
              yAxisId="attacks"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
              domain={[0, maxAttacks]}
              allowDecimals={false}
              label={{
                value: "Attacks (alerts)",
                angle: 90,
                position: "insideRight",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
              tickFormatter={formatAxisCount}
              tickMargin={10}
              width={44}
            />
            <Tooltip content={TrafficTooltipContent} />
            <Area
              yAxisId="benign"
              type="linear"
              dataKey="benign"
              stroke="#00b4ff"
              strokeWidth={2.5}
              fill={`url(#benignGradient-${gradientId})`}
              isAnimationActive={false}
              dot={{
                r: data.length <= 12 ? 5 : 0,
                strokeWidth: 2,
                stroke: "var(--background)",
                fill: "#00b4ff",
              }}
              activeDot={{ r: 6 }}
            />
            <Area
              yAxisId="attacks"
              type="linear"
              dataKey="attacks"
              stroke="#f59e0b"
              strokeWidth={2.5}
              fill={`url(#attackGradient-${gradientId})`}
              isAnimationActive={false}
              dot={{
                r: data.length <= 12 ? 5 : 0,
                strokeWidth: 2,
                stroke: "var(--background)",
                fill: "#f59e0b",
              }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
