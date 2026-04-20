"use client"

import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { useId } from "react"

interface KPICardProps {
  title: string
  value: string | number
  change?: string
  trend?: 'up' | 'down'
  status?: 'CRITICAL' | 'WARNING' | 'NORMAL'
  sparklineData?: number[]
  sparklineColor?: string
}

const DEFAULT_SPARKLINE = [20, 28, 18, 35, 26, 40, 30, 34, 22, 38, 29, 33]

export function KPICard({ 
  title, 
  value, 
  change, 
  trend, 
  status,
  sparklineData,
  sparklineColor = "#00b4ff"
}: KPICardProps) {
  const gradientId = useId()
  const chartData = (sparklineData ?? DEFAULT_SPARKLINE).map((v, i) => ({ value: v, index: i }))

  return (
    <div className="bg-card rounded-xl p-5 border border-border/40 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={cn(
              "text-3xl font-bold",
              status === 'CRITICAL' ? "text-destructive" : "text-foreground"
            )}>
              {value}
            </span>
            {change && (
              <span className={cn(
                "text-sm font-medium flex items-center gap-0.5",
                trend === 'up' ? "text-[#14b8a6]" : "text-[#ef4444]"
              )}>
                {trend === 'up' ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {change}
              </span>
            )}
            {status === 'CRITICAL' && (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                <AlertTriangle className="w-3 h-3" />
                CRITICAL
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Sparkline */}
      <div className="h-12 mt-3 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={sparklineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={sparklineColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
