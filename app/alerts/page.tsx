"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  TrendingUp, 
  XCircle, 
  AlertTriangle, 
  Radio, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  Lock
} from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { generateAlerts, alertStats, topAttackVectors, type Alert } from "@/lib/mock-data"

const severityColors: Record<Alert['severity'], string> = {
  'CRITICAL': 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30',
  'HIGH': 'bg-[#f97316]/20 text-[#f97316] border-[#f97316]/30',
  'MEDIUM': 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30',
  'LOW': 'bg-[#14b8a6]/20 text-[#14b8a6] border-[#14b8a6]/30',
}

const statusIcons: Record<Alert['status'], React.ReactNode> = {
  'Unassigned': null,
  'Triage': <RefreshCw className="w-3.5 h-3.5" />,
  'Open': <Lock className="w-3.5 h-3.5" />,
  'Resolved': null,
}

const threatDistribution = [
  { time: '00:00', logs: 35, alerts: 15 },
  { time: '06:00', logs: 55, alerts: 40 },
  { time: '12:00', logs: 45, alerts: 25 },
  { time: '18:00', logs: 70, alerts: 35 },
  { time: '23:59', logs: 40, alerts: 20 },
]

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<'All' | 'Critical' | 'High'>('All')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setAlerts(generateAlerts(50))
  }, [])

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'All') return true
    if (filter === 'Critical') return alert.severity === 'CRITICAL'
    if (filter === 'High') return alert.severity === 'HIGH'
    return true
  })

  const paginatedAlerts = filteredAlerts.slice(0, 15)

  return (
    <DashboardLayout>
      <Header searchPlaceholder="Search alerts, IPs, or attack types..." showTimeRange />
      
      <div className="p-6">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Active Network Alerts</h1>
            <p className="text-sm text-[#64748b] mt-1">Real-time threat intelligence and vulnerability detection.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filter Buttons */}
            <div className="flex bg-[#1e293b] rounded-lg p-1 border border-[#334155]">
              {(['All', 'Critical', 'High'] as const).map((f) => (
                <Button
                  key={f}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "px-4 h-8",
                    filter === f 
                      ? "bg-[#00b4ff] text-[#0f172a] hover:bg-[#00b4ff]/90" 
                      : "text-[#94a3b8] hover:text-white hover:bg-[#334155]"
                  )}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
            
            <Button variant="outline" className="bg-[#1e293b] border-[#334155] text-[#e2e8f0] hover:bg-[#334155]">
              <span className="mr-2">Advanced Filters</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider">Total Active</p>
                <p className="text-3xl font-bold text-white mt-1">{alertStats.totalActive.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#00b4ff]/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#00b4ff]" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider">Critical</p>
                <p className="text-3xl font-bold text-[#00b4ff] mt-1">{alertStats.critical}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#ef4444]/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-[#ef4444]" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider">High Severity</p>
                <p className="text-3xl font-bold text-white mt-1">{alertStats.highSeverity}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider">In Progress</p>
                <p className="text-3xl font-bold text-white mt-1">{alertStats.inProgress}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#14b8a6]/20 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#14b8a6]" />
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Severity</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Time</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">SRC IP</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Attack Type</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAlerts.map((alert) => (
                  <tr 
                    key={alert.id}
                    className="border-b border-[#334155]/50 hover:bg-[#334155]/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1.5 w-fit",
                        severityColors[alert.severity]
                      )}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8] font-mono">{alert.time}</td>
                    <td className="px-5 py-4 text-sm text-[#00b4ff] font-mono">{alert.src_ip}</td>
                    <td className="px-5 py-4 text-sm text-[#e2e8f0] font-medium">{alert.attack_type}</td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8] max-w-xs truncate">{alert.description}</td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "text-sm flex items-center gap-1.5",
                        alert.status === 'Triage' ? "text-[#00b4ff]" : 
                        alert.status === 'Open' ? "text-[#ef4444]" : "text-[#64748b]"
                      )}>
                        {statusIcons[alert.status]}
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#334155]">
            <span className="text-sm text-[#64748b]">
              SHOWING 1-15 OF {filteredAlerts.length.toLocaleString()} ALERTS
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                className="w-8 h-8 bg-[#0f172a] border-[#334155]"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 text-[#94a3b8]" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                className="w-8 h-8 bg-[#0f172a] border-[#334155]"
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4 text-[#94a3b8]" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Threat Distribution Chart */}
          <div className="lg:col-span-2 bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Threat Distribution (Last 24H)
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00b4ff]" />
                  <span className="text-[#94a3b8]">Logs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-[#94a3b8]">Alerts</span>
                </div>
              </div>
            </div>
            
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatDistribution} barGap={4}>
                  <XAxis 
                    dataKey="time" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Bar dataKey="logs" fill="#475569" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="alerts" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Attack Vectors */}
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Top Attack Vectors
            </h3>
            
            <div className="space-y-4">
              {topAttackVectors.map((vector, i) => (
                <div key={vector.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-[#e2e8f0]">{vector.name}</span>
                    <span className="text-sm text-[#94a3b8]">{vector.percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-[#0f172a] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${vector.percentage}%`,
                        backgroundColor: i === 0 ? '#00b4ff' : i === 1 ? '#8b5cf6' : i === 2 ? '#f59e0b' : '#64748b'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-6 bg-transparent border-[#334155] text-[#94a3b8] hover:bg-[#334155] hover:text-white"
            >
              View Full Report
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
