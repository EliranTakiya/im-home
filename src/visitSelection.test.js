import test from 'node:test'
import assert from 'node:assert/strict'
import { CHALLENGE_HOUSES } from './challenges/houses.js'
import { createChallengeProgress, recordChallengeAttempt } from './challenges/progress.js'
import { selectChallengeVisitTarget, selectPlayerHouseVisitTarget } from './visitSelection.js'

test('each explicitly selected unlocked challenge resolves to its own catalog map and identity', () => {
  let progress = createChallengeProgress()
  for (let index = 0; index < CHALLENGE_HOUSES.length; index += 1) {
    const house = CHALLENGE_HOUSES[index]
    const target = selectChallengeVisitTarget(progress, house.id)
    assert.equal(target?.visitType, 'challenge')
    assert.equal(target?.mapSource, 'challenge-catalog')
    assert.equal(target?.houseId, house.id)
    assert.notEqual(target?.compound, null)
    if (index < CHALLENGE_HOUSES.length - 1) {
      const completed = { id: `unlock-${house.id}`, outcome: 'completed', minimumSteps: 1, guest: { health: 100, stepsTaken: 1, damageTaken: 0 }, perks: { selections: { owner: [], guest: [] } } }
      progress = recordChallengeAttempt(progress, house.id, completed).progress
    }
  }
})

test('locked, unknown, and missing challenge targets cannot start', () => {
  const progress = createChallengeProgress()
  assert.equal(selectChallengeVisitTarget(progress, 'advanced-house'), null)
  assert.equal(selectChallengeVisitTarget(progress, 'not-a-house'), null)
  assert.equal(selectChallengeVisitTarget(progress, null), null)
})

test('player house target requires an explicit player-house source and versioned map', () => {
  assert.equal(selectPlayerHouseVisitTarget(null), null)
  assert.equal(selectPlayerHouseVisitTarget({ id: 'mine', mapSource: 'builder', compound: { version: 3 } }), null)
  assert.equal(selectPlayerHouseVisitTarget({ id: 'remote-1', mapSource: 'player-house', compound: { version: 2 } }), null)
})
