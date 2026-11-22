import { CHALLENGE_HOUSES, getChallengeHouse } from './houses.js'
import { calculateVisitScore } from '../visitEngine.js'

export const CHALLENGE_PROGRESS_KEY = 'im-home-challenge-progress-v1'
export const ACTIVE_CHALLENGE_KEY = 'im-home-active-challenge-v1'
export const CHALLENGE_PROGRESS_VERSION = 1

export function createChallengeProgress() {
  return { version: CHALLENGE_PROGRESS_VERSION, houses: {}, history: [], rewardLedger: [] }
}

export function normalizeChallengeProgress(value) {
  if (value?.version !== CHALLENGE_PROGRESS_VERSION || !value.houses || typeof value.houses !== 'object') return createChallengeProgress()
  return {
    version: CHALLENGE_PROGRESS_VERSION,
    houses: value.houses,
    history: Array.isArray(value.history) ? value.history : [],
    rewardLedger: Array.isArray(value.rewardLedger) ? value.rewardLedger : [],
  }
}

export function loadChallengeProgress(storage = globalThis.localStorage) {
  try { return normalizeChallengeProgress(JSON.parse(storage?.getItem(CHALLENGE_PROGRESS_KEY) ?? 'null')) }
  catch { return createChallengeProgress() }
}

export function saveChallengeProgress(progress, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify(normalizeChallengeProgress(progress)))
    return Boolean(storage)
  } catch { return false }
}

export function isChallengeHouseUnlocked(progressValue, houseId) {
  const progress = normalizeChallengeProgress(progressValue)
  const houseIndex = CHALLENGE_HOUSES.findIndex((house) => house.id === houseId)
  if (houseIndex < 0) return false
  return houseIndex === 0 || progress.houses[CHALLENGE_HOUSES[houseIndex - 1].id]?.completed === true
}

export function challengeHouseStats(progressValue, houseId) {
  const progress = normalizeChallengeProgress(progressValue)
  const houseAttempts = progress.history.filter((attempt) => attempt.houseId === houseId).sort((a, b) => (Date.parse(b.endedAt ?? b.startedAt) || 0) - (Date.parse(a.endedAt ?? a.startedAt) || 0))
  const record = progress.houses[houseId] ?? {}
  return {
    attempts: houseAttempts.length,
    wins: houseAttempts.filter((attempt) => attempt.outcome === 'completed').length,
    failures: houseAttempts.filter((attempt) => attempt.outcome !== 'completed').length,
    bestSteps: Number.isInteger(record.bestSteps) ? record.bestSteps : null,
    bestMedal: record.bestMedal ?? null,
    completed: record.completed === true,
    lastPlayedAt: record.lastPlayedAt ?? null,
    history: houseAttempts,
  }
}

export function challengeAchievementStats(progressValue) {
  const progress = normalizeChallengeProgress(progressValue)
  const completed = progress.history.filter((attempt) => attempt.medal)
  const completedHouseCount = CHALLENGE_HOUSES.filter((house) => progress.houses[house.id]?.completed === true).length
  const bestSteps = Object.values(progress.houses).map((house) => house.bestSteps).filter(Number.isInteger)
  return {
    gold: completed.filter((attempt) => attempt.medal === 'gold').length,
    silver: completed.filter((attempt) => attempt.medal === 'silver').length,
    bronze: completed.filter((attempt) => attempt.medal === 'bronze').length,
    completedHouses: completedHouseCount,
    totalAttempts: progress.history.length,
    bestSteps: bestSteps.length ? Math.min(...bestSteps) : null,
    houses: CHALLENGE_HOUSES.map((house) => ({
      id: house.id,
      name: house.name,
      completed: progress.houses[house.id]?.completed === true,
      bestSteps: Number.isInteger(progress.houses[house.id]?.bestSteps) ? progress.houses[house.id].bestSteps : null,
      bestMedal: progress.houses[house.id]?.bestMedal ?? null,
      medals: [...new Set(progress.history.filter((attempt) => attempt.houseId === house.id && attempt.medal).map((attempt) => attempt.medal))],
      attempts: progress.history.filter((attempt) => attempt.houseId === house.id).length,
    })),
    achievements: progress.rewardLedger,
  }
}

function medalForAttempt(house, visit) {
  if (visit.outcome !== 'completed' || visit.guest.health <= 0) return null
  const minimumSteps = Math.max(1, Number(visit.minimumSteps) || Number(visit.plannedSteps) || 1)
  const steps = Number(visit.guest.stepsTaken) || 0
  if (steps <= Math.ceil(minimumSteps * house.medalThresholds.gold)) return 'gold'
  if (steps <= Math.ceil(minimumSteps * house.medalThresholds.silver)) return 'silver'
  return 'bronze'
}

export function evaluateChallengeMedal(houseId, visit) {
  const house = getChallengeHouse(houseId)
  return house ? medalForAttempt(house, visit) : null
}

const MEDAL_RANK = { bronze: 1, silver: 2, gold: 3 }

export function recordChallengeAttempt(progressValue, houseId, visit, { endedAt = new Date().toISOString() } = {}) {
  const house = getChallengeHouse(houseId)
  if (!house || !visit || !['completed', 'dead', 'stalled'].includes(visit.outcome)) return { ok: false, error: 'invalid-challenge-attempt', progress: normalizeChallengeProgress(progressValue) }
  const progress = structuredClone(normalizeChallengeProgress(progressValue))
  const duplicate = progress.history.find((attempt) => attempt.id === visit.id)
  if (duplicate) return { ok: true, duplicate: true, attempt: duplicate, progress }

  const medal = medalForAttempt(house, visit)
  const attempt = {
    id: visit.id,
    houseId,
    houseVersion: house.version,
    startedAt: visit.startedAt,
    endedAt,
    outcome: visit.outcome,
    medal,
    stepsTaken: visit.guest.stepsTaken,
    minimumSteps: visit.minimumSteps,
    damageTaken: visit.guest.damageTaken,
    remainingHealth: visit.guest.health,
    score: calculateVisitScore(visit),
    perkSelections: structuredClone(visit.perks?.selections ?? { owner: [], guest: [] }),
    difficulty: visit.guardian?.difficulty ?? null,
    equipment: visit.equipment ? structuredClone(visit.equipment) : null,
    guestPerks: structuredClone(visit.perks?.selections?.guest ?? []),
  }
  progress.history.unshift(attempt)
  const previous = progress.houses[houseId] ?? { completed: false, bestSteps: null, bestMedal: null, medals: [] }
  const bestSteps = medal ? Math.min(previous.bestSteps ?? Infinity, visit.guest.stepsTaken) : previous.bestSteps
  const bestMedal = medal && MEDAL_RANK[medal] > MEDAL_RANK[previous.bestMedal] ? medal : previous.bestMedal
  const medals = [...new Set([...(previous.medals ?? []), ...(medal ? [medal] : [])])]
  progress.houses[houseId] = {
    ...previous,
    completed: previous.completed || Boolean(medal),
    attempts: (previous.attempts ?? 0) + 1,
    wins: (previous.wins ?? 0) + (medal ? 1 : 0),
    failures: (previous.failures ?? 0) + (medal ? 0 : 1),
    bestSteps,
    bestMedal,
    medals,
    lastPlayedAt: endedAt,
  }

  const awardId = medal ? `${houseId}:${medal}` : null
  if (awardId && !progress.rewardLedger.some((reward) => reward.awardId === awardId)) {
    progress.rewardLedger.push({ awardId, houseId, medal, achievementId: `${houseId}-${medal}`, awardedAt: endedAt })
  }
  return { ok: true, duplicate: false, attempt, progress }
}

export function loadActiveChallenge(storage = globalThis.localStorage) {
  try {
    const record = JSON.parse(storage?.getItem(ACTIVE_CHALLENGE_KEY) ?? 'null')
    const house = getChallengeHouse(record?.houseId)
    if (record?.version !== 1 || !house || record.houseVersion !== house.version || record.visit?.outcome !== 'active' || record.compound?.version !== 3) return null
    if ((record.visit.visitType && record.visit.visitType !== 'challenge') || (record.visit.mapSource && record.visit.mapSource !== 'challenge-catalog') || (record.visit.houseId && record.visit.houseId !== record.houseId)) return null
    return record
  } catch { return null }
}

export function saveActiveChallenge({ houseId, compound, visit }, storage = globalThis.localStorage) {
  const house = getChallengeHouse(houseId)
  if (!house || !compound || !visit || visit.outcome !== 'active' || visit.visitType !== 'challenge' || visit.mapSource !== 'challenge-catalog' || visit.houseId !== houseId) return false
  try {
    storage?.setItem(ACTIVE_CHALLENGE_KEY, JSON.stringify({ version: 1, houseId, houseVersion: house.version, compound: structuredClone(compound), visit: structuredClone(visit), savedAt: new Date().toISOString() }))
    return Boolean(storage)
  } catch { return false }
}

export function clearActiveChallenge(storage = globalThis.localStorage, visitId) {
  try {
    const current = loadActiveChallenge(storage)
    if (visitId && current?.visit?.id !== visitId) return false
    storage?.removeItem(ACTIVE_CHALLENGE_KEY)
    return true
  } catch { return false }
}
