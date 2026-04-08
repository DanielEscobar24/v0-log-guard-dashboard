"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { 
  Database, 
  Bell, 
  Users, 
  Download, 
  Palette,
  Plus,
  MoreVertical,
  Server,
  Cloud,
  Settings as SettingsIcon
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { users, dataNodes } from "@/lib/mock-data"

const settingsTabs = [
  { id: 'data-sources', label: 'Data Sources', icon: Database },
  { id: 'notification-rules', label: 'Notification Rules', icon: Bell },
  { id: 'user-management', label: 'User Management', icon: Users },
  { id: 'export-options', label: 'Export Options', icon: Download },
  { id: 'theme-settings', label: 'Theme Settings', icon: Palette },
]

const roleColors: Record<string, string> = {
  'Super Admin': 'bg-[#00b4ff] text-white',
  'Admin': 'bg-[#14b8a6] text-white',
  'Analyst': 'bg-[#64748b] text-white',
  'Viewer': 'bg-[#334155] text-[#94a3b8]',
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('data-sources')
  const [criticalFailures, setCriticalFailures] = useState(true)
  const [anomalyDetect, setAnomalyDetect] = useState(true)
  const [colorProfile, setColorProfile] = useState('blue')
  const [observatoryMode, setObservatoryMode] = useState<'dark' | 'light'>('dark')

  return (
    <DashboardLayout>
      <Header searchPlaceholder="Search system settings..." />
      
      <div className="p-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-[#64748b] mt-1">Configure your LogGuard observatory and management parameters.</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0">
            <nav className="space-y-1">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                      isActive 
                        ? "bg-[#00b4ff]/10 text-[#00b4ff]" 
                        : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-6">
            {/* Data Sources Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-[#00b4ff]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Data Sources</h2>
              </div>
              
              <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-medium">Connected Nodes</h3>
                    <p className="text-sm text-[#64748b]">Active data ingestion points across the network.</p>
                  </div>
                  <Button className="bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Node
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {dataNodes.map((node) => (
                    <div 
                      key={node.id}
                      className="flex items-center justify-between p-4 bg-[#0f172a] rounded-lg border border-[#334155]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#00b4ff]/20 flex items-center justify-center">
                          {node.ip.includes('aws') ? (
                            <Cloud className="w-5 h-5 text-[#00b4ff]" />
                          ) : (
                            <Server className="w-5 h-5 text-[#00b4ff]" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">{node.name}</p>
                          <p className="text-sm text-[#64748b] font-mono">{node.ip}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium",
                          node.status === 'Active' 
                            ? "bg-[#14b8a6]/20 text-[#14b8a6]" 
                            : "bg-[#64748b]/20 text-[#64748b]"
                        )}>
                          {node.status}
                        </span>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-[#64748b] hover:text-white">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Notification Rules Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-[#f59e0b]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Notification Rules</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5 border-l-4 border-l-[#ef4444]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-medium">Critical Failures</h3>
                    <Switch 
                      checked={criticalFailures}
                      onCheckedChange={setCriticalFailures}
                      className="data-[state=checked]:bg-[#14b8a6]"
                    />
                  </div>
                  <p className="text-sm text-[#94a3b8] mb-4">
                    Notify via Slack and PagerDuty when system uptime drops below 99.9%.
                  </p>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-[#0f172a] rounded text-xs text-[#94a3b8]">#alerts-critical</span>
                    <span className="px-2.5 py-1 bg-[#0f172a] rounded text-xs text-[#94a3b8]">PD-Service-A</span>
                  </div>
                </div>
                
                <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-medium">Anomaly Detect</h3>
                    <Switch 
                      checked={anomalyDetect}
                      onCheckedChange={setAnomalyDetect}
                      className="data-[state=checked]:bg-[#14b8a6]"
                    />
                  </div>
                  <p className="text-sm text-[#94a3b8] mb-4">
                    Trigger email digest if unusual traffic patterns are detected in edge nodes.
                  </p>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-[#0f172a] rounded text-xs text-[#94a3b8]">Security Team</span>
                  </div>
                </div>
              </div>
            </section>

            {/* User Management Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[#00b4ff]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">User Management</h2>
              </div>
              
              <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#334155]">
                      <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">User</th>
                      <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Role</th>
                      <th className="text-left px-5 py-4 text-xs font-medium text-[#64748b] uppercase tracking-wider">Last Active</th>
                      <th className="px-5 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-[#334155]/50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarFallback className="bg-[#00b4ff]/20 text-[#00b4ff] text-sm">
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-white font-medium">{user.name}</p>
                              <p className="text-sm text-[#64748b]">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded text-xs font-medium",
                            roleColors[user.role]
                          )}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#94a3b8]">{user.lastActive}</td>
                        <td className="px-5 py-4">
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-[#64748b] hover:text-white">
                            <SettingsIcon className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Theme Settings Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-[#8b5cf6]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Theme Settings</h2>
              </div>
              
              <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3 block">
                      Color Profile
                    </label>
                    <div className="flex gap-3">
                      {['blue', 'teal', 'orange'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setColorProfile(color)}
                          className={cn(
                            "w-10 h-10 rounded-lg transition-all",
                            color === 'blue' ? "bg-[#00b4ff]" :
                            color === 'teal' ? "bg-[#14b8a6]" :
                            "bg-[#f59e0b]",
                            colorProfile === color && "ring-2 ring-white ring-offset-2 ring-offset-[#1e293b]"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3 block">
                      Interface Density
                    </label>
                    <Select defaultValue="standard">
                      <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#e2e8f0]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e293b] border-[#334155]">
                        <SelectItem value="compact" className="text-[#e2e8f0] focus:bg-[#334155]">Compact</SelectItem>
                        <SelectItem value="standard" className="text-[#e2e8f0] focus:bg-[#334155]">Standard (Optimized)</SelectItem>
                        <SelectItem value="comfortable" className="text-[#e2e8f0] focus:bg-[#334155]">Comfortable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3 block">
                      Observatory Mode
                    </label>
                    <div className="flex bg-[#0f172a] rounded-lg p-1 border border-[#334155]">
                      <button
                        onClick={() => setObservatoryMode('dark')}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                          observatoryMode === 'dark' 
                            ? "bg-[#334155] text-white" 
                            : "text-[#64748b] hover:text-white"
                        )}
                      >
                        Dark
                      </button>
                      <button
                        onClick={() => setObservatoryMode('light')}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                          observatoryMode === 'light' 
                            ? "bg-[#334155] text-white" 
                            : "text-[#64748b] hover:text-white"
                        )}
                      >
                        Light
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Export Options Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Download className="w-5 h-5 text-[#14b8a6]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Export Options</h2>
              </div>
              
              <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Automated Backups</h3>
                    <p className="text-sm text-[#94a3b8]">
                      Configure system logs to automatically export to S3 or secure local storage every 24 hours.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="bg-[#0f172a] border-[#334155] text-[#e2e8f0] hover:bg-[#334155]">
                      Configure S3
                    </Button>
                    <Button className="bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white">
                      Export Now
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
