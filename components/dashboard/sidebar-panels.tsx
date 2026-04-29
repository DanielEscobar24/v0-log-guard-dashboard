"use client"

type AttackItem = { name: string; value?: number; percentage: number; color: string }
type MetricItem = { name: string; value: number; percentage: number; color: string }
type ProtocolItem = { name: string; total: number; attacks: number; attackShare: number; color: string }
type SourceItem = { ip: string; flows: number; labels: string[] }

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
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Riesgo por tipo de ataque</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Prioriza el subconjunto malicioso según su peso dentro de los ataques detectados.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay ataques en los datos actuales.</p>
      ) : (
        <div className="space-y-4">
          {items.map((attack) => (
            <div key={attack.name}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{attack.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(attack.value ?? 0).toLocaleString()} · {attack.percentage.toFixed(1)}%
                </span>
              </div>
              <ProgressBar percentage={attack.percentage} color={attack.color} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LabelDistributionPanel({ items }: { items: MetricItem[] }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Clasificación del tráfico</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Distribuye todos los flujos almacenados en Mongo según su etiqueta de clasificación.
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
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Severidad observada</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Convierte la clasificación del lote en una lectura de prioridad operativa.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin severidades agregadas para mostrar.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.name} className="rounded-lg bg-background/30 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-foreground">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-foreground">{item.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProtocolDistributionPanel({ items }: { items: ProtocolItem[] }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Protocolos con actividad sospechosa</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Mide qué protocolos concentran más volumen y qué porcentaje de ese tráfico fue marcado como ataque.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin protocolos agregados para mostrar.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.name}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.total.toLocaleString()} flujos</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.attackShare.toFixed(1)}% ataque</span>
              </div>
              <ProgressBar percentage={item.attackShare} color={item.color} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TopSourceIPsPanel({ items }: { items: SourceItem[] }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/40">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Orígenes sospechosos</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Resume las IP de origen con más eventos maliciosos para orientar la investigación inicial.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay IP de origen sospechosas en este lote.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.ip} className="rounded-lg bg-background/30 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <code className="text-xs text-foreground">{item.ip}</code>
                <span className="text-sm text-foreground">{item.flows.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.labels.slice(0, 2).join(" · ") || "Sin label"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
