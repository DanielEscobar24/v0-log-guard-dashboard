"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Pause, Play, Monitor, RefreshCw } from "lucide-react"
import { getLogs, type BackendLog } from "@/lib/api"
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

export default function LiveLogsPage() {
  const [logs, setLogs] = useState<BackendLog[]>([])
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await getLogs({ limit: 50, page: 1 })
      setLogs(res.logs)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar logs")
    } finally {
      setLoading(false)
    }
  }, [])

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
  const normalPercent = logs.length ? ((normalCount / logs.length) * 100).toFixed(1) : "0"
  const threatPercent = logs.length ? ((threatCount / logs.length) * 100).toFixed(1) : "0"

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
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="border-border/40"
              onClick={() => void load()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <div className="flex justify-end gap-2 sm:justify-start">
              <Button
                variant="outline"
                className={cn("h-10 w-10 p-0", !isLive ? "border-primary/30 bg-primary/10" : "border-border/40 bg-card")}
                onClick={() => setIsLive(false)}
              >
                <Pause className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "h-10 w-10 p-0",
                  isLive ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/40 bg-card",
                )}
                onClick={() => setIsLive(true)}
              >
                <Play className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error} — Revisa <code className="rounded bg-muted px-1">API_GATEWAY_URL</code> en
            Vercel o que el api-log-guard esté corriendo en `localhost:4000`.
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background/30">
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Timestamp
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    SRC IP
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    DST IP
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Proto
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Duración (s)
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Label
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Detalles
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => {
                    const rowKey = `${log.id}-${index}`
                    return (
                    <Fragment key={rowKey}>
                      <tr
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-background/30",
                          index === 0 && isLive && "animate-in fade-in duration-500",
                          expandedLog === rowKey && "bg-background/30",
                        )}
                        onClick={() => setExpandedLog(expandedLog === rowKey ? null : rowKey)}
                      >
                        <td className="px-5 py-4 font-mono text-sm text-muted-foreground">{formatTime(log.timestamp)}</td>
                        <td
                          className={cn(
                            "px-5 py-4 font-mono text-sm font-medium",
                            log.label !== "Benign" ? "text-[#ef4444]" : "text-[#00b4ff]",
                          )}
                        >
                          {log.src_ip}
                        </td>
                        <td className="px-5 py-4 font-mono text-sm text-foreground">{log.dst_ip}</td>
                        <td className="px-5 py-4">
                          <span className={cn("rounded border px-2.5 py-1 text-xs font-medium", protoClass(log.protocol))}>
                            {log.protocol}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{log.duration?.toFixed(3) ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className={cn("rounded px-2.5 py-1 text-xs font-medium", labelBadgeClass(log.label))}>
                            {log.label === "Benign" ? "Normal" : log.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {expandedLog === rowKey ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </td>
                      </tr>
                      {expandedLog === rowKey && (
                        <tr>
                          <td colSpan={7} className="bg-background/40 px-5 py-4">
                            <div className="mb-3 flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Documento (API)
                              </span>
                            </div>
                            <pre className="overflow-x-auto rounded-lg border border-border/40 bg-card p-4 font-mono text-xs text-muted-foreground">
                              {JSON.stringify(log, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{logs.length ? `Mostrando ${logs.length} eventos (API)` : "Sin datos"}</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#14b8a6]" />
              {normalPercent}% Normal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
              {threatPercent}% Amenaza
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
