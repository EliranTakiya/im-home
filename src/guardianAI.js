import { findShortestPath } from './navigation.js'
import { hostPerkAvailability } from './perkEffects.js'

export const GUARDIAN_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: 'קל', appearanceChance: 0.42, entryMin: 0.28, entryMax: 0.78, stayMinSeconds: 9, stayMaxSeconds: 17, routeLookahead: 2, controlHealth: 28, actionChance: 0.42 }),
  normal: Object.freeze({ label: 'רגיל', appearanceChance: 0.7, entryMin: 0.12, entryMax: 0.88, stayMinSeconds: 12, stayMaxSeconds: 24, routeLookahead: 4, controlHealth: 48, actionChance: 0.68 }),
  hard: Object.freeze({ label: 'קשה', appearanceChance: 0.9, entryMin: 0.04, entryMax: 0.94, stayMinSeconds: 16, stayMaxSeconds: 32, routeLookahead: 7, controlHealth: 68, actionChance: 0.9 }),
})

export function guardianAllowedForVisit({ visitType, ownerMode }) {
  return visitType === 'challenge' && ownerMode === 'ai'
}

export function humanOwnerCanAct(visit, isChallengeHouse = false) {
  return !isChallengeHouse && visit?.ownerMode === 'human'
}

function hash(value) {
  let result = 2166136261
  for (const character of String(value)) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function randomFor(seed, salt) {
  let value = hash(`${seed}:${salt}`)
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return (value >>> 0) / 4294967296
}

export function createGuardianState(visitId, difficulty = 'normal') {
  const profile = GUARDIAN_DIFFICULTIES[difficulty] ? difficulty : 'normal'
  const seed = hash(visitId)
  const roll = (salt) => randomFor(seed, salt)
  const willAppear = roll('appearance') < GUARDIAN_DIFFICULTIES[profile].appearanceChance
  const range = GUARDIAN_DIFFICULTIES[profile]
  return {
    version: 1,
    difficulty: profile,
    phase: willAppear ? 'waiting' : 'absent',
    entryProgress: range.entryMin + roll('entry') * (range.entryMax - range.entryMin),
    staySeconds: Math.round(range.stayMinSeconds + roll('duration') * (range.stayMaxSeconds - range.stayMinSeconds)),
    enteredAt: null,
    retreatAt: null,
    lastDecisionStep: -1,
    decisionsMade: 0,
    eventLog: [],
  }
}

function routeTrap(compound, visit, lookahead) {
  const destination = visit.stage === 'outbound' ? visit.target : visit.entrance
  let route
  try { route = findShortestPath(compound, visit.guest.position, destination, visit) }
  catch { return null }
  const upcoming = route.slice(1, lookahead + 1)
  const candidates = compound.items.filter((trap) => trap.type === 'trap' && !visit.trapStates?.[trap.id]?.triggered && !visit.trapStates?.[trap.id]?.reinforcementMultiplier)
    .map((trap) => ({ trap, distance: upcoming.findIndex((point) => point.x === trap.x && point.y === trap.y) + 1 }))
    .filter(({ distance }) => distance > 0)
    .sort((a, b) => a.distance - b.distance)
  return candidates[0]?.trap ?? null
}

function selectedOwnerPerks(visit) {
  return visit.perks?.selections?.owner ?? []
}

function canUse(visit, perkId, now) {
  if (!selectedOwnerPerks(visit).includes(perkId)) return false
  const count = visit.perks?.activations?.owner?.[perkId] ?? 0
  const definition = { id: perkId, role: 'owner', maxActivationsPerVisit: perkId === 'spectator-control' ? 2 : 1,
    effect: perkId === 'spectator-control' ? 'spectator-stun' : 'other',
    effectConfig: perkId === 'spectator-control' ? { energyCost: 25, energyPerVisit: 50, cooldownMs: 30000 } : {} }
  return count < definition.maxActivationsPerVisit && hostPerkAvailability(visit, definition, now).ok
}

function decidePerk(guardian, compound, visit, now) {
  const profile = GUARDIAN_DIFFICULTIES[guardian.difficulty] ?? GUARDIAN_DIFFICULTIES.normal
  const step = visit.guest.stepsTaken
  const roll = (tag) => randomFor(`${visit.id}:${guardian.difficulty}`, `${step}:${tag}`)
  const stepRatio = visit.stepBudget ? step / visit.stepBudget : 0
  const controlPressure = visit.guest.health <= profile.controlHealth || guardian.difficulty !== 'easy' && (stepRatio >= (guardian.difficulty === 'hard' ? 0.58 : 0.72) || visit.stage === 'returning' && stepRatio >= 0.5)

  if (canUse(visit, 'spectator-control', now) && controlPressure && roll('control') < profile.actionChance) {
    return { perkId: 'spectator-control' }
  }

  const trap = routeTrap(compound, visit, profile.routeLookahead)
  if (trap && canUse(visit, 'trap-reinforcement', now) && roll(`reinforce:${trap.id}`) < profile.actionChance) {
    return { perkId: 'trap-reinforcement', trapId: trap.id }
  }

  return null
}

export function evaluateGuardian(guardianValue, compound, visit, { now = Date.now() } = {}) {
  if (!guardianAllowedForVisit({ visitType: visit?.visitType, ownerMode: visit?.ownerMode }) || !guardianValue || !visit || visit.outcome !== 'active') return { guardian: guardianValue, changed: false, action: null }
  let guardian = structuredClone(guardianValue)
  let changed = false
  const event = (type, details = {}) => {
    guardian.eventLog.push({ type, at: now, step: visit.guest.stepsTaken, ...details })
    changed = true
  }

  if (guardian.phase === 'waiting') {
    const progress = visit.stepBudget > 0 ? visit.guest.stepsTaken / visit.stepBudget : 0
    if (progress >= guardian.entryProgress) {
      guardian.phase = 'present'
      guardian.enteredAt = now
      guardian.retreatAt = now + guardian.staySeconds * 1000
      event('entered')
    }
  }

  if (guardian.phase === 'present' && guardian.retreatAt <= now) {
    guardian.phase = 'retreated'
    event('retreated')
  }

  if (guardian.phase === 'present' && guardian.lastDecisionStep !== visit.guest.stepsTaken && now - (guardian.enteredAt ?? now) >= 3000) {
    const profile = GUARDIAN_DIFFICULTIES[guardian.difficulty] ?? GUARDIAN_DIFFICULTIES.normal
    const noImmediateThreat = !routeTrap(compound, visit, Math.min(3, profile.routeLookahead))
    const hasBreathingRoom = visit.guest.health >= profile.controlHealth && visit.guest.stepsTaken / Math.max(1, visit.stepBudget) >= 0.3
    const retreatChance = guardian.difficulty === 'easy' ? 0.2 : guardian.difficulty === 'normal' ? 0.09 : 0.025
    if (noImmediateThreat && hasBreathingRoom && randomFor(`${visit.id}:${guardian.difficulty}`, `${visit.guest.stepsTaken}:retreat`) < retreatChance) {
      guardian.phase = 'retreated'
      event('retreated-early')
    }
  }

  if (guardian.phase !== 'present' || guardian.lastDecisionStep === visit.guest.stepsTaken) {
    return { guardian, changed, action: null }
  }

  guardian.lastDecisionStep = visit.guest.stepsTaken
  guardian.decisionsMade += 1
  changed = true
  const action = decidePerk(guardian, compound, visit, now)
  return { guardian, changed, action }
}
