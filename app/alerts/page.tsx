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
      <Header />
      
      <div className="p-6">
        {/* Title Row */}
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Active Network Alerts</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time threat intelligence and vulnerability detection.</p>
          </div>
          
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            {/* Filter Buttons */}
            <div className="w-full overflow-x-auto">
              <div className="inline-flex bg-card rounded-lg p-1 border border-border/40 whitespace-nowrap">
                {(['All', 'Critical', 'High'] as const).map((f) => (
                  <Button
                    key={f}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "px-4 h-8 shrink-0",
                      filter === f 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>
            
            <Button
              variant="outline"
              className="bg-card border-border/40 text-foreground hover:bg-accent w-full sm:w-auto"
            >
              <span className="mr-2">Advanced Filters</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Active</p>
                <p className="text-3xl font-bold text-foreground mt-1">{alertStats.totalActive.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#00b4ff]/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#00b4ff]" />
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Critical</p>
                <p className="text-3xl font-bold text-[#00b4ff] mt-1">{alertStats.critical}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#ef4444]/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-[#ef4444]" />
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Severity</p>
                <p className="text-3xl font-bold text-foreground mt-1">{alertStats.highSeverity}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">In Progress</p>
                <p className="text-3xl font-bold text-foreground mt-1">{alertStats.inProgress}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#14b8a6]/20 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#14b8a6]" />
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background/30">
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">SRC IP</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Attack Type</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAlerts.map((alert) => (
                  <tr 
                    key={alert.id}
                    className="hover:bg-background/30 transition-colors"
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
                    <td className="px-5 py-4 text-sm text-muted-foreground font-mono">{alert.time}</td>
                    <td className="px-5 py-4 text-sm text-[#00b4ff] font-mono">{alert.src_ip}</td>
                    <td className="px-5 py-4 text-sm text-foreground font-medium">{alert.attack_type}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground max-w-xs truncate">{alert.description}</td>
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
          <div className="flex items-center justify-between px-5 py-4 border-t border-border/40">
            <span className="text-sm text-muted-foreground">
              SHOWING 1-15 OF {filteredAlerts.length.toLocaleString()} ALERTS
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                className="w-8 h-8 bg-background/40 border-border/40"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                className="w-8 h-8 bg-background/40 border-border/40"
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Threat Distribution Chart */}
          <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border/40">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Threat Distribution (Last 24H)
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00b4ff]" />
                  <span className="text-muted-foreground">Logs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-muted-foreground">Alerts</span>
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
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--popover-foreground)'
                    }}
                  />
                  <Bar dataKey="logs" fill="#475569" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="alerts" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Attack Vectors */}
          <div className="bg-card rounded-xl p-5 border border-border/40">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
              Top Attack Vectors
            </h3>
            
            <div className="space-y-4">
              {topAttackVectors.map((vector, i) => (
                <div key={vector.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-foreground">{vector.name}</span>
                    <span className="text-sm text-muted-foreground">{vector.percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-background/40 rounded-full overflow-hidden">
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
              className="w-full mt-6 bg-transparent border-border/40 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              View Full Report
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
