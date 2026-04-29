import type { DateRange } from "react-day-picker"

const DASHBOARD_RANGE_STORAGE_KEY = "logguard.dashboard.range"

type StoredRange = {
  from?: string
  to?: string
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getDefaultDashboardRange() {
  const today = startOfDay(new Date())
  return { from: today, to: today }
}

export function loadDashboardRange(): DateRange {
  if (typeof window === "undefined") return getDefaultDashboardRange()

  try {
    const raw = window.localStorage.getItem(DASHBOARD_RANGE_STORAGE_KEY)
    if (!raw) return getDefaultDashboardRange()

    const parsed = JSON.parse(raw) as StoredRange
    const from = parsed.from ? startOfDay(new Date(parsed.from)) : undefined
    const to = parsed.to ? startOfDay(new Date(parsed.to)) : from

    if (!from || Number.isNaN(from.getTime())) return getDefaultDashboardRange()
    if (!to || Number.isNaN(to.getTime())) return { from, to: from }

    return { from, to }
  } catch {
    return getDefaultDashboardRange()
  }
}

export function saveDashboardRange(range: DateRange) {
  if (typeof window === "undefined") return

  const payload: StoredRange = {
    from: range.from?.toISOString(),
    to: (range.to ?? range.from)?.toISOString(),
  }

  window.localStorage.setItem(DASHBOARD_RANGE_STORAGE_KEY, JSON.stringify(payload))
}
