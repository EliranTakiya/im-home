import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceVisit, createVisit } from '../visitEngine.js'
import { analyzeCompoundPaths, findShortestPath, minimumVisitSteps } from '../navigation.js'
import { CHALLENGE_HOUSES, createChallengeCompound } from './houses.js'
import { challengeAchievementStats, challengeHouseStats, createChallengeProgress, isChallengeHouseUnlocked, loadChallengeProgress, recordChallengeAttempt, saveChallengeProgress } from './progress.js'

test('the three challenge houses have distinct layouts and every room is reachable through their real map data', () => {
  const roomSignatures = new Set()
  for (const house of CHALLENGE_HOUSES) {
    const compound = createChallengeCompound(house.id)
    const entrance = compound.map.entrances[0]
    const analysis = analyzeCompoundPaths(compound)
    assert.equal(compound.version, 3)
    assert.equal(analysis.reachable, true, house.id)
    assert.ok(Number.isFinite(minimumVisitSteps(compound).steps), house.id)
    for (const room of compound.map.rooms) {
      const path = findShortestPath(compound, entrance, { x: room.x, y: room.y })
      assert.ok(path.length > 0, `${house.id} reaches ${room.id}`)
    }
    const signature = compound.map.rooms.map(({ x, y, w, h }) => `${x},${y},${w},${h}`).join('|')
    roomSignatures.add(signature)
  }
  assert.equal(roomSignatures.size, CHALLENGE_HOUSES.length)
})

test('challenge visit engine completes all designed houses using its shared movement and trap rules', () => {
  for (const house of CHALLENGE_HOUSES) {
    const compound = createChallengeCompound(house.id)
    let visit = createVisit(compound, { id: `sim-${house.id}` })
    for (let turns = 0; turns < visit.stepBudget + 10 && visit.outcome === 'active'; turns += 1) visit = advanceVisit(compound, visit)
    assert.equal(visit.outcome, 'completed', house.id)
    assert.ok(visit.guest.health > 0, house.id)
  }
})

test('challenge progress unlocks linearly, preserves best records, and deduplicates awards', () => {
  let progress = createChallengeProgress()
  assert.equal(isChallengeHouseUnlocked(progress, 'beginner-house'), true)
  assert.equal(isChallengeHouseUnlocked(progress, 'advanced-house'), false)
  const visit = { id: 'beginner-attempt-1', startedAt: '2026-01-01T00:00:00.000Z', outcome: 'completed', minimumSteps: 20, guest: { health: 100, stepsTaken: 20, damageTaken: 0 }, perks: { selections: { owner: [], guest: ['extra-steps'] } } }
  const recorded = recordChallengeAttempt(progress, 'beginner-house', visit, { endedAt: '2026-01-01T00:02:00.000Z' })
  assert.equal(recorded.attempt.medal, 'gold')
  assert.equal(recorded.progress.rewardLedger.length, 1)
  assert.equal(isChallengeHouseUnlocked(recorded.progress, 'advanced-house'), true)
  const duplicate = recordChallengeAttempt(recorded.progress, 'beginner-house', visit)
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.progress.history.length, 1)
  assert.equal(duplicate.progress.rewardLedger.length, 1)

  const slowerVisit = { ...visit, id: 'beginner-attempt-2', guest: { ...visit.guest, stepsTaken: 25 } }
  const slower = recordChallengeAttempt(duplicate.progress, 'beginner-house', slowerVisit)
  assert.equal(challengeHouseStats(slower.progress, 'beginner-house').bestSteps, 20)
  assert.equal(challengeHouseStats(slower.progress, 'beginner-house').attempts, 2)
  assert.equal(slower.progress.rewardLedger.length, 2)
})

test('challenge progress uses its own versioned local storage key', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const progress = createChallengeProgress()
  assert.equal(saveChallengeProgress(progress, storage), true)
  assert.deepEqual(loadChallengeProgress(storage), progress)
})

test('challenge history preserves each attempt and records difficulty, perks, and full equipment', () => {
  const legacy = { id: 'legacy-attempt', houseId: 'beginner-house', outcome: 'dead', medal: null, startedAt: '2026-01-01T00:00:00.000Z' }
  let progress = { ...createChallengeProgress(), history: [legacy] }
  const visit = {
    id: 'new-attempt', startedAt: '2026-01-02T00:00:00.000Z', outcome: 'completed', minimumSteps: 20,
    guardian: { difficulty: 'hard' },
    guest: { health: 80, stepsTaken: 22, damageTaken: 20 },
    perks: { selections: { owner: [], guest: ['extra-steps'] } },
    equipment: { selectedToolIds: ['gas-mask'], tools: { 'gas-mask': { id: 'gas-mask', upgradeLevel: 2, usesRemaining: 3, impact: { amount: 15 }, uses: [] } } },
  }
  const first = recordChallengeAttempt(progress, 'beginner-house', visit, { endedAt: '2026-01-02T00:03:00.000Z' })
  progress = first.progress
  assert.equal(progress.history.length, 2)
  assert.equal(progress.history[0].id, 'new-attempt')
  assert.equal(progress.history[0].difficulty, 'hard')
  assert.deepEqual(progress.history[0].guestPerks, ['extra-steps'])
  assert.deepEqual(progress.history[0].equipment, visit.equipment)
  assert.equal(progress.history[1].id, 'legacy-attempt')
  assert.equal(progress.history[1].difficulty, undefined)
  assert.deepEqual(challengeHouseStats(progress, 'beginner-house').history.map((attempt) => attempt.id), ['new-attempt', 'legacy-attempt'])
  const stats = challengeAchievementStats(progress)
  assert.equal(stats.silver, 1)
  assert.equal(stats.totalAttempts, 2)
  assert.equal(stats.completedHouses, 1)

  const duplicate = recordChallengeAttempt(progress, 'beginner-house', visit)
  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.progress.history.length, 2)
  assert.equal(duplicate.progress.rewardLedger.length, progress.rewardLedger.length)
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(saveChallengeProgress(duplicate.progress, storage), true)
  const restored = loadChallengeProgress(storage)
  assert.equal(restored.history.length, 2)
  assert.equal(restored.history[0].difficulty, 'hard')
  assert.deepEqual(restored.history[0].equipment, visit.equipment)
})

test('legacy challenge result records remain compatible through localStorage round trips', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const oldProgress = { version: 1, houses: { 'beginner-house': { completed: true, bestSteps: 18, bestMedal: 'silver' } }, history: [{ id: 'old-id', houseId: 'beginner-house', outcome: 'completed', medal: 'silver' }], rewardLedger: [] }
  assert.equal(saveChallengeProgress(oldProgress, storage), true)
  const restored = loadChallengeProgress(storage)
  assert.equal(restored.history[0].id, 'old-id')
  assert.equal(restored.history[0].difficulty, undefined)
  assert.equal(restored.houses['beginner-house'].bestSteps, 18)
})
