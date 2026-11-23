import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCompoundData, STARTER_ITEMS } from './compound.js'
import { createVisit, findPath, loadActiveVisit, saveActiveVisit } from './visitEngine.js'
import { createGuardianState, evaluateGuardian, guardianAllowedForVisit, humanOwnerCanAct, GUARDIAN_DIFFICULTIES } from './guardianAI.js'
import { activatePerk, createPerkStore } from './perks.js'
import { applySelectedPerkEffect } from './perkEffects.js'
import { CHALLENGE_HOUSES, createChallengeCompound } from './challenges/houses.js'
import { loadActiveChallenge, saveActiveChallenge } from './challenges/progress.js'

function evaluateAI(guardian, compound, visit, options = {}) {
  return evaluateGuardian(guardian, compound, { ...visit, visitType: 'challenge', ownerMode: 'ai' }, options)
}

function activeGuardian(difficulty = 'normal') {
  const visit = createVisit(createCompoundData(STARTER_ITEMS), { id: `guardian-${difficulty}`, perkSelection: { owner: ['spectator-control'] } })
  const guardian = { ...createGuardianState(visit.id, difficulty), phase: 'present', retreatAt: 100000, lastDecisionStep: -1 }
  return { visit, guardian }
}

test('guardian entry timing varies between visits and some visits have no appearance', () => {
  const states = Array.from({ length: 80 }, (_, index) => createGuardianState(`timing-${index}`, 'normal'))
  const appearances = states.filter((state) => state.phase === 'waiting')
  assert.ok(appearances.length > 0 && appearances.length < states.length)
  assert.ok(new Set(appearances.map((state) => state.entryProgress.toFixed(3))).size > 10)
  for (const state of appearances) {
    const { visit } = activeGuardian()
    visit.id = `timing-${state.entryProgress}`
    visit.guest.stepsTaken = Math.floor(Math.max(0, state.entryProgress - 0.01) * visit.stepBudget)
    assert.notEqual(evaluateAI(state, createCompoundData(STARTER_ITEMS), visit, { now: 1 }).guardian.phase, 'present')
    visit.guest.stepsTaken = Math.ceil(state.entryProgress * visit.stepBudget)
    assert.equal(evaluateAI(state, createCompoundData(STARTER_ITEMS), visit, { now: 1 }).guardian.phase, 'present')
  }
  assert.ok(states.some((state) => state.phase === 'absent'))
})

test('guardian uses only selected and relevant host perks, with strategy varying by difficulty', () => {
  const base = createCompoundData(STARTER_ITEMS)
  const route = findPath(base, createVisit(base), createVisit(base).entrance, createVisit(base).target)
  assert.ok(route.length > 2)
  const trapPoint = route[2]
  const trap = { id: 'guardian-route-trap', type: 'trap', trapType: 'electric', name: 'Route trap', description: '', x: trapPoint.x, y: trapPoint.y, w: 1, h: 1, effect: { strength: 1, durationTurns: 1 } }
  const compound = createCompoundData([...STARTER_ITEMS, trap])
  let chosen = null
  for (let index = 0; index < 80 && !chosen; index += 1) {
    const visit = createVisit(compound, { id: `reinforce-${index}`, perkSelection: { owner: ['trap-reinforcement'] } })
    const guardian = { ...createGuardianState(visit.id, 'hard'), phase: 'present', retreatAt: 99999, lastDecisionStep: -1 }
    const decision = evaluateAI(guardian, compound, visit, { now: 1 })
    if (decision.action) chosen = decision.action
  }
  assert.deepEqual(chosen, { perkId: 'trap-reinforcement', trapId: trap.id })
  assert.ok(GUARDIAN_DIFFICULTIES.easy.appearanceChance < GUARDIAN_DIFFICULTIES.normal.appearanceChance)
  assert.ok(GUARDIAN_DIFFICULTIES.normal.appearanceChance < GUARDIAN_DIFFICULTIES.hard.appearanceChance)
})

test('guardian respects host energy, cooldown, and activation limits before Spectator Control', () => {
  for (const condition of ['energy', 'cooldown', 'limit']) {
    const { visit, guardian } = activeGuardian()
    visit.guest.health = 1
    if (condition === 'energy') visit.spectator.energy = 0
    if (condition === 'cooldown') visit.spectator.cooldowns['spectator-control'] = 99999
    if (condition === 'limit') visit.perks.activations.owner['spectator-control'] = 2
    const result = evaluateAI(guardian, createCompoundData(STARTER_ITEMS), visit, { now: 1 })
    assert.notEqual(result.action?.perkId, 'spectator-control', condition)
    assert.equal(result.guardian.decisionsMade, 1)
  }
})

test('guardian retreats on schedule, records disappearance, and stops acting', () => {
  const { visit, guardian } = activeGuardian()
  const result = evaluateAI({ ...guardian, retreatAt: 1000 }, createCompoundData(STARTER_ITEMS), visit, { now: 1001 })
  assert.equal(result.guardian.phase, 'retreated')
  assert.equal(result.guardian.eventLog.at(-1).type, 'retreated')
  assert.equal(result.action, null)
  assert.equal(evaluateAI(result.guardian, createCompoundData(STARTER_ITEMS), visit, { now: 2000 }).changed, false)
})

test('regular saves discard automatic Guardian state while Challenge House saves restore AI state', () => {
  const storageValues = new Map()
  const storage = { getItem: (key) => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value) }
  const regularCompound = createCompoundData(STARTER_ITEMS)
  const visit = createVisit(regularCompound, { id: 'regular-guardian-save-visit' })
  const guardian = { ...createGuardianState(visit.id, 'hard'), phase: 'present', enteredAt: 100, retreatAt: 20000 }
  visit.guardian = guardian
  visit.perks.ownerActor = 'guardian'
  assert.equal(saveActiveVisit(regularCompound, visit, storage), true)
  const regularReload = loadActiveVisit(storage).session
  assert.equal(regularReload.ownerMode, 'absent')
  assert.equal('guardian' in regularReload, false)
  assert.equal('ownerActor' in regularReload.perks, false)

  const humanVisit = createVisit(regularCompound, { id: 'human-owner-save-visit', ownerMode: 'human' })
  assert.equal(saveActiveVisit(regularCompound, humanVisit, storage), true)
  const humanReload = loadActiveVisit(storage).session
  assert.equal(humanReload.ownerMode, 'human')
  assert.equal('guardian' in humanReload, false)

  const challengeCompound = createChallengeCompound('expert-house')
  const challengeVisit = createVisit(challengeCompound, { id: 'challenge-guardian-save-visit', visitType: 'challenge', mapSource: 'challenge-catalog', houseId: 'expert-house', ownerMode: 'ai', perkSelection: { owner: ['trap-reinforcement', 'spectator-control'] } })
  challengeVisit.guardian = guardian
  assert.equal(saveActiveChallenge({ houseId: 'expert-house', compound: challengeCompound, visit: challengeVisit }, storage), true)
  const challengeReload = loadActiveChallenge(storage)
  assert.equal(challengeReload.visit.ownerMode, 'ai')
  assert.deepEqual(challengeReload.visit.guardian, guardian)
})

test('challenge AI can activate configured Host Perks through the existing bounded perk and effect systems', () => {
  const perkId = 'trap-reinforcement'
  const trap = { id: 'ai-owned-trap', type: 'trap', trapType: 'electric', name: 'AI trap', x: 4, y: 4, w: 1, h: 1, effect: { strength: 1, durationTurns: 1 } }
  const houseCompound = createCompoundData([...STARTER_ITEMS, trap])
  const visit = createVisit(houseCompound, { id: 'ai-host-perk', visitType: 'challenge', ownerMode: 'ai', perkSelection: { owner: ['trap-reinforcement'] } })
  const store = createPerkStore()
  const activationId = `${visit.id}:owner:${perkId}:1`
  const activation = activatePerk(store, visit.perks, { visitId: visit.id, profileId: 'challenge-owner:advanced-house', role: 'owner', actorRole: 'guardian', perkId, activationId })
  assert.equal(activation.ok, true)
  const applied = applySelectedPerkEffect({ ...visit, perks: activation.visitPerks }, { id: perkId, role: 'owner', effect: 'reinforce-trap', effectConfig: { multiplier: 1.25 } }, { trapId: trap.id, activationId })
  assert.equal(applied.visit.trapStates[trap.id].reinforcementMultiplier, 1.25)
  assert.equal(activatePerk(store, visit.perks, { visitId: visit.id, profileId: 'challenge-owner:advanced-house', role: 'owner', actorRole: 'owner', perkId, activationId: `${visit.id}:owner:${perkId}:unauthorized` }).ok, false)
  assert.equal(activatePerk(store, visit.perks, { visitId: visit.id, profileId: 'local-guest', role: 'guest', actorRole: 'guardian', perkId: 'trap-warning', activationId: `${visit.id}:guest:trap-warning:unauthorized` }).ok, false)
  assert.equal(visit.ownerMode, 'ai')
})

test('Challenge House guardian loadouts are explicit and remain within the existing two-Perk limit', () => {
  assert.deepEqual(CHALLENGE_HOUSES.map((house) => house.guardianPerks), [[], ['trap-reinforcement'], ['trap-reinforcement', 'spectator-control']])
  assert.deepEqual(CHALLENGE_HOUSES.map((house) => house.guardianDifficulty), ['easy', 'normal', 'hard'])
  for (const house of CHALLENGE_HOUSES) {
    assert.ok(house.guardianPerks.length <= 2)
    assert.ok(house.guardianPerks.every((perkId) => ['trap-reinforcement', 'spectator-control'].includes(perkId)))
  }
})

test('Guardian never selects owner-only Trap Map, even if a malformed loadout contains it', () => {
  const hidden = { id: 'hidden-trap-map-test', type: 'trap', trapType: 'electric', x: 5, y: 4, w: 1, h: 1, visibility: 'hidden' }
  const compound = createCompoundData([...STARTER_ITEMS, hidden])
  const visit = createVisit(compound, { id: 'guardian-no-trap-map', visitType: 'challenge', ownerMode: 'ai', perkSelection: { owner: ['trap-map'] } })
  const guardian = { ...createGuardianState(visit.id, 'hard'), phase: 'present', retreatAt: 99999, lastDecisionStep: -1 }
  const result = evaluateAI(guardian, compound, visit, { now: 1 })
  assert.notEqual(result.action?.perkId, 'trap-map')
})

test('AI Guardian is routed only to Challenge Houses and regular saves default to unguarded', async () => {
  const source = await readFile(new URL('./VisitGame.jsx', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  const challengeVisitSource = await readFile(new URL('./challengeVisit.js', import.meta.url), 'utf8')
  assert.match(source, /if \(!challengeHouse \|\| !isActive \|\| terminal \|\| visit\.visitType !== 'challenge' \|\| visit\.ownerMode !== 'ai'\) return undefined/)
  assert.match(source, /guardian=\{challengeHouse && visit\.ownerMode === 'ai' \? visit\.guardian : null\}/)
  assert.match(source, /challengeHouse\s*\?\s*saveActiveChallenge\([\s\S]*?:\s*saveActiveVisit\(activeCompound, effectedVisit\)/)
  assert.match(source, /const discovered = trap && \(trap\.visibility !== 'hidden' \|\| ownerView && canRevealHiddenTraps\(visit, 'owner'\)/)
  assert.match(source, /guardianAllowedForVisit\(\{ visitType: current\.visitType, ownerMode: current\.ownerMode \}\)/)
  assert.match(source, /humanOwnerCanAct\(current, Boolean\(challengeHouse\)\)/)
  assert.match(source, /ownerMode: current\.ownerMode === 'human' \? 'absent' : 'human'/)
  assert.match(source, /delete regularVisit\.guardian/)
  assert.match(source, /delete regularVisit\.perks\.ownerActor/)
  assert.match(source, /ownerMode: initialVisit\.ownerMode === 'human' && initialVisit\.visitType !== 'player-house' \? 'human' : 'absent'/)
  assert.match(source, /ownerMode: 'ai'/)
  assert.doesNotMatch(source, /visit-spectator-toggle/)
  assert.match(appSource, /ownerMode: 'absent'/)
  assert.match(challengeVisitSource, /ownerMode: 'ai'/)
  assert.match(appSource, /selectedIds: house\?\.guardianPerks/)
  assert.doesNotMatch(source, /onChange=\{\(event\) => setVisit\(\(current\) => \(\{ \.\.\.current, guardian:/)
})

test('real user-owned visits can never activate AI; challenge visits require an AI owner', () => {
  const compound = createCompoundData(STARTER_ITEMS)
  const visit = createVisit(compound, { id: 'route-exclusion-test' })
  const waiting = createGuardianState(visit.id, 'hard')
  assert.equal(guardianAllowedForVisit({ visitType: 'regular', ownerMode: 'absent' }), false)
  assert.equal(guardianAllowedForVisit({ visitType: 'regular', ownerMode: 'human' }), false)
  assert.equal(guardianAllowedForVisit({ visitType: 'challenge', ownerMode: 'human' }), false)
  assert.equal(guardianAllowedForVisit({ visitType: 'challenge', ownerMode: 'ai' }), true)
  assert.equal(humanOwnerCanAct({ ownerMode: 'absent' }), false)
  assert.equal(humanOwnerCanAct({ visitType: 'regular', ownerMode: 'human' }), true)
  assert.equal(humanOwnerCanAct({ ownerMode: 'human' }, true), false)
  assert.equal(humanOwnerCanAct({ visitType: 'player-house', ownerMode: 'human' }), false)
  const regular = evaluateGuardian(waiting, compound, visit, { now: 100000 })
  assert.equal(regular.changed, false)
  assert.equal(regular.guardian.phase, waiting.phase)

  const challengeVisit = { ...visit, visitType: 'challenge', ownerMode: 'ai', guest: { ...visit.guest, stepsTaken: visit.stepBudget } }
  const challenge = evaluateGuardian(waiting, compound, challengeVisit, { now: 100000 })
  assert.equal(challenge.guardian.phase, waiting.phase === 'absent' ? 'absent' : 'present')
  assert.equal(createVisit(compound, { id: 'regular-owner-absent' }).ownerMode, 'absent')
  const trueChallenge = createVisit(compound, { id: 'challenge-owner-ai', visitType: 'challenge', ownerMode: 'ai' })
  assert.equal(trueChallenge.ownerMode, 'ai')
  assert.equal(trueChallenge.visitType, 'challenge')
  assert.equal(createVisit(compound, { id: 'wrongly-routed-ai', ownerMode: 'ai' }).ownerMode, 'absent')
  assert.equal(createVisit(compound, { id: 'human-owner-mode', visitType: 'regular', ownerMode: 'human' }).ownerMode, 'human')
  assert.equal(createVisit(compound, { id: 'wrong-human-challenge-mode', visitType: 'challenge', ownerMode: 'human' }).ownerMode, 'absent')
  const regularAttempt = createVisit(compound, { id: 'regular-owner-perk-block', perkSelection: { owner: ['trap-reinforcement'] } })
  assert.equal(activatePerk(createPerkStore(), regularAttempt.perks, { visitId: regularAttempt.id, profileId: 'computer-owner:regular', role: 'owner', actorRole: 'guardian', perkId: 'trap-reinforcement', activationId: 'regular-owner-perk-block:guardian:1' }).ok, false)
})
