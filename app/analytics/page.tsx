"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { cn } from "@/lib/utils"
import { Sparkles, Share2 } from "lucide-react"
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from "recharts"
import { attackDistribution, protocolData, flowDurationData, portConcentration } from "@/lib/mock-data"

const COLORS = ['#00b4ff', '#f59e0b', '#14b8a6']

export default function AnalyticsPage() {
  const [synapsing, setSynapsing] = useState(true)
  
  useEffect(() => {
    const timer = setTimeout(() => setSynapsing(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const totalEvents = attackDistribution.reduce((sum, item) => sum + item.value, 0) * 18.42

  return (
    <DashboardLayout>
      <Header searchPlaceholder="Search analytics metrics..." showTimeRange showRefresh />
      
      <div className="p-6">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-wide">Analytics Engine</h1>
            <p className="text-sm text-[#64748b] mt-1">Deep-packet analysis and heuristic traffic distribution.</p>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#14b8a6]/10 rounded-full border border-[#14b8a6]/30">
            <span className="w-2 h-2 rounded-full bg-[#14b8a6] animate-pulse" />
            <span className="text-sm text-[#14b8a6] font-medium">Live Stream: 4.2k eps</span>
          </div>
        </div>

        {/* Top Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Attack Distribution */}
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-4">
              Attack Distribution
            </h3>
            
            <div className="flex items-center gap-6">
              <div className="relative w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attackDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {attackDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">{Math.round(totalEvents).toLocaleString()}</span>
                  <span className="text-xs text-[#64748b] uppercase">Total Events</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {attackDistribution.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-sm text-[#94a3b8]">{item.name}</span>
                    <span className="text-sm font-semibold text-white ml-auto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Flow Duration */}
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider">
                  Flow Duration
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-white">240ms</span>
                  <span className="text-sm text-[#14b8a6]">Avg Latency</span>
                </div>
              </div>
              <div className="flex gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2 bg-[#14b8a6]/60"
                    style={{ height: `${20 + Math.random() * 30}px` }}
                  />
                ))}
              </div>
            </div>
            
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flowDurationData}>
                  <XAxis 
                    dataKey="range" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Bar dataKey="count" fill="#475569" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Middle Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Protocols */}
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-4">
              Top Protocols
            </h3>
            
            <div className="space-y-4">
              {protocolData.map((protocol) => (
                <div key={protocol.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white">{protocol.name}</span>
                    <span className="text-sm text-[#94a3b8]">{protocol.value} {protocol.unit}</span>
                  </div>
                  <div className="h-2 bg-[#0f172a] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-[#00b4ff] to-[#14b8a6]"
                      style={{ width: `${(protocol.value / 12.4) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Port Concentration */}
          <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
            <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-4">
              Active Port Concentration
            </h3>
            
            <div className="grid grid-cols-4 gap-2 mb-4">
              {portConcentration.map((port) => (
                <div 
                  key={port.port}
                  className={cn(
                    "aspect-square rounded-lg flex items-center justify-center text-sm font-medium border",
                    port.status === 'critical' ? "bg-[#ef4444]/10 border-[#ef4444]/30 text-white" :
                    port.status === 'active' ? "bg-[#334155] border-[#475569] text-[#94a3b8]" :
                    "bg-[#1e293b] border-[#334155] text-[#475569]"
                  )}
                >
                  {port.port || ''}
                </div>
              ))}
              {/* Fill remaining slots */}
              {[...Array(12 - portConcentration.length)].map((_, i) => (
                <div 
                  key={`empty-${i}`}
                  className="aspect-square rounded-lg bg-[#1e293b] border border-[#334155]"
                />
              ))}
            </div>
            
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#ef4444]/50" />
                <span className="text-[#94a3b8]">CRITICAL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#334155]" />
                <span className="text-[#94a3b8]">ACTIVE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#1e293b] border border-[#334155]" />
                <span className="text-[#94a3b8]">IDLE</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="bg-gradient-to-b from-[#1e293b] to-[#0f172a] rounded-xl border border-[#334155] overflow-hidden">
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#00b4ff]/10 rounded-full border border-[#00b4ff]/30 mb-6">
              <Sparkles className="w-4 h-4 text-[#00b4ff]" />
              <span className="text-sm text-[#00b4ff] font-medium">NEURAL ENGINE V2.0</span>
            </div>
            
            <h2 className="text-4xl font-bold text-white mb-4">
              <span className="gradient-text">AI-Powered Insights</span> – Coming Soon
            </h2>
            
            <p className="text-[#94a3b8] max-w-xl mx-auto leading-relaxed">
              Our proprietary LLM is currently training on your network patterns. Soon, 
              {"you'll"} receive automated root-cause analysis and predictive threat intelligence.
            </p>
          </div>
          
          <div className="bg-[#1e293b]/50 mx-8 mb-8 rounded-xl p-8 border border-[#334155]">
            <div className="flex flex-col items-center">
              <Share2 className="w-12 h-12 text-[#475569] mb-4" />
              
              {/* Progress Bars */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[#0f172a]">
                  <div className={cn(
                    "h-full bg-[#00b4ff] transition-all duration-1000",
                    synapsing ? "w-full" : "w-3/4"
                  )} />
                </div>
                <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[#0f172a]">
                  <div className={cn(
                    "h-full bg-[#00b4ff]/60 transition-all duration-1000 delay-300",
                    synapsing ? "w-2/3" : "w-1/2"
                  )} />
                </div>
                <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[#0f172a]">
                  <div className={cn(
                    "h-full bg-[#00b4ff]/30 transition-all duration-1000 delay-500",
                    synapsing ? "w-1/3" : "w-1/4"
                  )} />
                </div>
              </div>
              
              <p className="text-xs text-[#64748b] uppercase tracking-widest">
                Synapsing Network Nodes...
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
