"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { trafficData } from "@/lib/mock-data"

export function TrafficChart() {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Network Traffic Volume Over Time
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00b4ff]" />
            <span className="text-muted-foreground">Benign</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span className="text-muted-foreground">Attacks</span>
          </div>
        </div>
      </div>
      
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="benignGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00b4ff" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#00b4ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="attackGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickMargin={10}
              interval={3}
            />
            <YAxis 
              yAxisId="benign"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              label={{
                value: "Benign (events)",
                angle: -90,
                position: "insideLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tickMargin={10}
            />
            <YAxis
              yAxisId="attacks"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
              label={{
                value: "Attacks (alerts)",
                angle: 90,
                position: "insideRight",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
              tickFormatter={(value) => `${value}`}
              tickMargin={10}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--popover-foreground)'
              }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              formatter={(value, name) => {
                if (name === "benign") return [`${Number(value).toLocaleString()} events`, "Benign"]
                if (name === "attacks") return [`${Number(value).toLocaleString()} alerts`, "Attacks"]
                return [String(value), String(name)]
              }}
            />
            <Area
              yAxisId="benign"
              type="monotone"
              dataKey="benign"
              stroke="#00b4ff"
              strokeWidth={2}
              fill="url(#benignGradient)"
            />
            <Area
              yAxisId="attacks"
              type="monotone"
              dataKey="attacks"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#attackGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
