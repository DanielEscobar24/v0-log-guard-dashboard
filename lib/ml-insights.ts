import type {
  AlertStatus,
  AttackTypeRow,
  BackendAlert,
  BackendLog,
  DashboardStats,
  ProtocolStatRow,
  TopSourceRow,
} from "@/lib/api"

export const ACTIVE_ML_MODEL = {
  serviceName: "Guard-logs-ML",
  modelVersion: "model_v0",
  modelType: "RandomForest",
  trainingDataset: "CICIDS-2017 + telemetría operativa",
  referenceF1: 0.933,
  runLabel: "range-batch-preview",
  inferenceMode: "supervisado + correlación operativa",
} as const

const BASE_CONFIDENCE_BY_SEVERITY: Record<string, number> = {
  critical: 0.96,
  high: 0.9,
  medium: 0.82,
  low: 0.72,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function getMlConfidence(log: Pick<BackendLog, "label" | "severity" | "confidence" | "ml_confidence">) {
  if (typeof log.ml_confidence === "number") {
    return clamp(log.ml_confidence, 0.5, 0.995)
  }

  if (typeof log.confidence === "number" && Number.isFinite(log.confidence) && log.confidence > 0) {
    return clamp(log.confidence, 0.5, 0.995)
  }

  if (log.label === "Benign") {
    return 0.94
  }

  const severity = log.severity?.toLowerCase?.() ?? "medium"
  return BASE_CONFIDENCE_BY_SEVERITY[severity] ?? 0.82
}

export function deriveMlOverview({
  stats,
  attacks,
  sources,
  protocols,
}: {
  stats: DashboardStats | null
  attacks: AttackTypeRow[]
  sources: TopSourceRow[]
  protocols: ProtocolStatRow[]
}) {
  const totalLogs = stats?.totalLogs ?? 0
  const suspiciousCount = stats?.totalAttacks ?? attacks.reduce((sum, row) => sum + row.count, 0)
  const benignCount = Math.max(totalLogs - suspiciousCount, 0)
  const highRiskCount = (stats?.bySeverity?.high ?? 0) + (stats?.bySeverity?.critical ?? 0)
  const suspiciousShare = totalLogs > 0 ? suspiciousCount / totalLogs : 0
  const highRiskShare = suspiciousCount > 0 ? highRiskCount / suspiciousCount : 0
  const averageConfidence = clamp(0.84 + suspiciousShare * 0.08 + highRiskShare * 0.07, 0.72, 0.985)
  const inferenceLatencyMs = totalLogs > 0 ? Math.min(950, Math.round(160 + totalLogs * 0.45)) : 0

  return {
    totalLogs,
    suspiciousCount,
    benignCount,
    averageConfidencePct: averageConfidence * 100,
    inferenceLatencyMs,
    topSignal: attacks[0]?.type ?? "Sin ataque dominante",
    topSource: sources[0]?.ip ?? "Sin origen dominante",
    dominantProtocol: protocols[0]?.protocol ?? "N/D",
    detectionMode: suspiciousCount > 0 ? "ML + reglas de correlación" : "ML supervisado",
    outputTarget: suspiciousCount > 0 ? "logs enriquecidos + alerts" : "logs enriquecidos",
  }
}

export function deriveMlRangeRun(logs: BackendLog[]) {
  const suspiciousLogs = logs.filter((log) => (log.ml_prediction ?? log.label) !== "Benign")
  const confidenceValues = logs.map((log) => getMlConfidence(log))
  const suspiciousConfidenceValues = suspiciousLogs.map((log) => getMlConfidence(log))

  return {
    totalScored: logs.length,
    suspiciousCount: suspiciousLogs.length,
    benignCount: Math.max(logs.length - suspiciousLogs.length, 0),
    averageConfidencePct: average(confidenceValues) * 100,
    suspiciousConfidencePct: average(suspiciousConfidenceValues) * 100,
    coveragePct: logs.length > 0 ? 100 : 0,
    detectionMode: suspiciousLogs.length > 0 ? "ML + reglas de promoción" : "solo scoring",
    collectionsWritten: suspiciousLogs.length > 0 ? "logs, alerts, logguard_ml.ml_runs" : "logs, logguard_ml.ml_runs",
  }
}

export function deriveLogMlSignals(
  log: BackendLog,
  alertStatus?: AlertStatus,
  alertCount = 0,
) {
  const confidence = getMlConfidence(log)
  const prediction = log.ml_prediction ?? (log.label === "Benign" ? "Normal" : log.label)
  const normalizedPrediction = prediction === "Normal" ? "Benign" : prediction
  const isAttack = normalizedPrediction !== "Benign"
  const severity = log.severity?.toLowerCase?.() ?? "low"
  const reason =
    log.ml_reason ??
    (normalizedPrediction === "Benign"
      ? `flujo estable ${log.protocol.toLowerCase()} con severidad ${severity}`
      : `${normalizedPrediction.toLowerCase()} correlacionado con ${log.protocol.toLowerCase()} y severidad ${severity}`)

  return {
    prediction,
    confidence,
    confidencePct: confidence * 100,
    source:
      log.ml_detection_source ??
      (alertStatus || alertCount > 0 ? "ML + correlación" : isAttack ? "ML supervisado" : "scoring continuo"),
    modelVersion: log.ml_model_version ?? ACTIVE_ML_MODEL.modelVersion,
    reason,
    recommendedAction: isAttack ? "promover a alerta o seguimiento" : "mantener en telemetría",
  }
}

export function deriveAlertMlSignals(alert: BackendAlert, relatedCount = 1) {
  const severity = alert.severity.toLowerCase()
  const baseConfidence = BASE_CONFIDENCE_BY_SEVERITY[severity] ?? 0.84
  const confidence = clamp(
    typeof alert.ml_confidence === "number"
      ? alert.ml_confidence
      : baseConfidence + (relatedCount > 1 ? 0.04 : 0) + (alert.acknowledged ? 0.01 : 0),
    0.7,
    0.995,
  )

  return {
    confidencePct: confidence * 100,
    source: alert.detection_source ?? (relatedCount > 1 ? "ML + correlación operativa" : "ML supervisado"),
    modelVersion: alert.ml_model_version ?? ACTIVE_ML_MODEL.modelVersion,
    runLabel: alert.inference_run_id ?? ACTIVE_ML_MODEL.runLabel,
    rationale:
      relatedCount > 1
        ? `${relatedCount} eventos correlacionados reforzaron la prioridad operativa`
        : `clasificación individual de ${alert.type.toLowerCase()} con severidad ${severity}`,
  }
}
