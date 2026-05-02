"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import type { DateRange, DayMouseEventHandler } from "react-day-picker"
import { CalendarDays, Download, Loader2, RefreshCw, Zap } from "lucide-react"
import { List, type RowComponentProps } from "react-window"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getActiveMlModel, getLogs, runMlRange, type BackendLog, type MlActiveModel, type MlRunSummary } from "@/lib/api"
import { labelBadgeClass } from "@/lib/label-styles"
import { ACTIVE_ML_MODEL, deriveMlRangeRun } from "@/lib/ml-insights"
import { publishMlRunEvent } from "@/lib/ml-run-events"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface LiveStreamTableProps {
  initialLogs?: BackendLog[]
  initialRange?: DateRange
  onRangeApply?: (range: DateRange) => void
  onMlRunComplete?: (run: MlRunSummary) => void
}

type SeveritySummaryItem = {
  name: string
  value: number
  percentage: number
  color: string
}

type LogRowProps = {
  logs: BackendLog[]
  formatTime: (timestamp: string) => string
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff4d6d",
  high: "#ff9f1c",
  medium: "#00c2ff",
  low: "#7dffb3",
}

const MAX_ANALYSIS_DAYS = 15
const LOG_ROW_HEIGHT = 56
const LOG_TABLE_HEIGHT = 500
const LOG_GRID_COLUMNS = "minmax(110px,0.85fr) minmax(180px,1.35fr) minmax(180px,1.35fr) minmax(120px,0.8fr) minmax(130px,0.95fr) minmax(140px,0.9fr)"

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function getCalendarAnchorMonth(range: DateRange, today: Date) {
  if (range.from && range.to) {
    const fromMonth = range.from.getMonth()
    const fromYear = range.from.getFullYear()
    const toMonth = range.to.getMonth()
    const toYear = range.to.getFullYear()

    if (fromMonth === toMonth && fromYear === toYear) {
      return addMonths(startOfMonth(range.to), -1)
    }

    return startOfMonth(range.from)
  }

  if (range.from) {
    return addMonths(startOfMonth(range.from), -1)
  }

  return addMonths(startOfMonth(today), -1)
}

function formatDateInput(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function formatDateTimeRange(dateValue: string, endOfDay = false) {
  return `${dateValue}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
}

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00`)
}

function pluralizeDays(days: number) {
  return `${days} día${days === 1 ? "" : "s"}`
}

function buildCsv(logs: BackendLog[]) {
  const headers = ["timestamp", "src_ip", "dst_ip", "protocol", "duration", "label", "severity"]
  const rows = logs.map((log) =>
    [
      log.timestamp,
      log.src_ip,
      log.dst_ip,
      log.protocol,
      log.duration ?? "",
      (log.ml_prediction ?? log.label) === "Benign" ? "Normal" : (log.ml_prediction ?? log.label),
      log.severity ?? "",
    ]
      .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
      .join(","),
  )

  return [headers.join(","), ...rows].join("\n")
}

function getRangeValidationMessage(range: DateRange) {
  if (!range.from) {
    return "Debes seleccionar una fecha inicial."
  }

  const from = startOfDay(range.from)
  const to = startOfDay(range.to ?? range.from)

  if (from.getTime() > to.getTime()) {
    return "La fecha inicial no puede ser posterior a la fecha final."
  }

  const totalDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1
  if (totalDays > MAX_ANALYSIS_DAYS) {
    return `El rango supera el límite de ${MAX_ANALYSIS_DAYS} días por ${pluralizeDays(totalDays - MAX_ANALYSIS_DAYS)}.`
  }

  return null
}

function getDraftHelperMessage(range: DateRange) {
  if (!range.from) {
    return "Selecciona una fecha inicial."
  }

  if (!range.to) {
    return "Haz clic en una fecha final o acepta para analizar solo este día."
  }

  return getRangeValidationMessage(range) ?? `Máximo ${MAX_ANALYSIS_DAYS} días por análisis.`
}

function LogVirtualRow({
  index,
  style,
  logs,
  formatTime,
}: RowComponentProps<LogRowProps>) {
  const log = logs[index]

  if (!log) {
    return null
  }

  return (
    <div
      style={style}
      className={cn(
        "border-b border-border/30 transition-colors hover:bg-background/30",
        index === 0 && "animate-in fade-in duration-500",
      )}
    >
      <div
        className="grid h-full items-center px-5"
        style={{ gridTemplateColumns: LOG_GRID_COLUMNS }}
      >
        <div className="pr-4 font-mono text-sm text-muted-foreground">{formatTime(log.timestamp)}</div>
        <div className="pr-4 font-mono text-sm text-foreground">
          {log.src_ip}
        </div>
        <div className="pr-4 font-mono text-sm text-foreground">{log.dst_ip}</div>
        <div className="pr-4 text-sm text-muted-foreground">{log.protocol}</div>
        <div className="pr-4 text-sm text-muted-foreground">{log.duration?.toFixed(3) ?? "—"}</div>
        <div>
          <span className={cn("rounded px-2.5 py-1 text-xs font-medium", labelBadgeClass(log.ml_prediction ?? log.label))}>
            {((log.ml_prediction ?? log.label) === "Benign" ? "Normal" : (log.ml_prediction ?? log.label)).toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}

export function LiveStreamTable({ initialLogs = [], initialRange, onRangeApply, onMlRunComplete }: LiveStreamTableProps) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const normalizedInitialRange = useMemo(
    () => ({
      from: initialRange?.from ? startOfDay(initialRange.from) : today,
      to: initialRange?.to ? startOfDay(initialRange.to) : initialRange?.from ? startOfDay(initialRange.from) : today,
    }),
    [initialRange, today],
  )
  const [logs, setLogs] = useState<BackendLog[]>(initialLogs)
  const [totalMatchingLogs, setTotalMatchingLogs] = useState(initialLogs.length)
  const [isLoading, setIsLoading] = useState(false)
  const [isRunningDiagnosis, setIsRunningDiagnosis] = useState(false)
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false)
  const [rangeTouched, setRangeTouched] = useState(false)
  const [appliedRange, setAppliedRange] = useState<DateRange>(normalizedInitialRange)
  const [draftRange, setDraftRange] = useState<DateRange>(normalizedInitialRange)
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => getCalendarAnchorMonth(normalizedInitialRange, today))
  const [severitySummary, setSeveritySummary] = useState<SeveritySummaryItem[]>([])
  const [activeModel, setActiveModel] = useState<MlActiveModel | null>(null)
  const [lastMlRun, setLastMlRun] = useState<MlRunSummary | null>(null)
  const requestSequence = useRef(0)

  useEffect(() => {
    setAppliedRange(normalizedInitialRange)
    setDraftRange(normalizedInitialRange)
    setVisibleMonth(getCalendarAnchorMonth(normalizedInitialRange, today))
  }, [normalizedInitialRange, today])

  const formattedAppliedRange = useMemo(
    () => ({
      from: appliedRange.from ? formatDateInput(appliedRange.from) : "",
      to: appliedRange.to ? formatDateInput(appliedRange.to) : "",
    }),
    [appliedRange.from, appliedRange.to],
  )

  const appliedRangeError = useMemo(() => getRangeValidationMessage(appliedRange), [appliedRange])
  const draftRangeError = useMemo(() => getRangeValidationMessage(draftRange), [draftRange])
  const isAppliedRangeValid = !appliedRangeError
  const isDraftRangeValid = !draftRangeError

  const orderedSeveritySummary = useMemo(
    () =>
      [...severitySummary].sort((a, b) => {
        const left = SEVERITY_ORDER[a.name.toLowerCase()] ?? 99
        const right = SEVERITY_ORDER[b.name.toLowerCase()] ?? 99
        return left - right
      }),
    [severitySummary],
  )
  const mlRunSummary = useMemo(() => deriveMlRangeRun(logs), [logs])
  const displayedRunSummary = lastMlRun
    ? {
        totalScored: lastMlRun.totalScored,
        suspiciousCount: lastMlRun.suspiciousCount,
        averageConfidencePct: lastMlRun.averageConfidencePct,
        collectionsWritten: lastMlRun.collectionsWritten,
      }
    : mlRunSummary
  const displayedModel = {
    serviceName: activeModel?.serviceName ?? ACTIVE_ML_MODEL.serviceName,
    modelVersion: lastMlRun?.modelVersion ?? activeModel?.modelVersion ?? ACTIVE_ML_MODEL.modelVersion,
  }

  const rangeLabel = useMemo(() => {
    if (appliedRange.from && appliedRange.to) {
      return `${format(appliedRange.from, "dd MMM yyyy")} - ${format(appliedRange.to, "dd MMM yyyy")}`
    }
    if (appliedRange.from) {
      return `${format(appliedRange.from, "dd MMM yyyy")} - Selecciona fin`
    }
    return "Selecciona un rango"
  }, [appliedRange.from, appliedRange.to])

  const draftTriggerLabel = useMemo(() => {
    if (draftRange.from && draftRange.to) {
      return `${format(draftRange.from, "dd MMM yyyy")} - ${format(draftRange.to, "dd MMM yyyy")}`
    }
    if (draftRange.from) {
      return `${format(draftRange.from, "dd MMM yyyy")} - Selecciona fin`
    }
    return "Selecciona un rango"
  }, [draftRange.from, draftRange.to])

  const draftRangeLabel = useMemo(() => {
    if (draftRange.from && draftRange.to) {
      return `${format(draftRange.from, "MM/dd/yyyy")} 12:00 AM ~ ${format(draftRange.to, "MM/dd/yyyy")} 11:59 PM`
    }
    if (draftRange.from) {
      return `${format(draftRange.from, "MM/dd/yyyy")} 12:00 AM ~ Selecciona fin`
    }
    return "Selecciona un rango"
  }, [draftRange.from, draftRange.to])

  const helperText = useMemo(() => {
    if (!rangeTouched) return `Máximo ${MAX_ANALYSIS_DAYS} días por análisis.`
    return getDraftHelperMessage(draftRange)
  }, [draftRange, rangeTouched])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return timestamp
    return date.toLocaleTimeString("es-ES", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const loadLogs = async (from: string, to: string) => {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId

    setIsLoading(true)
    try {
      const firstPage = await getLogs({
        limit: 500,
        page: 1,
        from: formatDateTimeRange(from),
        to: formatDateTimeRange(to, true),
      })

      let allLogs = firstPage.logs
      const totalPages = firstPage.pagination.pages

      if (totalPages > 1) {
        const pageRequests = Array.from({ length: totalPages - 1 }, (_, index) =>
          getLogs({
            limit: 500,
            page: index + 2,
            from: formatDateTimeRange(from),
            to: formatDateTimeRange(to, true),
          }),
        )

        const remainingPages = await Promise.all(pageRequests)
        allLogs = [...allLogs, ...remainingPages.flatMap((page) => page.logs)]
      }

      if (requestSequence.current !== requestId) return

      setLogs(allLogs)
      setTotalMatchingLogs(firstPage.pagination.total)

      const entries = Object.entries(firstPage.summary?.bySeverity ?? {})
        .filter(([, value]) => value > 0)
        .sort((a, b) => {
          const left = SEVERITY_ORDER[a[0].toLowerCase()] ?? 99
          const right = SEVERITY_ORDER[b[0].toLowerCase()] ?? 99
          return left - right
        })

      const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1

      setSeveritySummary(
        entries.map(([name, value]) => ({
          name,
          value,
          percentage: (value / total) * 100,
          color: SEVERITY_COLORS[name.toLowerCase()] ?? "#19e6cf",
        })),
      )
    } catch (error) {
      if (requestSequence.current !== requestId) return

      toast({
        variant: "destructive",
        title: "No se pudieron cargar los registros",
        description: error instanceof Error ? error.message : "Inténtalo de nuevo en unos segundos.",
      })
    } finally {
      if (requestSequence.current === requestId) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!isAppliedRangeValid || !formattedAppliedRange.from || !formattedAppliedRange.to) return
    void loadLogs(formattedAppliedRange.from, formattedAppliedRange.to)
  }, [formattedAppliedRange.from, formattedAppliedRange.to, isAppliedRangeValid])

  useEffect(() => {
    setLastMlRun(null)
  }, [formattedAppliedRange.from, formattedAppliedRange.to])

  useEffect(() => {
    let active = true
    void getActiveMlModel()
      .then((model) => {
        if (!active) return
        setActiveModel(model)
      })
      .catch(() => {
        if (!active) return
        setActiveModel(null)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (isRangePickerOpen) {
      setDraftRange(appliedRange)
      setRangeTouched(false)
      setVisibleMonth(getCalendarAnchorMonth(appliedRange, today))
    }
  }, [isRangePickerOpen, appliedRange, today])

  const handleRangeDayClick: DayMouseEventHandler = (day, modifiers) => {
    if (modifiers.disabled) return

    const clickedDay = startOfDay(day)
    setRangeTouched(true)

    setDraftRange((current) => {
      if (!current.from || (current.from && current.to)) {
        return { from: clickedDay, to: undefined }
      }

      const currentFrom = startOfDay(current.from)
      if (clickedDay.getTime() < currentFrom.getTime()) {
        return { from: clickedDay, to: currentFrom }
      }

      return { from: currentFrom, to: clickedDay }
    })
  }

  const applyPresetRange = (days: number) => {
    const end = today
    const start = new Date(end)
    start.setDate(end.getDate() - (days - 1))
    setRangeTouched(true)
    const nextRange = { from: start, to: end }
    setDraftRange(nextRange)
    setVisibleMonth(getCalendarAnchorMonth(nextRange, today))
  }

  const applyYesterdayRange = () => {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    setRangeTouched(true)
    const nextRange = { from: yesterday, to: yesterday }
    setDraftRange(nextRange)
    setVisibleMonth(getCalendarAnchorMonth(nextRange, today))
  }

  const applyDraftRange = () => {
    setRangeTouched(true)
    if (!isDraftRangeValid || !draftRange.from) return
    const nextRange = {
      from: draftRange.from,
      to: draftRange.to ?? draftRange.from,
    }
    setAppliedRange(nextRange)
    onRangeApply?.(nextRange)
    setIsRangePickerOpen(false)
  }

  const cancelDraftRange = () => {
    setDraftRange(appliedRange)
    setRangeTouched(false)
    setIsRangePickerOpen(false)
  }

  const handleDownload = () => {
    const csv = buildCsv(logs)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `logguard-registros-${formattedAppliedRange.from}-${formattedAppliedRange.to}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const runDiagnosis = async () => {
    if (!isAppliedRangeValid || !formattedAppliedRange.from || !formattedAppliedRange.to) return
    setIsRunningDiagnosis(true)
    try {
      const run = await runMlRange({
        from: formatDateTimeRange(formattedAppliedRange.from),
        to: formatDateTimeRange(formattedAppliedRange.to, true),
        triggerSource: "dashboard-range",
        autoTrain: true,
        forceRetrain: true,
      })

      setLastMlRun(run)
      setActiveModel((current) =>
        current
          ? { ...current, modelVersion: run.modelVersion, modelType: run.modelType }
          : {
              serviceName: ACTIVE_ML_MODEL.serviceName,
              modelVersion: run.modelVersion,
              modelType: run.modelType,
              trainingDataset: ACTIVE_ML_MODEL.trainingDataset,
              referenceF1: ACTIVE_ML_MODEL.referenceF1,
              inferenceMode: ACTIVE_ML_MODEL.inferenceMode,
              trainedAt: run.finishedAt,
              featureNames: [],
              totalTrainingRows: 0,
              testRows: 0,
              isActive: true,
              thresholdF1: 0,
            },
      )

      await loadLogs(formattedAppliedRange.from, formattedAppliedRange.to)
      publishMlRunEvent(run)
      onMlRunComplete?.(run)

      toast({
        title: run.trainedModel ? "Modelo entrenado y corrida completada" : "Corrida Guard-logs-ML completada",
        description: `Se puntuaron ${run.totalScored.toLocaleString()} registros y ${run.suspiciousCount.toLocaleString()} pasaron a seguimiento. Modelo activo: ${run.modelVersion}.`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo ejecutar la corrida ML",
        description: error instanceof Error ? error.message : "Guard-logs-ML no respondió como se esperaba.",
      })
    } finally {
      setIsRunningDiagnosis(false)
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border/40">
      <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              CICIDS-2017 — filtro y análisis de registros
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Selecciona un rango sobre la colección{" "}
              <code className="rounded bg-background/60 px-1 py-0.5">logs</code> para revisar,
              descargar o enviarlo a una corrida ML posterior.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mostrando {logs.length.toLocaleString()} de {totalMatchingLogs.toLocaleString()} registros del rango seleccionado.
            </p>
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-300">
                {displayedModel.serviceName}
              </span>
              <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {displayedModel.modelVersion}
              </span>
              <span className="rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                batch sobre rango
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Scoring</p>
                <p className="mt-1 text-sm font-medium text-foreground">{displayedRunSummary.totalScored.toLocaleString()} logs</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Priorizados</p>
                <p className="mt-1 text-sm font-medium text-foreground">{displayedRunSummary.suspiciousCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Confianza media</p>
                <p className="mt-1 text-sm font-medium text-foreground">{displayedRunSummary.averageConfidencePct.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Persistencia</p>
                <p className="mt-1 text-sm font-medium text-foreground">{displayedRunSummary.collectionsWritten}</p>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Esta tarjeta ahora resume la última corrida ejecutada sobre el rango o, si aún no hay una, la salida
              estimada que se persistirá en <code className="rounded bg-background/60 px-1">logguard_ml.ml_runs</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Popover open={isRangePickerOpen} onOpenChange={setIsRangePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 min-w-[320px] justify-start rounded-lg border-border bg-card text-left font-normal shadow-sm"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span className="truncate">{isRangePickerOpen ? draftTriggerLabel : rangeLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto border-border bg-card p-0 shadow-2xl">
                <div className="border-b border-border px-5 py-3">
                  <p className="text-sm font-semibold text-foreground">{draftRangeLabel}</p>
                </div>

                <Calendar
                  mode="range"
                  weekStartsOn={1}
                  numberOfMonths={2}
                  selected={draftRange}
                  month={visibleMonth}
                  onMonthChange={setVisibleMonth}
                  className="rounded-xl bg-card"
                  classNames={{
                    root: "rounded-xl bg-card p-5",
                    months: "flex flex-col gap-6 md:flex-row md:gap-8",
                    month: "flex flex-col gap-4",
                    month_caption: "mb-2 text-foreground",
                    caption_label: "text-foreground font-semibold",
                    weekdays: "mb-2 grid grid-cols-7 gap-0",
                    weekday: "text-center text-xs tracking-wide text-muted-foreground",
                    week: "grid grid-cols-7 gap-0",
                    day: "text-foreground",
                    outside: "text-muted-foreground/45",
                    today:
                      "rounded-md border border-sky-400/80 text-foreground shadow-[0_0_0_1px_rgba(56,189,248,0.18)] data-[selected=true]:border-primary-foreground data-[selected=true]:rounded-none",
                    range_start: "bg-primary",
                    range_middle: "bg-accent",
                    range_end: "bg-primary",
                  }}
                  onDayClick={handleRangeDayClick}
                  disabled={{ after: today }}
                />

                <div className="border-t border-border px-5 py-3">
                  <p
                    className={cn(
                      "text-xs",
                      rangeTouched && draftRangeError ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {helperText}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" className="h-8 px-3 text-xs text-primary" onClick={() => applyPresetRange(1)}>
                        Hoy
                      </Button>
                      <Button type="button" variant="ghost" className="h-8 px-3 text-xs text-primary" onClick={applyYesterdayRange}>
                        Ayer
                      </Button>
                      <Button type="button" variant="ghost" className="h-8 px-3 text-xs text-primary" onClick={() => applyPresetRange(7)}>
                        Últimos 7 días
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" className="h-9 px-3" onClick={cancelDraftRange}>
                        Cancelar
                      </Button>
                      <Button type="button" className="h-9 px-4" onClick={applyDraftRange} disabled={!isDraftRangeValid}>
                        Aceptar
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {orderedSeveritySummary.length > 0 && (
            <div className="flex flex-wrap gap-2" style={{ width: "fit-content" }}>
              {orderedSeveritySummary.map((item) => (
                <div key={item.name} className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {SEVERITY_LABELS[item.name.toLowerCase()] ?? item.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 self-end xl:max-w-[320px] xl:self-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => {
              if (isAppliedRangeValid && formattedAppliedRange.from && formattedAppliedRange.to) {
                void loadLogs(formattedAppliedRange.from, formattedAppliedRange.to)
              }
            }}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={handleDownload}
            disabled={logs.length === 0}
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            onClick={() => void runDiagnosis()}
            disabled={isRunningDiagnosis || !isAppliedRangeValid}
            className="h-9 rounded-lg bg-sidebar-accent/70 px-3 text-sidebar-primary hover:bg-sidebar-accent"
          >
            {isRunningDiagnosis ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Ejecutar corrida ML
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="border-b border-border/40 bg-background/30">
            <div
              className="grid px-5 py-3"
              style={{ gridTemplateColumns: LOG_GRID_COLUMNS }}
            >
              <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Hora</div>
              <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">IP origen</div>
              <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">IP destino</div>
              <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Protocolo</div>
              <div className="pr-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Duración (s)</div>
              <div className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Clasificación</div>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No hay logs para el rango seleccionado. Verifica que el api-log-guard esté en marcha y que la colección{" "}
              <code className="rounded bg-muted px-1">logs</code> tenga documentos.
            </div>
          ) : (
            <List
              rowComponent={LogVirtualRow}
              rowCount={logs.length}
              rowHeight={() => LOG_ROW_HEIGHT}
              rowProps={{ logs, formatTime }}
              overscanCount={8}
              defaultHeight={LOG_TABLE_HEIGHT}
              style={{ height: LOG_TABLE_HEIGHT, width: "100%" }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
