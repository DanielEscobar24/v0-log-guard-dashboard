"use client"

type AttackItem = { name: string; percentage: number; color: string }
type MetricItem = { name: string; value: number; percentage: number; color: string }

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 ring-1 ring-slate-300/70 dark:bg-[#0b0f1a] dark:ring-white/6 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(percentage, 1)}%`,
          background: `linear-gradient(90deg, ${color} 0%, ${color} 35%, ${color}dd 70%, ${color}99 100%)`,
          boxShadow: `0 0 6px ${color}44, 0 0 14px ${color}22`,
        }}
      />
    </div>
  )
}

export function TopAttackTypesPanel({ items }: { items: AttackItem[] }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Desglose de ataques
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Muestra solo los registros clasificados como ataque, agrupados por tipo.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay ataques en los datos actuales (o solo tráfico normal).</p>
      ) : (
      <div className="space-y-4">
        {items.map((attack) => (
          <div key={attack.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-foreground">{attack.name}</span>
              <span className="text-sm text-muted-foreground">{attack.percentage}%</span>
            </div>
            <ProgressBar percentage={attack.percentage} color={attack.color} />
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

// Panel de IPs de origen principales eliminado por no ser necesario

export function LabelDistributionPanel({ items }: { items: MetricItem[] }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Clasificación del tráfico
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Distribuye todos los registros almacenados en Mongo según su etiqueta de clasificación.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos de etiquetas en la colección actual.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.name}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{item.name === "Benign" ? "Normal" : item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.value.toLocaleString()} · {item.percentage.toFixed(1)}%
                </span>
              </div>
              <ProgressBar percentage={item.percentage} color={item.color} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SeverityBreakdownPanel({ items }: { items: MetricItem[] }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Desglose por severidad
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Resume cuántos registros hay en cada nivel de severidad dentro de la colección `logs`.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin severidades agregadas para mostrar.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg bg-background/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-foreground">{item.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-foreground">{item.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function CollectionSummaryPanel({
  logs,
  attacks,
  alerts,
}: {
  logs: number
  attacks: number
  alerts: number
}) {
  const normal = Math.max(0, logs - attacks)

  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Collection Summary
      </h3>
      <div className="space-y-3">
        <div className="rounded-lg bg-background/30 px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Logs</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{logs.toLocaleString()}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-background/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Normal</p>
            <p className="mt-1 text-lg font-semibold text-[#14b8a6]">{normal.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-background/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Attacks</p>
            <p className="mt-1 text-lg font-semibold text-[#f97316]">{attacks.toLocaleString()}</p>
          </div>
        </div>
        <div className="rounded-lg bg-background/30 px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Open Alerts</p>
          <p className="mt-1 text-lg font-semibold text-[#ef4444]">{alerts.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
