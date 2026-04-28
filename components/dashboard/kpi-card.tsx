"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  detail?: string
  status?: "CRITICAL" | "WARNING" | "NORMAL"
  titleClassName?: string
  valueClassName?: string
}

export function KPICard({ title, value, subtitle, detail, status, titleClassName, valueClassName }: KPICardProps) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-xs font-medium uppercase tracking-wider", titleClassName ?? "text-muted-foreground")}>
            {title}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={cn(
                "text-3xl font-bold",
                valueClassName ?? (status === "CRITICAL" ? "text-destructive" : "text-foreground"),
              )}
            >
              {value}
            </span>
            {status === "CRITICAL" && (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                <AlertTriangle className="w-3 h-3" />
                CRITICAL
              </span>
            )}
          </div>
          {subtitle && <p className="mt-3 text-sm text-foreground">{subtitle}</p>}
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
    </div>
  )
}
