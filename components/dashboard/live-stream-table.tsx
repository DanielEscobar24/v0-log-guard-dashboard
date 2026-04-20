"use client"

import { Download, Settings, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BackendLog } from "@/lib/api"
import { labelBadgeClass } from "@/lib/label-styles"

interface LiveStreamTableProps {
  logs: BackendLog[]
  onRefresh?: () => void
}

export function LiveStreamTable({ logs, onRefresh }: LiveStreamTableProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return timestamp
    return date.toLocaleTimeString("es-ES", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="bg-card rounded-xl border border-border/40">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          CICIDS-2017 — últimos registros (Mongo)
        </h3>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => onRefresh()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-background/30">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Timestamp
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                SRC IP
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                DST IP
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Proto
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Duración (s)
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Label
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No hay logs. Verifica que el api-gateway esté en marcha y que la colección{" "}
                  <code className="rounded bg-muted px-1">logs</code> tenga documentos.
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr
                  key={`${log.id}-${index}`}
                  className={cn("transition-colors hover:bg-background/30", index === 0 && "animate-in fade-in duration-500")}
                >
                  <td className="px-5 py-3 font-mono text-sm text-muted-foreground">{formatTime(log.timestamp)}</td>
                  <td
                    className={cn(
                      "px-5 py-3 font-mono text-sm",
                      log.label !== "Benign" ? "text-[#ef4444]" : "text-[#00b4ff]",
                    )}
                  >
                    {log.src_ip}
                  </td>
                  <td className="px-5 py-3 font-mono text-sm text-foreground">{log.dst_ip}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{log.protocol}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{log.duration?.toFixed(3) ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn("rounded px-2.5 py-1 text-xs font-medium", labelBadgeClass(log.label))}
                    >
                      {log.label.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
