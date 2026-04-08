"use client"

import { useState, useEffect } from "react"
import { Download, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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

export function LiveStreamTable() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    setLogs(generateLogs(8))
    
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLog = generateLogs(1)[0]
        return [newLog, ...prev.slice(0, 7)]
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="bg-[#1e293b] rounded-xl border border-[#334155]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          CICIDS-2017 Live Stream
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8 text-[#94a3b8] hover:text-white hover:bg-[#334155]">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-[#94a3b8] hover:text-white hover:bg-[#334155]">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]">
              <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Timestamp</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">SRC IP</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">DST IP</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Proto</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Flow Duration</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Label</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr 
                key={log.id} 
                className={cn(
                  "border-b border-[#334155]/50 hover:bg-[#334155]/30 transition-colors",
                  index === 0 && "animate-in fade-in duration-500"
                )}
              >
                <td className="px-5 py-3 text-sm text-[#94a3b8] font-mono">{formatTime(log.timestamp)}</td>
                <td className={cn(
                  "px-5 py-3 text-sm font-mono",
                  log.label !== 'Benign' ? "text-[#ef4444]" : "text-[#00b4ff]"
                )}>
                  {log.src_ip}
                </td>
                <td className="px-5 py-3 text-sm text-[#e2e8f0] font-mono">{log.dst_ip}</td>
                <td className="px-5 py-3 text-sm text-[#94a3b8]">{log.protocol}</td>
                <td className="px-5 py-3 text-sm text-[#94a3b8]">{log.flow_duration.toFixed(0)}</td>
                <td className="px-5 py-3">
                  <span className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium",
                    labelColors[log.label]
                  )}>
                    {log.label.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
