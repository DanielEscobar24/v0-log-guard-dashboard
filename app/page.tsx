"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { KPICard } from "@/components/dashboard/kpi-card"
import { TrafficChart } from "@/components/dashboard/traffic-chart"
import { LiveStreamTable } from "@/components/dashboard/live-stream-table"
import { TopAttackTypesPanel, TopSourceIPsPanel, FiltersPanel } from "@/components/dashboard/sidebar-panels"
import { kpiData } from "@/lib/mock-data"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Header />
      
      <div className="p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard 
            title="Total_Flows" 
            value={kpiData.totalFlows.value}
            change={kpiData.totalFlows.change}
            trend={kpiData.totalFlows.trend}
            sparklineColor="#00b4ff"
          />
          <KPICard 
            title="Attacks" 
            value={kpiData.attacks.value}
            change={kpiData.attacks.change}
            trend={kpiData.attacks.trend}
            sparklineColor="#f97316"
          />
          <KPICard 
            title="Benign" 
            value={kpiData.benign.value}
            change={kpiData.benign.change}
            trend={kpiData.benign.trend}
            sparklineColor="#14b8a6"
          />
          <KPICard 
            title="Active_Threats" 
            value={kpiData.activeThreats.value}
            status={kpiData.activeThreats.status}
            sparklineColor="#ef4444"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Section - Charts */}
          <div className="lg:col-span-3 space-y-6">
            <TrafficChart />
            <LiveStreamTable />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <TopAttackTypesPanel />
            <TopSourceIPsPanel />
            <FiltersPanel />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
