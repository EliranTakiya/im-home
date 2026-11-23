export function createGameplayTimer(now = Date.now()) {
  return { elapsedMs: 0, runningSince: now }
}

export function resumeGameplayTimer(visit, now = Date.now()) {
  const timer = visit?.gameplayTimer ?? { elapsedMs: 0, runningSince: null }
  return { ...visit, gameplayTimer: { elapsedMs: Math.max(0, Number(timer.elapsedMs) || 0), runningSince: Number.isFinite(timer.runningSince) ? timer.runningSince : now } }
}

export function elapsedGameplayMs(visit, now = Date.now()) {
  const timer = visit?.gameplayTimer
  const elapsed = Math.max(0, Number(timer?.elapsedMs) || 0)
  return Math.floor(elapsed + (Number.isFinite(timer?.runningSince) ? Math.max(0, now - timer.runningSince) : 0))
}

export function pauseGameplayTimer(visit, now = Date.now()) {
  return { ...visit, gameplayTimer: { elapsedMs: elapsedGameplayMs(visit, now), runningSince: null } }
}

export function serializeVisitWithPausedTimer(visit, now = Date.now()) {
  return pauseGameplayTimer(structuredClone(visit), now)
}

export function formatGameplayTime(milliseconds) {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds % 3600 / 60)
  const seconds = totalSeconds % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
