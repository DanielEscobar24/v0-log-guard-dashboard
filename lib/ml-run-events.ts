import type { MlRunSummary } from "@/lib/api"

const ML_RUN_EVENT_NAME = "logguard:ml-run-completed"
const ML_RUN_STORAGE_KEY = "logguard:ml-run"

export function publishMlRunEvent(run: MlRunSummary) {
  if (typeof window === "undefined") return

  const payload = JSON.stringify({
    ...run,
    emittedAt: Date.now(),
  })

  try {
    window.localStorage.setItem(ML_RUN_STORAGE_KEY, payload)
  } catch {}

  window.dispatchEvent(
    new CustomEvent<MlRunSummary>(ML_RUN_EVENT_NAME, {
      detail: run,
    }),
  )
}

export function subscribeMlRunEvents(handler: (run: MlRunSummary) => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const onCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<MlRunSummary>).detail
    if (detail) {
      handler(detail)
    }
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== ML_RUN_STORAGE_KEY || !event.newValue) return
    try {
      handler(JSON.parse(event.newValue) as MlRunSummary)
    } catch {}
  }

  window.addEventListener(ML_RUN_EVENT_NAME, onCustomEvent as EventListener)
  window.addEventListener("storage", onStorage)

  return () => {
    window.removeEventListener(ML_RUN_EVENT_NAME, onCustomEvent as EventListener)
    window.removeEventListener("storage", onStorage)
  }
}
