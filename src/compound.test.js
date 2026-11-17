import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { BUILD_BUDGET, COMPOUND_DATA_VERSION, COMPOUND_STORAGE_KEY, LEGACY_COMPOUND_STORAGE_KEY, ROOM_COST, STARTER_ITEMS, canReachEntrance, changeTrapType, createCompoundData, isValidLayout, loadCompound, loadSavedItems, moveItem, placeRoom, placeTrap, removeItem, saveCompound, spentBudget, toggleTrapVisibility, updateTrapSettings } from './compound.js'
import { TRAP_TYPES, TRAP_TYPE_LIST, calculateTrapPrice } from './traps.js'

test('rooms can be built in separate free locations within the map', () => {
  const first = placeRoom(STARTER_ITEMS, 0, 0, 'room-one')
  assert.equal(first.error, undefined)
  const second = placeRoom(first.items, 9, 5, 'room-two')
  assert.equal(second.error, undefined)
  assert.equal(spentBudget(second.items), ROOM_COST * 2)
  assert.equal(canReachEntrance(second.items), true)
})

test('rooms and traps can be moved without overlaps or closing the entrance', () => {
  const trap = placeTrap(STARTER_ITEMS, 1, 4, 'trap-one')
  assert.equal(trap.error, undefined)
  const movedRoom = moveItem(trap.items, 'room-start', 0, 0)
  assert.equal(movedRoom.error, undefined)
  const movedTrap = moveItem(movedRoom.items, 'trap-one', 2, 4)
  assert.equal(movedTrap.error, undefined)
  assert.equal(movedTrap.items.find((item) => item.id === 'trap-one').x, 2)
  assert.equal(moveItem(movedTrap.items, 'room-start', 1, 3).error, 'blocked')
  assert.equal(canReachEntrance(movedTrap.items), true)
})

test('removing purchased items refunds their budget while starter rooms remain free', () => {
  const room = placeRoom(STARTER_ITEMS, 0, 0, 'paid-room')
  const trap = placeTrap(room.items, 1, 4, 'paid-trap')
  assert.equal(spentBudget(trap.items), ROOM_COST + TRAP_TYPES.electric.price)
  const withoutTrap = removeItem(trap.items, 'paid-trap')
  assert.equal(spentBudget(withoutTrap), ROOM_COST)
  const withoutRoom = removeItem(withoutTrap, 'paid-room')
  assert.equal(spentBudget(withoutRoom), 0)
  assert.equal(spentBudget(STARTER_ITEMS), 0)
  assert.equal(BUILD_BUDGET, 1000)
})

test('a placed trap is detectable and an alternate route stays open', () => {
  const result = placeTrap(STARTER_ITEMS, 5, 5, 'trap-route')
  assert.equal(result.error, undefined)
  assert.equal(result.item.visibility, 'visible')
  assert.equal(canReachEntrance(result.items), true)
})

test('trap discovery state toggles without changing its location, price, or access route', () => {
  const placed = placeTrap(STARTER_ITEMS, 1, 4, 'trap-visibility')
  const hiddenItems = toggleTrapVisibility(placed.items, 'trap-visibility')
  const hiddenTrap = hiddenItems.find((item) => item.id === 'trap-visibility')
  assert.equal(hiddenTrap.visibility, 'hidden')
  assert.deepEqual([hiddenTrap.x, hiddenTrap.y], [1, 4])
  assert.equal(spentBudget(hiddenItems), TRAP_TYPES.electric.price)
  assert.equal(canReachEntrance(hiddenItems), true)
  const visibleItems = toggleTrapVisibility(hiddenItems, 'trap-visibility')
  assert.equal(visibleItems.find((item) => item.id === 'trap-visibility').visibility, 'visible')
})

test('the four trap types have their configured metadata and independent map markers', async () => {
  assert.deepEqual(TRAP_TYPE_LIST.map((trap) => trap.id), ['electric', 'floor', 'gas', 'door'])
  assert.deepEqual(TRAP_TYPE_LIST.map((trap) => trap.price), [120, 130, 150, 110])
  for (const definition of TRAP_TYPE_LIST) {
    const placed = placeTrap(STARTER_ITEMS, 1, 4, `trap-${definition.id}`, definition.id)
    assert.equal(placed.error, undefined)
    assert.equal(placed.item.trapType, definition.id)
    assert.equal(placed.item.name, definition.name)
    assert.equal(placed.item.description, definition.description)
    assert.equal(placed.item.price, definition.price)
    assert.ok(placed.item.effect.kind)
    assert.ok(placed.item.activation.event)
  }
  const css = await readFile(new URL('./Builder.css', import.meta.url), 'utf8')
  for (const definition of TRAP_TYPE_LIST) assert.ok(css.includes(`.trap-kind-${definition.id}`))
  assert.equal(new Set(TRAP_TYPE_LIST.map((trap) => trap.glyph)).size, 4)
  assert.equal(Object.values(TRAP_TYPES).length, 4)
})

test('new trap defaults match the requested effects and activation events', () => {
  const electric = placeTrap(STARTER_ITEMS, 1, 4, 'default-electric', 'electric').item
  const floor = placeTrap(STARTER_ITEMS, 1, 4, 'default-floor', 'floor').item
  const gas = placeTrap(STARTER_ITEMS, 1, 4, 'default-gas', 'gas').item
  const door = placeTrap(STARTER_ITEMS, 1, 4, 'default-door', 'door').item
  assert.deepEqual(electric.effect, { kind: 'damage', strength: 1, durationTurns: 1 })
  assert.equal(electric.activation.event, 'step')
  assert.deepEqual(floor.effect, { kind: 'restart', stopTurns: 1 })
  assert.equal(floor.activation.event, 'step')
  assert.deepEqual(gas.effect, { kind: 'hazard-zone', radius: 1, strength: 1, durationTurns: 1 })
  assert.equal(gas.activation.event, 'area-entry')
  assert.deepEqual(door.effect, { kind: 'block-and-reroute', lockDuration: 1, openMode: 'automatic' })
  assert.equal(door.activation.event, 'passage-attempt')
})

test('changing trap type updates price and settings without changing its map position', () => {
  const placed = placeTrap(STARTER_ITEMS, 2, 4, 'editable-trap', 'electric')
  const hidden = toggleTrapVisibility(placed.items, 'editable-trap')
  const changed = changeTrapType(hidden, 'editable-trap', 'gas')
  const gasTrap = changed.find((item) => item.id === 'editable-trap')
  assert.equal(gasTrap.trapType, 'gas')
  assert.equal(gasTrap.price, TRAP_TYPES.gas.price)
  assert.equal(gasTrap.visibility, 'hidden')
  assert.deepEqual([gasTrap.x, gasTrap.y], [2, 4])

  const configured = updateTrapSettings(changed, 'editable-trap', {
    effect: { radius: 2, strength: 3, durationTurns: 2 },
    activation: { event: 'manual' },
  })
  const updatedTrap = configured.find((item) => item.id === 'editable-trap')
  assert.deepEqual(updatedTrap.effect, { kind: 'hazard-zone', radius: 2, strength: 3, durationTurns: 2 })
  assert.equal(updatedTrap.price, 240)
  assert.equal(updatedTrap.activation.event, 'manual')
  assert.equal(spentBudget(configured), calculateTrapPrice(updatedTrap))
  assert.equal(canReachEntrance(configured), true)
})

test('effect customization changes per-item prices and leaves other traps untouched', () => {
  const first = placeTrap(STARTER_ITEMS, 1, 4, 'electric-custom', 'electric')
  const second = placeTrap(first.items, 3, 4, 'gas-default', 'gas')
  const electricSettings = updateTrapSettings(second.items, 'electric-custom', {
    effect: { strength: 3, durationTurns: 2 },
    activation: { event: 'manual' },
    name: 'קשת חשמל',
    description: 'מלכודת מותאמת אישית',
  })
  assert.equal(electricSettings.find((item) => item.id === 'electric-custom').price, 185)
  assert.equal(electricSettings.find((item) => item.id === 'electric-custom').name, 'קשת חשמל')
  assert.equal(electricSettings.find((item) => item.id === 'gas-default').price, TRAP_TYPES.gas.price)
  assert.equal(electricSettings.find((item) => item.id === 'gas-default').name, TRAP_TYPES.gas.name)

  const gasSettings = updateTrapSettings(electricSettings, 'gas-default', { effect: { radius: 3, durationTurns: 5 } })
  assert.equal(gasSettings.find((item) => item.id === 'gas-default').price, 260)
  assert.equal(gasSettings.find((item) => item.id === 'electric-custom').effect.strength, 3)
  const strongerGas = updateTrapSettings(gasSettings, 'gas-default', { effect: { strength: 3 } })
  assert.equal(strongerGas.find((item) => item.id === 'gas-default').price, 310)

  const door = placeTrap(STARTER_ITEMS, 1, 4, 'door-custom', 'door')
  const timedDoor = updateTrapSettings(door.items, 'door-custom', { effect: { lockDuration: 4 } })
  assert.equal(timedDoor.find((item) => item.id === 'door-custom').price, 155)
  const keyDoor = updateTrapSettings(timedDoor, 'door-custom', { effect: { openMode: 'key' } })
  assert.equal(keyDoor.find((item) => item.id === 'door-custom').price, 140)
})

test('traps cannot block every bypass route or occupy the entrance', () => {
  const leftRoom = placeRoom(STARTER_ITEMS, 3, 5, 'left-side-room')
  const bothRooms = placeRoom(leftRoom.items, 6, 5, 'right-side-room')
  assert.equal(bothRooms.error, undefined)
  assert.equal(placeTrap(bothRooms.items, 5, 6, 'blocked-trap').error, 'route')
  assert.equal(placeTrap(STARTER_ITEMS, 5, 7, 'entrance-trap').error, 'blocked')
})

test('saved layouts reload after refresh and invalid saved data is rejected', () => {
  const room = placeRoom(STARTER_ITEMS, 0, 0, 'saved-room')
  const trap = placeTrap(room.items, 1, 4, 'saved-trap')
  const storage = { getItem: (key) => key === COMPOUND_STORAGE_KEY ? JSON.stringify(trap.items) : null }
  const restored = loadSavedItems(storage)
  assert.deepEqual(restored, trap.items)
  assert.equal(isValidLayout(restored), true)
  const invalidStorage = { getItem: () => JSON.stringify([{ id: 'trap', type: 'trap', x: 5, y: 7, w: 1, h: 1 }]) }
  assert.deepEqual(loadSavedItems(invalidStorage), STARTER_ITEMS)
})

test('hidden discovery state survives saving and loading; old saves default to visible', () => {
  const placed = placeTrap(STARTER_ITEMS, 1, 4, 'saved-hidden-trap')
  const hiddenItems = toggleTrapVisibility(placed.items, 'saved-hidden-trap')
  const hiddenStorage = { getItem: () => JSON.stringify(hiddenItems) }
  assert.equal(loadSavedItems(hiddenStorage).find((item) => item.id === 'saved-hidden-trap').visibility, 'hidden')

  const oldSave = { ...placed.items.find((item) => item.id === 'saved-hidden-trap') }
  delete oldSave.visibility
  const legacyStorage = { getItem: () => JSON.stringify([...STARTER_ITEMS, oldSave]) }
  assert.equal(loadSavedItems(legacyStorage).find((item) => item.id === 'saved-hidden-trap').visibility, 'visible')
})

test('versioned data keeps map structure separate from traps and survives save/load', () => {
  const paidRoom = placeRoom(STARTER_ITEMS, 0, 0, 'versioned-room')
  const placedTrap = placeTrap(paidRoom.items, 1, 4, 'versioned-trap')
  const hiddenItems = toggleTrapVisibility(placedTrap.items, 'versioned-trap')
  const versioned = createCompoundData(hiddenItems)

  assert.equal(versioned.version, COMPOUND_DATA_VERSION)
  assert.equal(versioned.map.rooms.length, 3)
  assert.equal(versioned.items.length, 1)
  assert.equal(versioned.items[0].visibility, 'hidden')
  assert.equal(versioned.map.entrances[0].x, versioned.map.exits[0].x)
  assert.equal(versioned.map.passages.length, 2)

  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  saveCompound(hiddenItems, storage)
  assert.deepEqual(JSON.parse(values.get(COMPOUND_STORAGE_KEY)), versioned)
  assert.deepEqual(loadCompound(storage), versioned)
  assert.deepEqual(loadSavedItems(storage), hiddenItems)
})

test('legacy storage is migrated automatically and retains room and trap positions', () => {
  const placedRoom = placeRoom(STARTER_ITEMS, 0, 0, 'legacy-room')
  const placedTrap = placeTrap(placedRoom.items, 1, 4, 'legacy-trap')
  const hiddenItems = toggleTrapVisibility(placedTrap.items, 'legacy-trap')
  const values = new Map([[LEGACY_COMPOUND_STORAGE_KEY, JSON.stringify(hiddenItems)]])
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }

  const migrated = loadCompound(storage)
  const savedCurrent = JSON.parse(values.get(COMPOUND_STORAGE_KEY))
  assert.equal(migrated.version, COMPOUND_DATA_VERSION)
  assert.deepEqual(migrated, savedCurrent)
  assert.deepEqual(migrated.map.rooms.find((room) => room.id === 'legacy-room'), hiddenItems.find((item) => item.id === 'legacy-room'))
  assert.deepEqual(migrated.items[0], hiddenItems.find((item) => item.id === 'legacy-trap'))
  assert.deepEqual(loadSavedItems(storage), hiddenItems)
})

test('version 2 compounds migrate to version 3 without losing layout or discovery state', () => {
  const placed = placeTrap(STARTER_ITEMS, 2, 4, 'v2-trap')
  const hiddenItems = toggleTrapVisibility(placed.items, 'v2-trap')
  const current = createCompoundData(hiddenItems)
  const version2 = JSON.parse(JSON.stringify(current))
  version2.version = 2
  for (const trap of version2.items) {
    for (const key of ['trapType', 'name', 'description', 'price', 'effect', 'activation']) delete trap[key]
  }
  const values = new Map([[COMPOUND_STORAGE_KEY, JSON.stringify(version2)]])
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }

  const migrated = loadCompound(storage)
  const trap = migrated.items[0]
  assert.equal(migrated.version, COMPOUND_DATA_VERSION)
  assert.deepEqual([trap.x, trap.y], [2, 4])
  assert.equal(trap.visibility, 'hidden')
  assert.equal(trap.trapType, 'electric')
  assert.equal(trap.price, 100)
  assert.equal(trap.legacyPrice, true)
  assert.equal(JSON.parse(values.get(COMPOUND_STORAGE_KEY)).version, COMPOUND_DATA_VERSION)
})

test('typed trap settings survive a version 3 save and reload', () => {
  const placed = placeTrap(STARTER_ITEMS, 2, 4, 'persistent-trap', 'floor')
  const configured = updateTrapSettings(placed.items, 'persistent-trap', {
    effect: { kind: 'restart' },
    activation: { event: 'manual' },
    visibility: 'hidden',
    name: 'בור נסתר',
    description: 'תיאור אישי למלכודת.',
  })
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  saveCompound(configured, storage)
  const restored = loadSavedItems(storage).find((item) => item.id === 'persistent-trap')
  assert.equal(restored.trapType, 'floor')
  assert.equal(restored.effect.kind, 'restart')
  assert.equal(restored.activation.event, 'manual')
  assert.equal(restored.visibility, 'hidden')
  assert.equal(restored.name, 'בור נסתר')
  assert.equal(restored.description, 'תיאור אישי למלכודת.')
  assert.equal(restored.price, TRAP_TYPES.floor.price)
})

test('all four trap configurations retain their independent settings after save and reload', () => {
  let items = STARTER_ITEMS
  for (const [id, type, x] of [['electric-one', 'electric', 0], ['floor-one', 'floor', 1], ['gas-one', 'gas', 10], ['door-one', 'door', 11]]) {
    const result = placeTrap(items, x, 0, id, type)
    assert.equal(result.error, undefined)
    items = result.items
  }
  items = updateTrapSettings(items, 'electric-one', { name: 'קשת', effect: { strength: 2, durationTurns: 3 }, activation: { event: 'manual' } })
  items = updateTrapSettings(items, 'floor-one', { effect: { kind: 'fall' } })
  items = updateTrapSettings(items, 'gas-one', { effect: { radius: 3, durationTurns: 5 }, visibility: 'hidden' })
  items = updateTrapSettings(items, 'door-one', { effect: { lockDuration: 3, openMode: 'key' }, activation: { event: 'manual' } })

  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  saveCompound(items, storage)
  assert.deepEqual(loadSavedItems(storage), items)
  assert.equal(canReachEntrance(loadSavedItems(storage)), true)
})

test('layout remains usable when browser storage is unavailable', () => {
  const storage = { getItem: () => { throw new Error('storage unavailable') } }
  assert.deepEqual(loadSavedItems(storage), STARTER_ITEMS)
})

test('the builder has dedicated narrow-screen layouts and keeps the map in document flow', async () => {
  const css = await readFile(new URL('./Builder.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 650px\)/)
  assert.match(css, /\.builder-layout\s*\{\s*display:\s*flex;\s*flex-direction:\s*column/)
  assert.match(css, /\.compound-grid\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--cols\)/)
})

test('switching to the home screen hides the builder instead of discarding its state', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  assert.match(app, /display: screen === 'builder' \? 'block' : 'none'/)
  assert.match(app, /<Builder onHome=\{\(\) => setScreen\('home'\)\}/)
})
