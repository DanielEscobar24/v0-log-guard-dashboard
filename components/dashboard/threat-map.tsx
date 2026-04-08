"use client"

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"
import { threatLocations } from "@/lib/mock-data"

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

export function ThreatMap() {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Global Threat Distribution
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]" />
            <span className="text-[#94a3b8]">SAFE TRAFFIC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span className="text-[#94a3b8]">ACTIVE ATTACK</span>
          </div>
        </div>
      </div>
      
      <div className="h-[300px] -mx-2">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 120,
            center: [20, 20]
          }}
          style={{
            width: "100%",
            height: "100%"
          }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#334155"
                  stroke="#1e293b"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "#475569" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          
          {threatLocations.map((location) => (
            <Marker key={location.id} coordinates={[location.lng, location.lat]}>
              <circle
                r={6}
                fill={location.type === 'attack' ? "#ef4444" : "#14b8a6"}
                fillOpacity={0.8}
                stroke={location.type === 'attack' ? "#ef4444" : "#14b8a6"}
                strokeWidth={2}
                strokeOpacity={0.3}
              />
              {location.type === 'attack' && (
                <circle
                  r={12}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeOpacity={0.4}
                  className="animate-ping"
                />
              )}
            </Marker>
          ))}
        </ComposableMap>
      </div>
    </div>
  )
}
