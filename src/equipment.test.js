import test from 'node:test'
import assert from 'node:assert/strict'
import { createEquipmentStore, createVisitEquipment, loadEquipmentStore, saveEquipmentStore, selectTools, validateToolSelection, consumeToolUse, equipmentDetectsTrap, EQUIPMENT_STORAGE_KEY } from './equipment.js'
import { createCompoundData, STARTER_ITEMS } from './compound.js'
import { createVisit, loadActiveVisit, saveActiveVisit } from './visitEngine.js'

function memoryStorage() {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }
}

test('backpack accepts valid selections and rejects over-capacity or unknown tools', () => {
  const store = createEquipmentStore()
  assert.deepEqual(validateToolSelection(store, ['insulated-gloves', 'gas-mask']), { ok: true, selectedToolIds: ['insulated-gloves', 'gas-mask'], usedSpace: 5, capacity: 6 })
  assert.equal(validateToolSelection(store, ['insulated-gloves', 'gas-mask', 'insulated-gloves']).usedSpace, 5)
  assert.equal(validateToolSelection(store, ['unknown']).error, 'unknown-tool')
  assert.equal(validateToolSelection(store, ['insulated-gloves', 'gas-mask', 'floor-kit', 'door-kit']).error, 'capacity')
  const small = { ...createEquipmentStore(), backpackCapacity: 4 }
  assert.equal(validateToolSelection(small, ['insulated-gloves', 'gas-mask']).error, 'capacity')
})

test('tool inventory persists across reload and visit charges are isolated to a visit snapshot', () => {
  const storage = memoryStorage()
  const selection = selectTools(createEquipmentStore(), ['insulated-gloves', 'gas-mask'])
  assert.equal(selection.ok, true)
  assert.equal(saveEquipmentStore(selection.store, storage), true)
  assert.deepEqual(loadEquipmentStore(storage).selectedToolIds, ['insulated-gloves', 'gas-mask'])
  assert.ok(storage.getItem(EQUIPMENT_STORAGE_KEY))

  const equipment = createVisitEquipment(loadEquipmentStore(storage))
  const use = consumeToolUse(equipment, 'insulated-gloves', 'electric', 'trap-1')
  assert.equal(use.ok, true)
  assert.equal(consumeToolUse(equipment, 'insulated-gloves', 'electric', 'trap-1').error, 'already-used')
  assert.equal(equipment.tools['insulated-gloves'].usesRemaining, 0)

  const compound = createCompoundData(STARTER_ITEMS)
  const visit = createVisit(compound, { id: 'equipment-restore', equipment })
  assert.equal(saveActiveVisit(compound, visit, storage), true)
  const restored = loadActiveVisit(storage)
  assert.equal(restored.session.equipment.tools['insulated-gloves'].usesRemaining, 0)
  assert.deepEqual(restored.session.equipment.tools['insulated-gloves'].uses, [{ actionId: 'trap-1', trapType: 'electric' }])
  assert.equal(consumeToolUse(createVisitEquipment(loadEquipmentStore(storage)), 'insulated-gloves', 'electric', 'trap-2').ok, true)
})

test('tool use rejects incompatible traps and upgrades improve effect and use count', () => {
  const store = { ...createEquipmentStore(), upgrades: { 'gas-mask': 2 } }
  const gear = createVisitEquipment(store, ['gas-mask'])
  assert.equal(gear.tools['gas-mask'].usesRemaining, 4)
  assert.equal(gear.tools['gas-mask'].impact.amount, 15)
  assert.equal(consumeToolUse(gear, 'gas-mask', 'floor', 'x').error, 'incompatible-tool')
  const electricBase = createVisitEquipment(createEquipmentStore(), ['insulated-gloves'])
  const electricUpgraded = createVisitEquipment({ ...createEquipmentStore(), upgrades: { 'insulated-gloves': 1 } }, ['insulated-gloves'])
  assert.equal(electricBase.tools['insulated-gloves'].impact.amount, 5)
  assert.equal(electricUpgraded.tools['insulated-gloves'].impact.amount, 10)
  assert.equal(electricUpgraded.tools['insulated-gloves'].usesRemaining, 2)
})

test('a manually used compatible tool mitigates trap damage and persists its consumed use', async () => {
  const { createTrapData } = await import('./traps.js')
  const { resolvePendingTrap } = await import('./visitEngine.js')
  const trap = { id: 'electric-one', type: 'trap', x: 5, y: 6, w: 1, h: 1, ...createTrapData('electric'), activation: { event: 'manual' } }
  const compound = createCompoundData([...STARTER_ITEMS, trap])
  const equipment = createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['insulated-gloves'] })
  const visit = createVisit(compound, { id: 'mitigation', equipment })
  visit.pendingAction = { trapId: trap.id, position: { x: trap.x, y: trap.y }, kind: 'trap' }
  const next = resolvePendingTrap(compound, visit, true, 'insulated-gloves')
  assert.equal(next.guest.health, 95)
  assert.equal(next.equipment.tools['insulated-gloves'].usesRemaining, 0)
  assert.equal(next.events.some((event) => event.type === 'equipment'), true)
  assert.equal(consumeToolUse(next.equipment, 'insulated-gloves', 'electric', `${next.id}:${trap.id}`).error, 'already-used')
})

test('gas mask protection continues for the same active gas trap and the visit snapshot keeps the protection', async () => {
  const { createTrapData } = await import('./traps.js')
  const { resolvePendingTrap, saveActiveVisit, loadActiveVisit } = await import('./visitEngine.js')
  const trap = { id: 'gas-one', type: 'trap', x: 5, y: 6, w: 1, h: 1, ...createTrapData('gas'), effect: { ...createTrapData('gas').effect, strength: 2, durationTurns: 3 }, activation: { event: 'manual' } }
  const compound = createCompoundData([...STARTER_ITEMS, trap])
  const equipment = createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['gas-mask'] })
  const visit = createVisit(compound, { id: 'gas-protection', equipment })
  visit.pendingAction = { trapId: trap.id, position: { x: trap.x, y: trap.y }, kind: 'trap' }
  const protectedVisit = resolvePendingTrap(compound, visit, true, 'gas-mask')
  assert.equal(protectedVisit.guest.health, 85)
  assert.equal(protectedVisit.trapStates[trap.id].gasProtectionAmount, 5)
  assert.equal(protectedVisit.equipment.tools['gas-mask'].usesRemaining, 1)
  const storage = memoryStorage()
  saveActiveVisit(compound, protectedVisit, storage)
  const restored = loadActiveVisit(storage).session
  assert.equal(restored.trapStates[trap.id].gasProtectionAmount, 5)
  assert.equal(restored.equipment.tools['gas-mask'].usesRemaining, 1)
})

test('automatic electrical traps pause for a tool decision and still deal health damage and stun', async () => {
  const { createTrapData } = await import('./traps.js')
  const { advanceVisit, resolvePendingTrap } = await import('./visitEngine.js')
  const trap = { id: 'electric-auto', type: 'trap', x: 5, y: 6, w: 1, h: 1, ...createTrapData('electric') }
  const compound = createCompoundData([...STARTER_ITEMS, trap])
  const equipment = createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['insulated-gloves'] })
  const initial = createVisit(compound, { id: 'electric-auto-visit', equipment })
  const pending = advanceVisit(compound, initial)
  assert.equal(pending.pendingAction.kind, 'auto-trap')
  assert.equal(pending.trapStates[trap.id].triggered, false)
  const storage = memoryStorage()
  assert.equal(saveActiveVisit(compound, pending, storage), true)
  const restoredPending = loadActiveVisit(storage).session
  assert.equal(restoredPending.pendingAction.kind, 'auto-trap')
  const result = resolvePendingTrap(compound, restoredPending, true, 'insulated-gloves')
  assert.equal(result.trapStates[trap.id].triggered, true)
  assert.equal(result.guest.health, 95)
  assert.equal(result.guest.stunTurnsRemaining, 1)
  assert.equal(result.equipment.tools['insulated-gloves'].usesRemaining, 0)
  assert.equal(result.equipment.tools['insulated-gloves'].uses.length, 1)
  saveActiveVisit(compound, result, storage)
  assert.equal(loadActiveVisit(storage).session.equipment.tools['insulated-gloves'].usesRemaining, 0)
})

test('floor kit detects a hidden nearby floor trap and changes restart into a stop without losing progress', async () => {
  const { createTrapData } = await import('./traps.js')
  const { advanceVisit, resolvePendingTrap } = await import('./visitEngine.js')
  const trap = { id: 'floor-hidden', type: 'trap', x: 5, y: 6, w: 1, h: 1, visibility: 'hidden', ...createTrapData('floor') }
  const compound = createCompoundData([...STARTER_ITEMS, trap])
  const equipment = createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['floor-kit'] })
  const initial = createVisit(compound, { id: 'floor-recovery', equipment })
  assert.equal(equipmentDetectsTrap(equipment, trap, initial.guest.position), true)
  initial.guest.stepsTaken = Math.floor(initial.plannedSteps / 2)
  initial.guest.progress = 50
  const pending = advanceVisit(compound, initial)
  assert.equal(pending.pendingAction.kind, 'auto-trap')
  const result = resolvePendingTrap(compound, pending, true, 'floor-kit')
  assert.equal(result.stage, 'outbound')
  assert.deepEqual(result.guest.position, pending.pendingAction.position)
  assert.ok(result.guest.progress >= 40)
  assert.equal(result.guest.stunTurnsRemaining, 1)
  assert.equal(result.guest.health, 100)
  assert.equal(result.equipment.tools['floor-kit'].usesRemaining, 0)
})

test('door kit detects and shortens timed locks, while key-required doors remain locked', async () => {
  const { createTrapData } = await import('./traps.js')
  const { advanceVisit, resolvePendingTrap } = await import('./visitEngine.js')
  const timed = { id: 'door-timed', type: 'trap', x: 5, y: 6, w: 1, h: 1, ...createTrapData('door'), effect: { ...createTrapData('door').effect, lockDuration: 3 } }
  const compound = createCompoundData([...STARTER_ITEMS, timed])
  const equipment = createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['door-kit'] })
  const initial = createVisit(compound, { id: 'door-tool-visit', equipment })
  assert.equal(equipmentDetectsTrap(equipment, timed, initial.guest.position), true)
  const pending = advanceVisit(compound, initial)
  assert.equal(pending.pendingAction.kind, 'auto-trap')
  const result = resolvePendingTrap(compound, pending, true, 'door-kit')
  assert.equal(result.trapStates[timed.id].lockedTurnsRemaining, 2)
  assert.equal(result.trapStates[timed.id].requiresKey, false)
  assert.equal(result.equipment.tools['door-kit'].usesRemaining, 0)

  const keyDoor = { ...timed, id: 'door-key', effect: { ...timed.effect, openMode: 'key' } }
  const keyCompound = createCompoundData([...STARTER_ITEMS, keyDoor])
  const keyVisit = createVisit(keyCompound, { id: 'door-key-visit', equipment: createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['door-kit'] }) })
  const encounter = advanceVisit(keyCompound, keyVisit)
  assert.equal(encounter.pendingAction, null)
  assert.equal(encounter.trapStates[keyDoor.id].requiresKey, true)
  assert.equal(encounter.equipment.tools['door-kit'].usesRemaining, 1)
})

test('gas mask pauses before automatic gas, protects each exposed turn, and uses one charge for the gas event', async () => {
  const { createTrapData } = await import('./traps.js')
  const { advanceVisit, resolvePendingTrap } = await import('./visitEngine.js')
  const trap = { id: 'gas-auto', type: 'trap', x: 5, y: 6, w: 1, h: 1, ...createTrapData('gas'), effect: { ...createTrapData('gas').effect, strength: 1, durationTurns: 3 } }
  const compound = createCompoundData([...STARTER_ITEMS, trap])
  const equipment = createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['gas-mask'] })
  const pending = advanceVisit(compound, createVisit(compound, { id: 'gas-auto-visit', equipment }))
  assert.equal(pending.pendingAction.kind, 'auto-trap')
  const result = resolvePendingTrap(compound, pending, true, 'gas-mask')
  assert.equal(result.guest.health, 95)
  assert.equal(result.trapStates[trap.id].gasProtectionAmount, 5)
  assert.equal(result.equipment.tools['gas-mask'].usesRemaining, 1)
  const nextTurn = advanceVisit(compound, result)
  assert.equal(nextTurn.guest.health, 90)
  assert.equal(nextTurn.equipment.tools['gas-mask'].usesRemaining, 1)
})

test('automatic encounters cannot be skipped to bypass the trap and active-visit saves retain tool charges', async () => {
  const { createTrapData } = await import('./traps.js')
  const { advanceVisit, resolvePendingTrap } = await import('./visitEngine.js')
  const trap = { id: 'floor-auto', type: 'trap', x: 5, y: 6, w: 1, h: 1, ...createTrapData('floor') }
  const compound = createCompoundData([...STARTER_ITEMS, trap])
  const equipment = createVisitEquipment({ ...createEquipmentStore(), selectedToolIds: ['floor-kit'] })
  const pending = advanceVisit(compound, createVisit(compound, { id: 'no-skip', equipment }))
  const resolved = resolvePendingTrap(compound, pending, false)
  assert.equal(resolved.trapStates[trap.id].triggered, true)
  assert.equal(resolved.trapStates[trap.id].ignored, false)
  const storage = memoryStorage()
  saveActiveVisit(compound, resolved, storage)
  assert.equal(loadActiveVisit(storage).session.equipment.tools['floor-kit'].usesRemaining, 1)
})
