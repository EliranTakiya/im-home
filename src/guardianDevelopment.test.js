import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameplayTimer, elapsedGameplayMs, pauseGameplayTimer, resumeGameplayTimer } from './gameTimer.js'
import { advanceVisit, createVisit, loadActiveVisit, saveActiveVisit } from './visitEngine.js'
import { createCompoundData, STARTER_ITEMS } from './compound.js'
import { createChallengeCompound, CHALLENGE_HOUSES } from './challenges/houses.js'
import { createGuardianState, evaluateGuardian, humanOwnerCanAct } from './guardianAI.js'
import { findShortestPath } from './navigation.js'
import { createVisitTrapPlacement } from './trapPlacement.js'
import { loadActiveChallenge, saveActiveChallenge } from './challenges/progress.js'

test('gameplay timer counts active time and pauses cleanly over save/load', () => {
  const visit = { gameplayTimer: createGameplayTimer(1000) }
  assert.equal(elapsedGameplayMs(visit, 3500), 2500)
  const paused = pauseGameplayTimer(visit, 4000)
  assert.deepEqual(paused.gameplayTimer, { elapsedMs: 3000, runningSince: null })
  const resumed = resumeGameplayTimer(paused, 9000)
  assert.equal(elapsedGameplayMs(resumed, 10000), 4000)
})

test('Spectator Control blocks exactly one movement command and consumes exactly one step', () => {
  const compound = createCompoundData(STARTER_ITEMS)
  const visit = createVisit(compound, { id: 'spectator-one-input' })
  visit.guest.position = { x: 5, y: 4 }
  visit.spectator.blockedMovePending = true
  const blocked = advanceVisit(compound, visit, 'left')
  assert.deepEqual(blocked.guest.position, visit.guest.position)
  assert.equal(blocked.guest.facing, 'north')
  assert.equal(blocked.guest.stepsTaken, 1)
  assert.equal(blocked.spectator.blockedMovePending, false)
  const next = advanceVisit(compound, blocked, 'forward')
  assert.equal(next.guest.stepsTaken, 2)
  assert.notDeepEqual(next.guest.position, blocked.guest.position)
  assert.equal(next.guest.position.y, 3)
})

test('pending Spectator Control input persists in an active visit save', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const compound = createCompoundData(STARTER_ITEMS)
  const visit = createVisit(compound, { id: 'spectator-save' })
  visit.spectator.blockedMovePending = true
  assert.equal(saveActiveVisit(compound, visit, storage), true)
  const restored = loadActiveVisit(storage)
  assert.equal(restored.session.spectator.blockedMovePending, true)
  assert.ok(elapsedGameplayMs(restored.session) >= elapsedGameplayMs(visit) - 1000)
})

test('real-time trap placement preserves objective paths and honors map budget', () => {
  const house = CHALLENGE_HOUSES[0]
  const compound = createChallengeCompound(house.id)
  const visit = createVisit(compound, { id: 'dynamic-trap', visitType: 'challenge', mapSource: 'challenge-catalog', houseId: house.id, ownerMode: 'ai' })
  const path = findShortestPath(compound, visit.guest.position, visit.target, visit)
  const point = path.slice(2, -1).find((tile) => !compound.items.some((item) => item.x === tile.x && item.y === tile.y))
  assert.ok(point)
  const result = createVisitTrapPlacement(compound, visit, { ...point, trapType: 'electric', id: 'guardian-test-trap' })
  assert.equal(result.ok, true)
  assert.equal(result.trap.price, 120)
  assert.ok(findShortestPath(result.compound, visit.guest.position, visit.target, result.visit).length)
  assert.ok(findShortestPath(result.compound, visit.target, visit.entrance, result.visit).length)
  assert.equal(createVisitTrapPlacement(compound, visit, { ...visit.guest.position, trapType: 'electric' }).ok, false)
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(saveActiveChallenge({ houseId: house.id, compound: result.compound, visit: result.visit }, storage), true)
  const restored = loadActiveChallenge(storage)
  assert.ok(restored.compound.items.some((item) => item.id === 'guardian-test-trap'))
  assert.ok(restored.visit.trapStates['guardian-test-trap'])
})

test('Guardian places meaningful defenses across all difficulties and houses; owner authority excludes guests', () => {
  assert.deepEqual(['easy', 'normal', 'hard'].map((difficulty) => createGuardianState(`difficulty-${difficulty}`, difficulty).difficulty), ['easy', 'normal', 'hard'])
  assert.equal(humanOwnerCanAct({ visitType: 'player-house', ownerMode: 'human' }), false)
  assert.equal(humanOwnerCanAct({ visitType: 'regular', ownerMode: 'human' }), true)
  for (const house of CHALLENGE_HOUSES) for (const difficulty of ['easy', 'normal', 'hard']) {
    const compound = createChallengeCompound(house.id)
    let placedAction = null
    for (let index = 0; index < 120 && !placedAction; index += 1) {
      const visit = createVisit(compound, { id: `guardian-place-${house.id}-${difficulty}-${index}`, visitType: 'challenge', mapSource: 'challenge-catalog', houseId: house.id, ownerMode: 'ai' })
      const guardian = { ...createGuardianState(visit.id, difficulty), phase: 'present', enteredAt: 1, retreatAt: 999999, lastDecisionStep: -1 }
      const result = evaluateGuardian(guardian, compound, visit, { now: 5000 })
      if (result.action?.type === 'place-trap') placedAction = result.action
    }
    assert.ok(placedAction, `${house.id}/${difficulty}`)
  }
})
