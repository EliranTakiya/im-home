import { MAP_ROWS } from './compound.js'
import { TRAP_TYPES } from './traps.js'
import { createVisitPerkState } from './perks.js'
import { EQUIPMENT_CATALOG, toolsForTrapEncounter, consumeToolUse } from './equipment.js'

export const VISIT_RESULTS_KEY = 'im-home-visit-results-v1'
export const ACTIVE_VISIT_KEY = 'im-home-active-visit-v1'
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]]
const key = ({ x, y }) => `${x}:${y}`
const copy = (value) => structuredClone(value)

function entranceOf(compound) {
  return compound.map.entrances[0] ?? compound.map.exits[0] ?? { x: 5, y: MAP_ROWS - 1 }
}

function blockedTiles(compound, visit) {
  return new Set(compound.items.filter((item) => item.type === 'trap' && item.trapType === 'door' && (visit.trapStates[item.id]?.lockedTurnsRemaining > 0 || visit.trapStates[item.id]?.requiresKey)).map(key))
}

export function findPath(compound, visit, start, goal) {
  const blocked = blockedTiles(compound, visit)
  const queue = [start]
  const previous = new Map([[key(start), null]])
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index]
    if (point.x === goal.x && point.y === goal.y) break
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: point.x + dx, y: point.y + dy }
      const nextKey = key(next)
      if (next.x < 0 || next.x >= compound.map.width || next.y < 0 || next.y >= compound.map.height || (next.y === compound.map.height - 1 && next.x !== entranceOf(compound).x) || blocked.has(nextKey) || previous.has(nextKey)) continue
      previous.set(nextKey, key(point))
      queue.push(next)
    }
  }
  if (!previous.has(key(goal))) return []
  const path = []
  let cursor = key(goal)
  while (cursor !== null) {
    const [x, y] = cursor.split(':').map(Number)
    path.unshift({ x, y })
    cursor = previous.get(cursor)
  }
  return path
}

function farthestRoom(compound, start, visit) {
  const rooms = compound.map.rooms
  if (!rooms.length) return start
  return rooms.map((room) => {
    const points = []
    for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) points.push({ x, y })
    const reachable = points.map((point) => ({ point, distance: findPath(compound, visit, start, point).length })).filter((entry) => entry.distance > 0)
    reachable.sort((a, b) => b.distance - a.distance)
    return { room, ...reachable[0] }
  }).filter((entry) => entry.point).sort((a, b) => b.distance - a.distance)[0]?.point ?? start
}

export function createVisit(compound, { id = globalThis.crypto?.randomUUID?.() ?? `visit-${Date.now()}`, startedAt = new Date().toISOString(), perkSelection = {}, equipment = null } = {}) {
  if (!compound || compound.version !== 3 || !compound.map || !Array.isArray(compound.items)) throw new TypeError('A version 3 compound is required.')
  const entrance = { ...entranceOf(compound) }
  const visit = {
    id, compoundVersion: compound.version, startedAt, stage: 'outbound', outcome: 'active',
    entrance, target: entrance, guest: { id: `guest-${id}`, name: 'אורח', position: entrance, status: 'מוכן', health: 100, damageTaken: 0, gasTurnsRemaining: 0, gasExposure: [], stunTurnsRemaining: 0, stepsTaken: 0, progress: 0, turns: 0 },
    trapStates: Object.fromEntries(compound.items.filter((item) => item.type === 'trap').map((trap) => [trap.id, { triggered: false, ignored: false, lockedTurnsRemaining: 0, requiresKey: false, gasTurnsRemaining: 0 }])),
    perks: createVisitPerkState(id, perkSelection),
    equipment: equipment ? copy(equipment) : { selectedToolIds: [], tools: {} },
    pendingAction: null, events: [], reroutes: 0, plannedSteps: 0,
  }
  visit.target = farthestRoom(compound, entrance, visit)
  visit.plannedSteps = Math.max(0, findPath(compound, visit, entrance, visit.target).length - 1) * 2
  if (key(visit.target) === key(entrance)) visit.stage = 'returning'
  return visit
}

function event(visit, type, message, trapId = null, details = {}) {
  visit.events.push({ turn: visit.guest.turns, type, message, trapId, ...details })
}

function applyDamage(visit, damage, source, trap) {
  const guest = visit.guest
  const actualDamage = Math.min(guest.health, Math.max(0, Math.floor(Number(damage) || 0)))
  if (actualDamage <= 0) return 0
  guest.health -= actualDamage
  guest.damageTaken += actualDamage
  event(visit, 'damage', `${trap.name}: ${actualDamage} נזק. נותרו ${guest.health} נקודות חיים.`, trap.id, { amount: actualDamage, source, healthAfter: guest.health })
  if (guest.health === 0) {
    visit.outcome = 'dead'
    guest.status = 'הביקור הסתיים'
    event(visit, 'death', 'לאורח אזלו נקודות החיים.')
  }
  return actualDamage
}

function activeGasAt(compound, visit, position) {
  return compound.items.filter((trap) => {
    if (trap.type !== 'trap' || trap.trapType !== 'gas') return false
    const state = visit.trapStates[trap.id]
    return state?.triggered && state.gasTurnsRemaining > 0 && Math.max(Math.abs(trap.x - position.x), Math.abs(trap.y - position.y)) <= (trap.effect?.radius ?? 1)
  })
}

function refreshGasExposure(compound, visit, position) {
  const exposed = activeGasAt(compound, visit, position)
  visit.guest.gasExposure = exposed.map((trap) => trap.id)
  visit.guest.gasTurnsRemaining = exposed.reduce((longest, trap) => Math.max(longest, visit.trapStates[trap.id].gasTurnsRemaining), 0)
  return exposed
}

function applyGasDamage(compound, visit, position, damagedThisTurn) {
  for (const trap of refreshGasExposure(compound, visit, position)) {
    if (damagedThisTurn.has(trap.id)) continue
    const damage = Math.max(0, (Number(trap.effect?.strength) || 1) * 10 - (visit.trapStates[trap.id].gasProtectionAmount ?? 0))
    if (applyDamage(visit, damage, 'gas', trap) > 0) damagedThisTurn.add(trap.id)
    if (visit.outcome !== 'active') return
  }
}

function applyTrap(compound, visit, trap, { manual = false, damageReduction = 0, floorRecovery = false, doorReduction = 0 } = {}) {
  const state = visit.trapStates[trap.id]
  if (!state || state.triggered) return
  state.triggered = true
  const effect = trap.effect ?? TRAP_TYPES[trap.trapType]?.defaultEffect ?? {}
  if (trap.trapType === 'electric') {
    const damage = Math.max(0, (Number(effect.strength) || 1) * 10 - damageReduction)
    visit.guest.stunTurnsRemaining = Math.max(visit.guest.stunTurnsRemaining, Number(effect.durationTurns) || 1)
    applyDamage(visit, damage, 'electric', trap)
    if (visit.outcome !== 'active') return
  } else if (trap.trapType === 'floor') {
    visit.guest.stunTurnsRemaining = Math.max(visit.guest.stunTurnsRemaining, Number(effect.stopTurns) || 1)
    if (effect.kind === 'restart' && !floorRecovery) { visit.guest.position = { ...visit.entrance }; visit.guest.progress = 0; visit.stage = 'outbound'; }
    event(visit, effect.kind === 'restart' && !floorRecovery ? 'restart' : 'delay', effect.kind === 'restart' && !floorRecovery ? 'הרצפה הנופלת החזירה את האורח לכניסה.' : 'האורח נעצר בעקבות הרצפה הנופלת.', trap.id)
  } else if (trap.trapType === 'gas') {
    state.gasTurnsRemaining = Math.max(state.gasTurnsRemaining, Number(effect.durationTurns) || 1)
    state.gasProtectionAmount = damageReduction
    event(visit, 'gas', `האורח נכנס לענן גז ברדיוס ${effect.radius ?? 1}.`, trap.id)
  } else if (trap.trapType === 'door') {
    if (effect.openMode === 'key') state.requiresKey = true
    else state.lockedTurnsRemaining = Math.max(0, (Number(effect.lockDuration) || 1) - doorReduction)
    if (state.requiresKey || state.lockedTurnsRemaining > 0) visit.reroutes += 1
    event(visit, 'door', effect.openMode === 'key' ? 'הדלת ננעלה ונדרש מפתח.' : `הדלת ננעלה למשך ${state.lockedTurnsRemaining} תורות והאורח מחפש דרך אחרת.`, trap.id)
  }
  if (manual) event(visit, 'manual', 'המלכודת הופעלה ידנית.', trap.id)
}

function trapAt(compound, point) { return compound.items.find((item) => item.type === 'trap' && item.x === point.x && item.y === point.y) }

function gasTrapsAt(compound, point, visit) {
  return compound.items.filter((item) => {
    if (item.type !== 'trap' || item.trapType !== 'gas' || visit.trapStates[item.id]?.triggered) return false
    return Math.max(Math.abs(item.x - point.x), Math.abs(item.y - point.y)) <= (item.effect?.radius ?? 1)
  })
}

function toolsForEncounter(visit, trap) {
  return toolsForTrapEncounter(visit.equipment, trap)
}

function finishPendingTurn(compound, visit, activeGasTrapIds) {
  for (const trapId of activeGasTrapIds) {
    const state = visit.trapStates[trapId]
    if (state?.gasTurnsRemaining > 0) state.gasTurnsRemaining -= 1
  }
  refreshGasExposure(compound, visit, visit.guest.position)
  if (visit.guest.gasTurnsRemaining === 0 && visit.guest.status === 'מושפע מגז') visit.guest.status = 'בתנועה'
}

function resolveAutomaticTrap(compound, visit, trap, position, activeGasTrapIds, floorRecovery) {
  const goal = visit.stage === 'outbound' ? visit.target : visit.entrance
  if (trap.trapType === 'door') {
    const rerouted = findPath(compound, visit, visit.guest.position, goal)
    if (!rerouted.length) {
      visit.guest.status = 'ממתין לפתיחת הדלת'
      finishPendingTurn(compound, visit, activeGasTrapIds)
      return visit
    }
    visit.guest.status = 'מחפש דרך אחרת'
    const rerouteNext = rerouted[1]
    const secondTrap = rerouteNext ? trapAt(compound, rerouteNext) : null
    if (rerouteNext && (!secondTrap || visit.trapStates[secondTrap.id]?.triggered || visit.trapStates[secondTrap.id]?.ignored)) visit.guest.position = rerouteNext
    if (visit.trapStates[trap.id]?.requiresKey || visit.trapStates[trap.id]?.lockedTurnsRemaining > 0) visit.reroutes += 1
  } else if (!(trap.trapType === 'floor' && trap.effect?.kind === 'restart' && !floorRecovery)) {
    visit.guest.position = position
  }
  if (trap.trapType === 'gas') {
    activeGasTrapIds.add(trap.id)
    applyGasDamage(compound, visit, visit.guest.position, new Set())
  }
  if (visit.outcome === 'active') {
    visit.guest.stepsTaken += 1
    if (!(trap.trapType === 'floor' && trap.effect?.kind === 'restart' && !floorRecovery)) {
      visit.guest.progress = visit.plannedSteps ? Math.min(99, Math.round(visit.guest.stepsTaken / visit.plannedSteps * 100)) : 100
    }
  }
  finishPendingTurn(compound, visit, activeGasTrapIds)
  return visit
}

export function advanceVisit(compound, currentVisit) {
  if (currentVisit.outcome !== 'active' || currentVisit.pendingAction) return currentVisit
  const visit = copy(currentVisit)
  const guest = visit.guest
  guest.turns += 1
  const gasDamageApplied = new Set()
  const activeGasTimers = new Set(Object.entries(visit.trapStates).filter(([, state]) => state.gasTurnsRemaining > 0).map(([trapId]) => trapId))
  const finishTurn = () => {
    for (const trapId of activeGasTimers) {
      const state = visit.trapStates[trapId]
      if (state?.gasTurnsRemaining > 0) state.gasTurnsRemaining -= 1
    }
    refreshGasExposure(compound, visit, guest.position)
    if (guest.status === 'מושפע מגז' && guest.gasTurnsRemaining === 0) guest.status = 'בתנועה'
  }
  applyGasDamage(compound, visit, guest.position, gasDamageApplied)
  if (visit.outcome !== 'active') { finishTurn(); return visit }
  for (const state of Object.values(visit.trapStates)) if (state.lockedTurnsRemaining > 0) state.lockedTurnsRemaining -= 1
  if (guest.stunTurnsRemaining > 0) { guest.stunTurnsRemaining -= 1; guest.status = 'מתאושש'; event(visit, 'stun', 'האורח מתאושש ואינו מתקדם.'); finishTurn(); return visit }
  const goal = visit.stage === 'outbound' ? visit.target : visit.entrance
  const path = findPath(compound, visit, guest.position, goal)
  if (!path.length) { guest.status = 'אין מסלול'; visit.outcome = 'stalled'; event(visit, 'blocked', 'לא נמצא מסלול אל היעד.'); finishTurn(); return visit }
  if (path.length === 1) {
    if (visit.stage === 'outbound') { visit.stage = 'returning'; event(visit, 'arrive', 'האורח הגיע ליעד וכעת חוזר ליציאה.'); }
    else { visit.outcome = 'completed'; guest.status = 'הביקור הושלם'; guest.progress = 100; event(visit, 'complete', 'האורח הגיע ליציאה.'); }
    finishTurn()
    return visit
  }
  const next = path[1]
  let trap = trapAt(compound, next)
  if (trap && !visit.trapStates[trap.id]?.triggered && !visit.trapStates[trap.id]?.ignored) {
    const activation = trap.activation?.event ?? TRAP_TYPES[trap.trapType]?.defaultActivation
    const inGas = trap.trapType === 'gas' && gasTrapsAt(compound, next, visit).some((candidate) => candidate.id === trap.id)
    if (activation === 'manual') { visit.pendingAction = { trapId: trap.id, position: next, kind: 'trap', activeGasTrapIds: [...activeGasTimers] }; guest.status = 'ממתין להפעלה'; return visit }
    if (activation === 'step' || activation === 'area-entry' && inGas || activation === 'passage-attempt') {
      if (toolsForEncounter(visit, trap).length) {
        visit.pendingAction = { trapId: trap.id, position: next, kind: 'auto-trap', activeGasTrapIds: [...activeGasTimers] }
        guest.status = 'ממתין לבחירת ציוד'
        return visit
      }
      applyTrap(compound, visit, trap)
      if (visit.outcome !== 'active') { finishTurn(); return visit }
      if (trap.trapType === 'gas') activeGasTimers.add(trap.id)
      if (trap.trapType === 'door') {
        const rerouted = findPath(compound, visit, guest.position, goal)
        if (!rerouted.length) { guest.status = 'ממתין לפתיחת הדלת'; finishTurn(); return visit }
        guest.status = 'מחפש דרך אחרת'
        const rerouteNext = rerouted[1]
        const secondTrap = trapAt(compound, rerouteNext)
        if (!secondTrap || visit.trapStates[secondTrap.id]?.triggered || visit.trapStates[secondTrap.id]?.ignored) guest.position = rerouteNext
        visit.reroutes += 1
      } else {
        if (!(trap.trapType === 'floor' && trap.effect?.kind === 'restart')) guest.position = next
      }
      if (trap.trapType === 'gas') applyGasDamage(compound, visit, guest.position, gasDamageApplied)
      if (visit.outcome !== 'active') { finishTurn(); return visit }
      guest.stepsTaken += 1
      if (!(trap.trapType === 'floor' && trap.effect?.kind === 'restart')) guest.progress = visit.plannedSteps ? Math.min(99, Math.round(guest.stepsTaken / visit.plannedSteps * 100)) : 100
      finishTurn()
      return visit
    }
  }
  const gasTrap = gasTrapsAt(compound, next, visit).find((candidate) => candidate.activation?.event === 'area-entry' && !visit.trapStates[candidate.id]?.triggered)
  if (gasTrap && toolsForEncounter(visit, gasTrap).length) {
    visit.pendingAction = { trapId: gasTrap.id, position: next, kind: 'auto-trap', activeGasTrapIds: [...activeGasTimers] }
    guest.status = 'ממתין לבחירת ציוד'
    return visit
  }
  if (gasTrap) { applyTrap(compound, visit, gasTrap); activeGasTimers.add(gasTrap.id) }
  guest.position = next
  applyGasDamage(compound, visit, guest.position, gasDamageApplied)
  if (visit.outcome !== 'active') { finishTurn(); return visit }
  guest.stepsTaken += 1
  guest.status = guest.gasTurnsRemaining > 0 ? 'מושפע מגז' : 'בתנועה'
  guest.progress = visit.plannedSteps ? Math.min(99, Math.round(guest.stepsTaken / visit.plannedSteps * 100)) : 100
  finishTurn()
  return visit
}

export function resolvePendingTrap(compound, currentVisit, activate = true, toolId = null) {
  if (!currentVisit.pendingAction) return currentVisit
  const visit = copy(currentVisit)
  const pendingAction = visit.pendingAction
  const { trapId, position } = pendingAction
  const automatic = pendingAction.kind === 'auto-trap'
  visit.pendingAction = null
  const trap = compound.items.find((item) => item.id === trapId)
  let damageReduction = 0
  let floorRecovery = false
  let doorReduction = 0
  if (automatic) activate = true
  if (activate && trap && toolId) {
    const usage = consumeToolUse(visit.equipment, toolId, trap.trapType, `${visit.id}:${trap.id}`)
    if (!usage.ok) return currentVisit
    damageReduction = usage.tool.impact.kind === 'reduce-next-damage' || usage.tool.impact.kind === 'reduce-damage-per-turn' ? usage.tool.impact.amount : 0
    floorRecovery = usage.tool.impact.kind === 'prevent-restart'
    doorReduction = usage.tool.impact.kind === 'shorten-timed-lock' ? usage.tool.impact.turns : 0
    event(visit, 'equipment', `${EQUIPMENT_CATALOG[usage.tool.id].name} הופעלו מול ${trap.name}.`, trap.id, { toolId: usage.tool.id, amount: damageReduction, impact: usage.tool.impact })
  }
  if (activate && trap) applyTrap(compound, visit, trap, { manual: !automatic, damageReduction, floorRecovery, doorReduction })
  else { visit.trapStates[trapId].ignored = true; event(visit, 'skip', 'האורח בחר לדלג על המלכודת.', trapId) }
  if (automatic && trap) {
    return resolveAutomaticTrap(compound, visit, trap, position, new Set(pendingAction.activeGasTrapIds ?? []), floorRecovery)
  }
  if (visit.outcome === 'active' && trap?.trapType !== 'door' && !(trap?.trapType === 'floor' && trap.effect?.kind === 'restart' && !floorRecovery)) {
    visit.guest.position = position
    if (trap?.trapType === 'gas') {
      applyGasDamage(compound, visit, visit.guest.position, new Set())
      if (visit.trapStates[trap.id].gasTurnsRemaining > 0) visit.trapStates[trap.id].gasTurnsRemaining -= 1
      refreshGasExposure(compound, visit, visit.guest.position)
    }
    if (visit.outcome !== 'active') return visit
    visit.guest.stepsTaken += 1
    visit.guest.progress = visit.plannedSteps ? Math.min(99, Math.round(visit.guest.stepsTaken / visit.plannedSteps * 100)) : 100
  }
  return visit
}

export function loadVisitResults(storage = globalThis.localStorage) {
  try { const value = JSON.parse(storage?.getItem(VISIT_RESULTS_KEY) ?? '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}

export function saveVisitResult(visit, storage = globalThis.localStorage) {
  if (!['completed', 'dead', 'stalled'].includes(visit.outcome)) return loadVisitResults(storage)
  const results = loadVisitResults(storage).filter((result) => result.id !== visit.id)
  results.unshift({ id: visit.id, startedAt: visit.startedAt, endedAt: new Date().toISOString(), outcome: visit.outcome, turns: visit.guest.turns, stepsTaken: visit.guest.stepsTaken, damageTaken: visit.guest.damageTaken, reroutes: visit.reroutes, compoundVersion: visit.compoundVersion, perkSelections: copy(visit.perks?.selections ?? { owner: [], guest: [] }), perkEvents: copy(visit.perks?.events ?? []) })
  const bounded = results.slice(0, 50)
  try { storage?.setItem(VISIT_RESULTS_KEY, JSON.stringify(bounded)) } catch { /* Results remain available to the caller when storage is unavailable. */ }
  return bounded
}

export function loadActiveVisit(storage = globalThis.localStorage) {
  try {
    const record = JSON.parse(storage?.getItem(ACTIVE_VISIT_KEY) ?? 'null')
    if (record?.version !== 1 || record.visit?.outcome !== 'active' || !record.compound || record.compound.version !== 3) return null
    return { compound: record.compound, session: record.visit }
  } catch { return null }
}

export function saveActiveVisit(compound, visit, storage = globalThis.localStorage) {
  if (!compound || !visit || visit.outcome !== 'active') return false
  try {
    storage?.setItem(ACTIVE_VISIT_KEY, JSON.stringify({ version: 1, compound: copy(compound), visit: copy(visit), savedAt: new Date().toISOString() }))
    return Boolean(storage)
  } catch { return false }
}

export function clearActiveVisit(storage = globalThis.localStorage, visitId) {
  try {
    const current = loadActiveVisit(storage)
    if (visitId && current?.session.id !== visitId) return false
    storage?.removeItem(ACTIVE_VISIT_KEY)
    return true
  } catch { return false }
}
