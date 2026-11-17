import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompoundData, STARTER_ITEMS } from './compound.js'
import { createTrapData } from './traps.js'
import { ACTIVE_VISIT_KEY, advanceVisit, clearActiveVisit, createVisit, findPath, loadActiveVisit, loadVisitResults, resolvePendingTrap, saveActiveVisit, saveVisitResult, VISIT_RESULTS_KEY } from './visitEngine.js'

function compoundWithTrap(type, patch = {}) {
  const trap = { id: 'trap-test', type: 'trap', x: 5, y: 6, w: 1, h: 1, ...createTrapData(type), ...patch }
  if (patch.effect) trap.effect = { ...trap.effect, ...patch.effect }
  if (patch.activation) trap.activation = { ...trap.activation, ...patch.activation }
  return createCompoundData([...STARTER_ITEMS, trap])
}

function until(condition, compound, visit, limit = 100) {
  let state = visit
  for (let turn = 0; turn < limit && !condition(state); turn += 1) state = advanceVisit(compound, state)
  return state
}

test('visitor reaches the farthest room and returns to the entrance', () => {
  const compound = createCompoundData(STARTER_ITEMS)
  const visit = createVisit(compound, { id: 'round-trip' })
  assert.notDeepEqual(visit.target, visit.entrance)
  const result = until((state) => state.outcome !== 'active', compound, visit)
  assert.equal(result.outcome, 'completed')
  assert.equal(result.guest.position.x, visit.entrance.x)
  assert.equal(result.guest.position.y, visit.entrance.y)
  assert.equal(result.guest.progress, 100)
})

test('pathfinding obeys map edges and reroutes around a locked door', () => {
  const compound = compoundWithTrap('door', { x: 0, y: 4, effect: { openMode: 'key' } })
  const visit = createVisit(compound, { id: 'door-path' })
  visit.trapStates['trap-test'].requiresKey = true
  const path = findPath(compound, visit, visit.entrance, visit.target)
  assert.ok(path.length)
  assert.ok(!path.some((point) => point.x === 0 && point.y === 4))
  assert.ok(path.every((point) => point.y < compound.map.height - 1 || point.x === visit.entrance.x))
})

test('electric trap applies configured damage and one turn of stun once', () => {
  const compound = compoundWithTrap('electric', { effect: { strength: 2, durationTurns: 1 } })
  const visit = createVisit(compound, { id: 'electric-hit' })
  const result = until((state) => state.trapStates['trap-test'].triggered, compound, visit)
  assert.equal(result.guest.health, 80)
  assert.equal(result.guest.damageTaken, 20)
  assert.equal(result.guest.stunTurnsRemaining, 1)
  const next = advanceVisit(compound, result)
  assert.equal(next.guest.stunTurnsRemaining, 0)
  assert.equal(next.guest.stepsTaken, result.guest.stepsTaken)
  assert.equal(advanceVisit(compound, next).guest.health, 80)
})

test('lethal electric damage ends the visit and records the actual health loss', () => {
  const compound = compoundWithTrap('electric', { effect: { strength: 3, durationTurns: 1 } })
  const visit = createVisit(compound, { id: 'lethal-electric' })
  visit.guest.health = 20
  const result = until((state) => state.trapStates['trap-test'].triggered, compound, visit)
  const hit = result.events.find((entry) => entry.type === 'damage')
  assert.equal(result.outcome, 'dead')
  assert.equal(result.guest.health, 0)
  assert.equal(result.guest.damageTaken, 20)
  assert.equal(hit.amount, 20)
  assert.equal(hit.healthAfter, 0)
})

test('gas activates inside its configured radius and records exposure duration', () => {
  const compound = compoundWithTrap('gas', { x: 4, y: 5, effect: { radius: 2, durationTurns: 3 } })
  const result = until((state) => state.trapStates['trap-test'].triggered, compound, createVisit(compound, { id: 'gas-zone' }))
  assert.equal(result.guest.health, 90)
  assert.equal(result.guest.gasTurnsRemaining, 2)
  assert.deepEqual(result.guest.gasExposure, ['trap-test'])
  assert.ok(result.events.some((entry) => entry.type === 'gas'))
  assert.equal(result.events.find((entry) => entry.type === 'damage').source, 'gas')
})

test('one-turn gas still causes immediate damage on the activation turn', () => {
  const compound = compoundWithTrap('gas', { effect: { strength: 2, durationTurns: 1 } })
  const result = until((state) => state.trapStates['trap-test'].triggered, compound, createVisit(compound, { id: 'one-turn-gas' }))
  assert.equal(result.guest.health, 80)
  assert.equal(result.trapStates['trap-test'].gasTurnsRemaining, 0)
  assert.equal(result.events.filter((entry) => entry.type === 'damage').length, 1)
})

test('manual gas activation deals its entry damage and remains a single activation', () => {
  const compound = compoundWithTrap('gas', { activation: { event: 'manual' }, effect: { strength: 2, durationTurns: 3 } })
  let visit = until((state) => Boolean(state.pendingAction), compound, createVisit(compound, { id: 'manual-gas' }))
  visit = resolvePendingTrap(compound, visit, true)
  assert.equal(visit.guest.health, 80)
  assert.equal(visit.trapStates['trap-test'].triggered, true)
  const hitsBefore = visit.events.filter((entry) => entry.type === 'damage').length
  visit = advanceVisit(compound, visit)
  assert.equal(visit.guest.health, 60)
  assert.equal(visit.events.filter((entry) => entry.type === 'damage').length, hitsBefore + 1)
})

test('active gas damages once per turn, expires, and does not reactivate', () => {
  const compound = compoundWithTrap('gas', { x: 4, y: 5, effect: { radius: 3, strength: 2, durationTurns: 3 } })
  let visit = until((state) => state.trapStates['trap-test'].triggered, compound, createVisit(compound, { id: 'gas-ticks' }))
  assert.equal(visit.guest.health, 80)
  visit = advanceVisit(compound, visit)
  assert.equal(visit.guest.health, 60)
  assert.equal(visit.events.filter((entry) => entry.type === 'damage').length, 2)
  visit = advanceVisit(compound, visit)
  assert.equal(visit.guest.health, 40)
  assert.equal(visit.trapStates['trap-test'].gasTurnsRemaining, 0)
  assert.equal(visit.trapStates['trap-test'].triggered, true)
  visit = advanceVisit(compound, visit)
  assert.equal(visit.guest.health, 40)
})

test('a guest entering gas on its final active turn still takes that turn’s damage', () => {
  const compound = compoundWithTrap('gas', { x: 5, y: 2, effect: { radius: 1, strength: 1, durationTurns: 2 } })
  const visit = createVisit(compound, { id: 'last-gas-turn' })
  visit.guest.position = { x: 5, y: 3 }
  visit.trapStates['trap-test'].triggered = true
  visit.trapStates['trap-test'].gasTurnsRemaining = 1
  const next = advanceVisit(compound, visit)
  assert.equal(next.guest.position.x, 5)
  assert.equal(next.guest.position.y, 2)
  assert.equal(next.guest.health, 90)
  assert.equal(next.trapStates['trap-test'].gasTurnsRemaining, 0)
})

test('automatic door closes once and sends the guest around it', () => {
  const compound = compoundWithTrap('door', { x: 5, y: 4, effect: { lockDuration: 2, openMode: 'automatic' } })
  const result = until((state) => state.trapStates['trap-test'].triggered, compound, createVisit(compound, { id: 'door-reroute' }))
  assert.ok(result.reroutes > 0)
  assert.notDeepEqual(result.guest.position, { x: 5, y: 4 })
  assert.equal(result.trapStates['trap-test'].lockedTurnsRemaining, 2)
})

test('floor restart returns the guest to the entrance without editing the compound', () => {
  const compound = compoundWithTrap('floor', { effect: { kind: 'restart' } })
  const before = structuredClone(compound)
  const visit = until((state) => state.trapStates['trap-test'].triggered, compound, createVisit(compound, { id: 'floor-hit' }))
  assert.deepEqual(visit.guest.position, visit.entrance)
  assert.equal(visit.guest.progress, 0)
  assert.deepEqual(compound, before)
})

test('manual trap waits for a decision and can be skipped without activating', () => {
  const compound = compoundWithTrap('electric', { activation: { event: 'manual' } })
  const pending = until((state) => Boolean(state.pendingAction), compound, createVisit(compound, { id: 'manual-hit' }))
  assert.equal(pending.guest.health, 100)
  const skipped = resolvePendingTrap(compound, pending, false)
  assert.equal(skipped.trapStates['trap-test'].triggered, false)
  assert.equal(skipped.trapStates['trap-test'].ignored, true)
  assert.equal(skipped.guest.health, 100)
})

test('visit results save separately and are deduplicated by visit id', () => {
  const records = new Map()
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }
  const compound = createCompoundData(STARTER_ITEMS)
  const finished = until((state) => state.outcome !== 'active', compound, createVisit(compound, { id: 'stored-result' }))
  finished.perks.selections.owner = ['trap-map']
  finished.perks.events.push({ type: 'perk-activated', role: 'owner', perkId: 'trap-map' })
  saveVisitResult(finished, storage)
  saveVisitResult(finished, storage)
  assert.equal(records.has(VISIT_RESULTS_KEY), true)
  assert.equal(loadVisitResults(storage).length, 1)
  assert.deepEqual(loadVisitResults(storage)[0].perkSelections.owner, ['trap-map'])
  assert.equal(loadVisitResults(storage)[0].perkEvents[0].perkId, 'trap-map')
  assert.equal(records.has('im-home-compound'), false)
})

test('active visits survive reload with timers, exposure, events, and a private compound snapshot', () => {
  const records = new Map([['im-home-compound', 'untouched-compound-data']])
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) }
  const compound = compoundWithTrap('gas', { effect: { strength: 3 } })
  const visit = createVisit(compound, { id: 'persisted-active' })
  visit.guest.position = { x: 3, y: 3 }
  visit.guest.health = 70
  visit.guest.progress = 35
  visit.guest.gasExposure = ['trap-test']
  visit.guest.gasTurnsRemaining = 2
  visit.trapStates['trap-test'].triggered = true
  visit.trapStates['trap-test'].gasTurnsRemaining = 2
  visit.events.push({ turn: 4, type: 'damage', trapId: 'trap-test', amount: 10 })
  visit.perks.selections.owner = ['trap-map']
  visit.perks.active.owner = ['trap-map']
  visit.perks.events.push({ turn: 4, type: 'perk-activated', perkId: 'trap-map' })
  saveActiveVisit(compound, visit, storage)
  const loaded = loadActiveVisit(storage)
  assert.deepEqual(loaded.session, visit)
  assert.deepEqual(loaded.compound, compound)
  assert.equal(records.get('im-home-compound'), 'untouched-compound-data')
  loaded.session.guest.health = 1
  assert.equal(visit.guest.health, 70)
  assert.equal(clearActiveVisit(storage, 'another-visit'), false)
  assert.equal(clearActiveVisit(storage, visit.id), true)
  assert.equal(records.has(ACTIVE_VISIT_KEY), false)
  assert.equal(loadVisitResults(storage).length, 0)
})

test('resuming a saved gas visit continues its timer and applies exactly one hit that turn', () => {
  const records = new Map()
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) }
  const compound = compoundWithTrap('gas', { x: 4, y: 5, effect: { radius: 3, strength: 2, durationTurns: 3 } })
  const entered = until((state) => state.trapStates['trap-test'].triggered, compound, createVisit(compound, { id: 'resume-gas' }))
  saveActiveVisit(compound, entered, storage)
  let resumed = loadActiveVisit(storage)
  resumed.session = advanceVisit(resumed.compound, resumed.session)
  assert.equal(resumed.session.guest.health, entered.guest.health - 20)
  assert.equal(resumed.session.trapStates['trap-test'].gasTurnsRemaining, 1)
  assert.equal(resumed.session.events.filter((entry) => entry.type === 'damage').length, entered.events.filter((entry) => entry.type === 'damage').length + 1)
})

test('terminal visits are not persisted as active and abandonment is not a result', () => {
  const records = new Map()
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) }
  const compound = createCompoundData(STARTER_ITEMS)
  const active = createVisit(compound, { id: 'abandoned-visit' })
  saveActiveVisit(compound, active, storage)
  clearActiveVisit(storage, active.id)
  assert.equal(loadActiveVisit(storage), null)
  assert.equal(loadVisitResults(storage).length, 0)
  const completed = until((state) => state.outcome !== 'active', compound, createVisit(compound, { id: 'completed-visit' }))
  saveActiveVisit(compound, completed, storage)
  assert.equal(loadActiveVisit(storage), null)
})
