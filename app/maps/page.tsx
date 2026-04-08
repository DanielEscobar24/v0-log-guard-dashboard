"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Plus, Minus, Crosshair, MapPin, CheckCircle, AlertCircle } from "lucide-react"
import { ComposableMap, Geographies, Geography, Marker, Line, ZoomableGroup } from "react-simple-maps"
import { threatLocations } from "@/lib/mock-data"

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

interface SelectedThreat {
  ip: string
  city: string
  type: string
  intensity: string
  lat: number
  lng: number
}

export default function MapsPage() {
  const [zoom, setZoom] = useState(1)
  const [heatmapEnabled, setHeatmapEnabled] = useState(true)
  const [geofencingEnabled, setGeofencingEnabled] = useState(false)
  const [selectedThreat, setSelectedThreat] = useState<SelectedThreat | null>({
    ip: '192.168.1.104',
    city: 'Beijing',
    type: 'DDoS',
    intensity: 'High',
    lat: 39.9042,
    lng: 116.4074
  })

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 8))
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 1))
  const handleReset = () => setZoom(1)

  // Connection lines from threats to target (US East Coast)
  const targetCoords: [number, number] = [-74.006, 40.7128] // NYC

  return (
    <DashboardLayout>
      <Header searchPlaceholder="Search IP, Host, or Location..." showTimeRange />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Map Area */}
        <div className="flex-1 relative bg-[#0f172a]">
          {/* Zoom Controls */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="w-10 h-10 bg-[#1e293b] border-[#334155] hover:bg-[#334155]"
              onClick={handleZoomIn}
            >
              <Plus className="w-4 h-4 text-white" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="w-10 h-10 bg-[#1e293b] border-[#334155] hover:bg-[#334155]"
              onClick={handleZoomOut}
            >
              <Minus className="w-4 h-4 text-white" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="w-10 h-10 bg-[#1e293b] border-[#334155] hover:bg-[#334155] mt-2"
              onClick={handleReset}
            >
              <Crosshair className="w-4 h-4 text-white" />
            </Button>
          </div>

          {/* Map */}
          <div className="w-full h-full">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 150,
                center: [20, 20]
              }}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#0f172a"
              }}
            >
              <ZoomableGroup zoom={zoom} center={[20, 20]}>
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#1e293b"
                        stroke="#334155"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", fill: "#334155" },
                          pressed: { outline: "none" },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {/* Connection Lines */}
                {threatLocations.filter(l => l.type === 'attack').map((location) => (
                  <Line
                    key={`line-${location.id}`}
                    from={[location.lng, location.lat]}
                    to={targetCoords}
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    strokeLinecap="round"
                  />
                ))}
                
                {/* Threat Markers */}
                {threatLocations.map((location) => (
                  <Marker 
                    key={location.id} 
                    coordinates={[location.lng, location.lat]}
                    onClick={() => setSelectedThreat({
                      ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                      city: location.city,
                      type: location.type === 'attack' ? 'DDoS' : 'Safe',
                      intensity: location.intensity,
                      lat: location.lat,
                      lng: location.lng
                    })}
                  >
                    <circle
                      r={8 / zoom}
                      fill={location.type === 'attack' ? "#f97316" : "#14b8a6"}
                      fillOpacity={0.8}
                      stroke={location.type === 'attack' ? "#f97316" : "#14b8a6"}
                      strokeWidth={2 / zoom}
                      strokeOpacity={0.3}
                      style={{ cursor: 'pointer' }}
                    />
                    {location.type === 'attack' && heatmapEnabled && (
                      <>
                        <circle
                          r={16 / zoom}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth={1 / zoom}
                          strokeOpacity={0.3}
                        />
                        <circle
                          r={24 / zoom}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth={0.5 / zoom}
                          strokeOpacity={0.2}
                        />
                      </>
                    )}
                  </Marker>
                ))}

                {/* Target Marker (NYC) */}
                <Marker coordinates={targetCoords}>
                  <circle
                    r={10 / zoom}
                    fill="#00b4ff"
                    fillOpacity={0.8}
                    stroke="#00b4ff"
                    strokeWidth={3 / zoom}
                    strokeOpacity={0.3}
                  />
                </Marker>
              </ZoomableGroup>
            </ComposableMap>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-6 px-6 py-3 bg-[#1e293b]/90 backdrop-blur rounded-full border border-[#334155]">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#94a3b8] font-medium">TRAFFIC HEATMAP</span>
                <Switch 
                  checked={heatmapEnabled}
                  onCheckedChange={setHeatmapEnabled}
                  className="data-[state=checked]:bg-[#00b4ff]"
                />
              </div>
              <div className="w-px h-6 bg-[#334155]" />
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#94a3b8] font-medium">GEO-FENCING</span>
                <Switch 
                  checked={geofencingEnabled}
                  onCheckedChange={setGeofencingEnabled}
                  className="data-[state=checked]:bg-[#00b4ff]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        {selectedThreat && (
          <div className="w-80 bg-[#1e293b] border-l border-[#334155] p-6 overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-2">IP Details</h3>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-[#f97316] font-mono">{selectedThreat.ip}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-[#94a3b8]">
                <MapPin className="w-4 h-4" />
                {selectedThreat.city}, China
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">Threat Profile</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94a3b8]">Type:</span>
                  <span className="text-sm text-white font-medium">{selectedThreat.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94a3b8]">Intensity:</span>
                  <span className={cn(
                    "text-sm font-medium",
                    selectedThreat.intensity === 'high' ? "text-[#ef4444]" : 
                    selectedThreat.intensity === 'medium' ? "text-[#f59e0b]" : "text-[#14b8a6]"
                  )}>
                    {selectedThreat.intensity.charAt(0).toUpperCase() + selectedThreat.intensity.slice(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94a3b8]">First Seen:</span>
                  <span className="text-sm text-white">2h 34m ago</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">Destination</h3>
              <div className="p-3 bg-[#00b4ff]/10 rounded-lg border-l-4 border-[#00b4ff]">
                <p className="text-xs text-[#00b4ff] font-medium mb-1">Production</p>
                <p className="text-lg font-bold text-white">Main Cluster</p>
                <div className="w-16 h-1 bg-[#00b4ff] rounded-full mt-2" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">Automated Actions</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#14b8a6]" />
                  <span className="text-[#94a3b8]">Traffic throttled</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-[#64748b]" />
                  <span className="text-[#64748b]">Deep inspection pending</span>
                </div>
              </div>
            </div>

            <Button className="w-full bg-[#ef4444] hover:bg-[#ef4444]/90 text-white font-medium">
              BLOCK IP
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
