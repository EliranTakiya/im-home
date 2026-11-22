import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CHALLENGE_HOUSES, createChallengeCompound } from './challenges/houses.js'
import { createChallengeVisit } from './challengeVisit.js'
import { GUARDIAN_DIFFICULTIES } from './guardianAI.js'
import { createEquipmentStore, createVisitEquipment } from './equipment.js'
import { loadActiveChallenge, saveActiveChallenge } from './challenges/progress.js'

test('all challenge houses can start at every selected difficulty with matching Guardian parameters', () => {
  for (const house of CHALLENGE_HOUSES) for (const difficulty of Object.keys(GUARDIAN_DIFFICULTIES)) {
    const target = { visitType: 'challenge', mapSource: 'challenge-catalog', houseId: house.id, compound: createChallengeCompound(house.id) }
    const equipment = createVisitEquipment(createEquipmentStore(), ['gas-mask'])
    const visit = createChallengeVisit(target, { id: `${house.id}-${difficulty}`, difficulty, perkSelection: { guest: ['trap-warning'], owner: house.guardianPerks }, equipment })
    const profile = GUARDIAN_DIFFICULTIES[difficulty]
    assert.equal(visit.visitType, 'challenge')
    assert.equal(visit.mapSource, 'challenge-catalog')
    assert.equal(visit.houseId, house.id)
    assert.equal(visit.guardian.difficulty, difficulty)
    assert.ok(visit.guardian.entryProgress >= profile.entryMin && visit.guardian.entryProgress <= profile.entryMax)
    assert.ok(visit.guardian.staySeconds >= profile.stayMinSeconds && visit.guardian.staySeconds <= profile.stayMaxSeconds)
    assert.deepEqual(visit.perks.selections.guest, ['trap-warning'])
    assert.deepEqual(visit.perks.selections.owner, house.guardianPerks)
    assert.equal(visit.equipment.tools['gas-mask'] !== undefined, true)
  }
})

test('challenge visit creation rejects invalid difficulty or non-catalog targets', () => {
  const house = CHALLENGE_HOUSES[0]
  const target = { visitType: 'challenge', mapSource: 'challenge-catalog', houseId: house.id, compound: createChallengeCompound(house.id) }
  assert.equal(createChallengeVisit(target, { id: 'invalid-difficulty', difficulty: 'extreme' }), null)
  assert.equal(createChallengeVisit({ ...target, mapSource: 'builder' }, { id: 'wrong-map', difficulty: 'easy' }), null)
})

test('selected Guardian difficulty and preparation choices survive the existing active-challenge save', () => {
  const house = CHALLENGE_HOUSES[2]
  const target = { visitType: 'challenge', mapSource: 'challenge-catalog', houseId: house.id, compound: createChallengeCompound(house.id) }
  const visit = createChallengeVisit(target, {
    id: 'saved-expert-hard',
    difficulty: 'hard',
    perkSelection: { guest: ['trap-warning'], owner: house.guardianPerks },
    equipment: createVisitEquipment(createEquipmentStore(), ['floor-kit']),
  })
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(saveActiveChallenge({ houseId: house.id, compound: target.compound, visit }, storage), true)
  const restored = loadActiveChallenge(storage)
  assert.equal(restored.visit.guardian.difficulty, 'hard')
  assert.deepEqual(restored.visit.perks.selections.guest, ['trap-warning'])
  assert.deepEqual(restored.visit.equipment.selectedToolIds, ['floor-kit'])
})

test('challenge preparation presents defense and Guest Perks before equipment and waits for summary confirmation', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  const defenseIndex = app.indexOf('<HostPerkBriefing')
  const guestPerksIndex = app.indexOf('<PerkSelection key={challengeDraft.id}')
  const equipmentIndex = app.indexOf('<EquipmentSelection stepLabel="שלב 5 מתוך 7"')
  const summaryIndex = app.indexOf('<ChallengeSummary')
  assert.ok(defenseIndex >= 0 && defenseIndex < guestPerksIndex)
  assert.ok(guestPerksIndex < equipmentIndex && equipmentIndex < summaryIndex)
  assert.match(app.slice(equipmentIndex, summaryIndex), /onStart=\{selectChallengeEquipment\}/)
  assert.match(app.slice(summaryIndex), /onStart=\{startChallengeWithEquipment\}/)
})
