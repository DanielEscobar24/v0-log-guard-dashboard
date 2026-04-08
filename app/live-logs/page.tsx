"use client"

import { useState, useEffect } from "react"
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

  useEffect(() => {
    setLogs(generateLogs(20))
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
      <Header searchPlaceholder="Search logs by IP, Protocol or CIDR..." showTimeRange showRefresh />
      
      <div className="p-6">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Live Logs</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#14b8a6] animate-pulse" />
                <span className="text-sm text-[#14b8a6] font-medium">LIVE</span>
              </span>
              <span className="text-sm text-[#64748b]">Monitoring eth0 interface</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Throughput */}
            <div className="bg-[#1e293b] rounded-xl px-5 py-3 border border-[#334155]">
              <p className="text-xs text-[#64748b] uppercase tracking-wider">Throughput</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">{throughput}</span>
                <span className="text-sm text-[#94a3b8]">eps</span>
                <div className="flex gap-0.5 ml-2">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-[#14b8a6]" 
                      style={{ height: `${8 + Math.random() * 16}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className={cn(
                  "w-10 h-10 p-0",
                  !isLive ? "bg-[#00b4ff]/20 border-[#00b4ff]/50" : "bg-[#1e293b] border-[#334155]"
                )}
                onClick={() => setIsLive(false)}
              >
                <Pause className="w-4 h-4 text-[#94a3b8]" />
              </Button>
              <Button 
                variant="outline"
                className={cn(
                  "w-10 h-10 p-0",
                  isLive ? "bg-[#14b8a6]/20 border-[#14b8a6]/50" : "bg-[#1e293b] border-[#334155]"
                )}
                onClick={() => setIsLive(true)}
              >
                <Play className="w-4 h-4 text-[#94a3b8]" />
              </Button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">SRC IP</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">DST IP</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Proto</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Flow Duration</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Label</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <>
                    <tr 
                      key={log.id}
                      className={cn(
                        "border-b border-[#334155]/50 hover:bg-[#334155]/30 transition-colors cursor-pointer",
                        index === 0 && isLive && "animate-in fade-in duration-500",
                        expandedLog === log.id && "bg-[#334155]/30"
                      )}
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <td className="px-5 py-4 text-sm text-[#94a3b8] font-mono">{formatTime(log.timestamp)}</td>
                      <td className={cn(
                        "px-5 py-4 text-sm font-mono font-medium",
                        log.label !== 'Benign' ? "text-[#ef4444]" : "text-[#00b4ff]"
                      )}>
                        {log.src_ip}
                      </td>
                      <td className="px-5 py-4 text-sm text-[#e2e8f0] font-mono">{log.dst_ip}</td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border",
                          protocolColors[log.protocol]
                        )}>
                          {log.protocol}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#94a3b8]">{log.flow_duration.toFixed(2)} ms</td>
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
                          <ChevronUp className="w-5 h-5 text-[#64748b]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[#64748b]" />
                        )}
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr key={`${log.id}-details`}>
                        <td colSpan={7} className="px-5 py-4 bg-[#0f172a]">
                          <div className="flex items-center gap-2 mb-3">
                            <Monitor className="w-4 h-4 text-[#64748b]" />
                            <span className="text-xs text-[#64748b] uppercase tracking-wider font-medium">Raw Log Data</span>
                          </div>
                          <pre className="text-xs font-mono text-[#94a3b8] bg-[#1e293b] rounded-lg p-4 overflow-x-auto border border-[#334155]">
{`{"flow_id": "${log.flow_id}", "timestamp": "${log.timestamp}", "source": "${log.src_ip}", "destination": "${log.dst_ip}", "protocol": ${log.protocol === 'TCP' ? 6 : log.protocol === 'UDP' ? 17 : 1}, "length": ${log.length}, "flags": "${log.flags}", "payload": "${log.payload}", "prediction_confidence": ${log.prediction_confidence?.toFixed(4)}}`}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between mt-4 text-sm text-[#64748b]">
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
