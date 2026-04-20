"use client"

import { Fragment, useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Pause, Play, Monitor } from "lucide-react"
import { generateLogs, type LogEntry } from "@/lib/mock-data"

const labelColors: Record<LogEntry['label'], string> = {
  'Benign': 'bg-[#14b8a6] text-white',
  'DDoS': 'bg-[#ef4444] text-white',
  'PortScan': 'bg-[#f97316] text-white',
  'Bot': 'bg-[#8b5cf6] text-white',
  'Botnet': 'bg-[#ef4444] text-white',
  'Infiltration': 'bg-[#f59e0b] text-white',
  'Suspicious': 'bg-[#f59e0b] text-[#0f172a]',
}

const protocolColors: Record<string, string> = {
  'TCP': 'bg-[#00b4ff]/20 text-[#00b4ff] border-[#00b4ff]/30',
  'UDP': 'bg-[#14b8a6]/20 text-[#14b8a6] border-[#14b8a6]/30',
  'ICMP': 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30',
  'HTTPS': 'bg-[#8b5cf6]/20 text-[#8b5cf6] border-[#8b5cf6]/30',
}

export default function LiveLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(true)
  const [throughput, setThroughput] = useState(420)
  const [throughputBars, setThroughputBars] = useState<number[]>([12, 18, 14, 20, 16])

  useEffect(() => {
    setLogs(generateLogs(20))
  }, [])

  useEffect(() => {
    // Evita hydration mismatch: SSR debe ser determinista.
    setThroughputBars(Array.from({ length: 5 }, () => 8 + Math.random() * 16))
  }, [])

  useEffect(() => {
    if (!isLive) return
    
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLog = generateLogs(1)[0]
        return [newLog, ...prev.slice(0, 19)]
      })
      setThroughput(prev => prev + Math.floor(Math.random() * 20) - 10)
    }, 2000)

    return () => clearInterval(interval)
  }, [isLive])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    }).replace(',', '.')
  }

  const normalCount = logs.filter(l => l.label === 'Benign').length
  const threatCount = logs.length - normalCount
  const normalPercent = ((normalCount / logs.length) * 100).toFixed(1)
  const threatPercent = ((threatCount / logs.length) * 100).toFixed(1)

  return (
    <DashboardLayout>
      <Header />
      
      <div className="p-6">
        {/* Title Row */}
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Live Logs</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#14b8a6] animate-pulse" />
                <span className="text-sm text-[#14b8a6] font-medium">LIVE</span>
              </span>
              <span className="text-sm text-muted-foreground">Monitoring eth0 interface</span>
            </div>
          </div>
          
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            {/* Throughput */}
            <div className="bg-card rounded-xl px-5 py-3 border border-border/40 w-full sm:w-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Throughput</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">{throughput}</span>
                <span className="text-sm text-muted-foreground">eps</span>
                <div className="flex gap-0.5 ml-2">
                  {throughputBars.map((h, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-[#14b8a6]" 
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex gap-2 justify-end sm:justify-start">
              <Button 
                variant="outline"
                className={cn(
                  "w-10 h-10 p-0",
                  !isLive ? "bg-primary/10 border-primary/30" : "bg-card border-border/40"
                )}
                onClick={() => setIsLive(false)}
              >
                <Pause className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button 
                variant="outline"
                className={cn(
                  "w-10 h-10 p-0",
                  isLive ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card border-border/40"
                )}
                onClick={() => setIsLive(true)}
              >
                <Play className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background/30">
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">SRC IP</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">DST IP</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proto</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Flow Duration</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Label</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <Fragment key={log.id}>
                    <tr 
                      className={cn(
                        "hover:bg-background/30 transition-colors cursor-pointer",
                        index === 0 && isLive && "animate-in fade-in duration-500",
                        expandedLog === log.id && "bg-background/30"
                      )}
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <td className="px-5 py-4 text-sm text-muted-foreground font-mono">{formatTime(log.timestamp)}</td>
                      <td className={cn(
                        "px-5 py-4 text-sm font-mono font-medium",
                        log.label !== 'Benign' ? "text-[#ef4444]" : "text-[#00b4ff]"
                      )}>
                        {log.src_ip}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground font-mono">{log.dst_ip}</td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border",
                          protocolColors[log.protocol]
                        )}>
                          {log.protocol}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{log.flow_duration.toFixed(2)} ms</td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium",
                          labelColors[log.label]
                        )}>
                          {log.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {expandedLog === log.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr key={`${log.id}-details`}>
                        <td colSpan={7} className="px-5 py-4 bg-background/40">
                          <div className="flex items-center gap-2 mb-3">
                            <Monitor className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Raw Log Data</span>
                          </div>
                          <pre className="text-xs font-mono text-muted-foreground bg-card rounded-lg p-4 overflow-x-auto border border-border/40">
{`{"flow_id": "${log.flow_id}", "timestamp": "${log.timestamp}", "source": "${log.src_ip}", "destination": "${log.dst_ip}", "protocol": ${log.protocol === 'TCP' ? 6 : log.protocol === 'UDP' ? 17 : 1}, "length": ${log.length}, "flags": "${log.flags}", "payload": "${log.payload}", "prediction_confidence": ${log.prediction_confidence?.toFixed(4)}}`}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Displaying latest 5,000 events</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#14b8a6]" />
              {normalPercent}% Normal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              {threatPercent}% Threat
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
