/**
 * El api-log-guard agrupa en Mongo con $dateToString en UTC → strings tipo "2024-04-20 21:00".
 * Aquí las interpretamos como UTC y mostramos la hora en **local** con reloj **24 h**.
 */
export function formatTrafficBucketAxisLabel(timestamp: string | undefined): string {
  if (!timestamp || timestamp === "—") return "—"
  const trimmed = timestamp.trim()
  try {
    const iso = trimmed.includes("T")
      ? trimmed
      : `${trimmed.replace(" ", "T")}:00.000Z`
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      return trimmed.length >= 16 ? trimmed.slice(11, 16) : trimmed
    }
    return d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return trimmed.length >= 16 ? trimmed.slice(11, 16) : trimmed
  }
}

/** Etiqueta larga para tooltips (día + hora local). */
export function formatTrafficBucketFullLabel(timestamp: string | undefined): string {
  if (!timestamp || timestamp === "—") return "—"
  const trimmed = timestamp.trim()
  try {
    const iso = trimmed.includes("T")
      ? trimmed
      : `${trimmed.replace(" ", "T")}:00.000Z`
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return trimmed
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return trimmed
  }
}
