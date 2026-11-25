export const COMPACT_VISIT_EVENT_LIMIT = 5

/** Return a newest-first view without mutating or truncating the saved event history. */
export function getRecentVisitEvents(events, limit = COMPACT_VISIT_EVENT_LIMIT) {
  if (!Array.isArray(events) || !Number.isFinite(limit) || limit <= 0) return []
  const count = Math.floor(limit)
  return events.slice(Math.max(0, events.length - count)).reverse()
}
