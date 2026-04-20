"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AttackItem = { name: string; percentage: number; color: string }

export function TopAttackTypesPanel({ items }: { items: AttackItem[] }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Top Attack Types
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay ataques en los datos actuales (o solo tráfico Benign).</p>
      ) : (
      <div className="space-y-4">
        {items.map((attack) => (
          <div key={attack.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-foreground">{attack.name}</span>
              <span className="text-sm text-muted-foreground">{attack.percentage}%</span>
            </div>
            <div className="h-1.5 bg-background/40 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${attack.percentage}%`,
                  backgroundColor: attack.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

export function TopSourceIPsPanel({
  items,
}: {
  items: { ip: string; flows: number | string }[]
}) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Top Source IPs
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin IPs con ataques en el conjunto actual.</p>
      ) : (
      <div className="space-y-3">
        {items.map((ip) => (
          <div key={ip.ip} className="flex items-center justify-between">
            <span className="text-sm text-[#00b4ff] font-mono">{ip.ip}</span>
            <span className="text-xs text-[#14b8a6] bg-[#14b8a6]/10 px-2 py-0.5 rounded">
              {typeof ip.flows === "number" ? ip.flows.toLocaleString() : ip.flows} flows
            </span>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

export function FiltersPanel() {
  const attackTypes = ['BENIGN', 'DDoS', 'PortScan', 'Bot', 'Brute Force']
  
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Filters
        </h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
            Date Range
          </label>
          <Select defaultValue="24h">
            <SelectTrigger className="bg-background/40 border-border/40 text-foreground">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent className="bg-popover/80 backdrop-blur-xl border-border/40">
              <SelectItem value="1h">Last 1 Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
            Attack Type
          </label>
          <div className="space-y-2.5">
            {attackTypes.map((type) => (
              <div key={type} className="flex items-center gap-2.5">
                <Checkbox 
                  id={type} 
                  defaultChecked={['BENIGN', 'DDoS', 'PortScan'].includes(type)}
                  className="border-[#475569] data-[state=checked]:bg-[#00b4ff] data-[state=checked]:border-[#00b4ff]"
                />
                <label htmlFor={type} className="text-sm text-foreground cursor-pointer">
                  {type}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        <Button className="w-full bg-[#00b4ff]/10 hover:bg-[#00b4ff]/20 text-[#00b4ff] border border-[#00b4ff]/30">
          Apply Changes
        </Button>
      </div>
    </div>
  )
}
