import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activatePerk,
  canRevealHiddenTraps,
  createPerkStore,
  createVisitPerkState,
  grantPerk,
  isPerkActive,
  listPerksForRole,
  loadPerkStore,
  PERK_STORAGE_KEY,
  projectTrapsForViewer,
  savePerkStore,
  saveVisitPerkSelection,
  validatePerkSelection,
} from './perks.js'

function reward(store, { role = 'owner', profileId = `${role}-1`, remainingUses = 1, limitKind = 'visits', grantId = 'reward:trap-map' } = {}) {
  return grantPerk(store, { role, profileId, perkId: 'trap-map', source: 'reward', grantId, limitKind, remainingUses })
}

function selectForVisit(store, visitId, role = 'owner') {
  return saveVisitPerkSelection(store, {
    visitId,
    profiles: { owner: 'owner-1', guest: 'guest-1' },
    selections: { owner: role === 'owner' ? ['trap-map'] : [], guest: role === 'guest' ? ['trap-map'] : [] },
    maxSelected: 2,
  })
}

test('perk definitions and selection are isolated by player role', () => {
  const store = reward(createPerkStore()).store
  assert.deepEqual(listPerksForRole('guest'), [])
  assert.equal(listPerksForRole('owner').some((perk) => perk.id === 'trap-map'), true)
  assert.deepEqual(validatePerkSelection(store, { profileId: 'guest-1', role: 'guest', selectedIds: ['trap-map'], maxSelected: 2 }), { ok: false, error: 'role-or-perk-mismatch' })
  assert.deepEqual(validatePerkSelection(store, { profileId: 'owner-1', role: 'owner', selectedIds: ['trap-map'], maxSelected: 0 }), { ok: false, error: 'selection-limit' })
})

test('locked perks need an achievement, challenge, or reward grant; payments remain disabled', () => {
  const empty = createPerkStore()
  assert.equal(validatePerkSelection(empty, { profileId: 'owner-1', role: 'owner', selectedIds: ['trap-map'], maxSelected: 2 }).error, 'perk-locked-or-exhausted')
  assert.equal(grantPerk(empty, { profileId: 'owner-1', role: 'owner', perkId: 'trap-map', source: 'purchase', limitKind: 'visits', remainingUses: 1 }).error, 'unsupported-grant-source')
  const first = reward(empty)
  const duplicateReward = reward(first.store)
  assert.equal(first.ok, true)
  assert.equal(duplicateReward.duplicate, true)
  assert.equal(duplicateReward.inventory.remainingUses, 1)
})

test('selection limit is enforced separately for each role', () => {
  const store = reward(createPerkStore()).store
  const selected = selectForVisit(store, 'selection-limit')
  assert.equal(selected.ok, true)
  assert.equal(validatePerkSelection(selected.store, { profileId: 'owner-1', role: 'owner', selectedIds: ['trap-map', 'other-one', 'other-two'], maxSelected: 2 }).error, 'selection-limit')
})

test('activation consumes a visit charge once and cannot be reused by refresh or duplicate input', () => {
  const store = reward(createPerkStore()).store
  const selected = selectForVisit(store, 'visit-use')
  const visitPerks = createVisitPerkState('visit-use', selected.selection)
  const activation = { visitId: 'visit-use', profileId: 'owner-1', role: 'owner', actorRole: 'owner', perkId: 'trap-map', activationId: 'visit-use:owner:trap-map:1' }
  const activated = activatePerk(selected.store, visitPerks, activation)
  assert.equal(activated.ok, true)
  assert.equal(activated.inventory.remainingUses, 0)
  assert.equal(isPerkActive(activated.visitPerks, 'owner', 'trap-map'), true)

  const records = new Map()
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }
  savePerkStore(activated.store, storage)
  const restoredStore = loadPerkStore(storage)
  const repeated = activatePerk(restoredStore, visitPerks, activation)
  assert.equal(repeated.ok, true)
  assert.equal(repeated.duplicate, true)
  assert.equal(repeated.store.profiles['owner:owner-1'].inventory['trap-map'].remainingUses, 0)
  assert.equal(records.has(PERK_STORAGE_KEY), true)
  assert.equal(activatePerk(restoredStore, activated.visitPerks, { ...activation, activationId: 'visit-use:owner:trap-map:2' }).error, 'visit-activation-limit')
  assert.equal(validatePerkSelection(restoredStore, { profileId: 'owner-1', role: 'owner', selectedIds: ['trap-map'], maxSelected: 2 }).error, 'perk-locked-or-exhausted')
})

test('the owner trap map reveals hidden traps only to the owner and never edits trap visibility', () => {
  const store = reward(createPerkStore(), { limitKind: 'permanent', remainingUses: null }).store
  const selection = selectForVisit(store, 'owner-map')
  const current = { id: 'owner-map', outcome: 'active', perks: createVisitPerkState('owner-map', selection.selection), trapStates: {} }
  const hiddenTrap = { id: 'hidden-1', visibility: 'hidden', x: 3, y: 2 }
  const visibleTrap = { id: 'visible-1', visibility: 'visible', x: 4, y: 2 }
  const activated = activatePerk(selection.store, current.perks, { visitId: 'owner-map', profileId: 'owner-1', role: 'owner', perkId: 'trap-map', activationId: 'owner-map:owner:trap-map:1' })
  const activeVisit = { ...current, perks: activated.visitPerks }

  assert.equal(canRevealHiddenTraps(activeVisit, 'owner'), true)
  assert.equal(canRevealHiddenTraps(activeVisit, 'guest'), false)
  assert.deepEqual(projectTrapsForViewer([hiddenTrap, visibleTrap], activeVisit, 'owner').map((trap) => trap.id), ['hidden-1', 'visible-1'])
  assert.deepEqual(projectTrapsForViewer([hiddenTrap, visibleTrap], activeVisit, 'guest').map((trap) => trap.id), ['visible-1'])
  assert.equal(hiddenTrap.visibility, 'hidden')

  const guestDiscoveredVisit = { ...current, trapStates: { 'hidden-1': { triggered: true } } }
  assert.deepEqual(projectTrapsForViewer([hiddenTrap, visibleTrap], guestDiscoveredVisit, 'owner').map((trap) => trap.id), ['visible-1'])
  assert.deepEqual(projectTrapsForViewer([hiddenTrap, visibleTrap], guestDiscoveredVisit, 'guest').map((trap) => trap.id), ['hidden-1', 'visible-1'])

  const ended = { ...activeVisit, outcome: 'completed' }
  assert.equal(canRevealHiddenTraps(ended, 'owner'), false)
})

test('cross-role activation and mismatched profiles are rejected', () => {
  const store = reward(createPerkStore()).store
  const selected = selectForVisit(store, 'role-guard')
  const visitPerks = createVisitPerkState('role-guard', selected.selection)
  const attempt = activatePerk(selected.store, visitPerks, { visitId: 'role-guard', profileId: 'owner-1', role: 'owner', actorRole: 'guest', perkId: 'trap-map', activationId: 'bad-role-activation' })
  assert.equal(attempt.ok, false)
  assert.equal(attempt.error, 'role-or-activation-mismatch')
  assert.equal(selected.store.activationLedger.length, 0)
})
