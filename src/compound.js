import { createTrapData, DEFAULT_TRAP_TYPE, normalizeTrapData, TRAP_TYPES } from './traps.js'

export const MAP_COLS = 20
export const MAP_ROWS = 12
export const LEGACY_MAP_COLS = 12
export const LEGACY_MAP_ROWS = 8
export const PREVIOUS_MAP_COLS = 16
export const PREVIOUS_MAP_ROWS = 10
export const BUILD_BUDGET = 1000
export const AREA_BUDGET_BONUS = 10
export const ROOM_COST = 240
export const TRAP_COST = 100
export const COMPOUND_DATA_VERSION = 3
export const COMPOUND_STORAGE_KEY = 'im-home-compound'
export const LEGACY_COMPOUND_STORAGE_KEY = 'im-home-compound-v1'

export const STARTER_ITEMS = [
  { id: 'room-start', type: 'room', x: 4, y: 3, w: 3, h: 2, label: 'חדר מרכזי', free: true },
  { id: 'room-store', type: 'room', x: 9, y: 3, w: 2, h: 2, label: 'מחסן', free: true },
]

function createBaseMap(rooms = [], width = MAP_COLS, height = MAP_ROWS) {
  const entranceX = Math.floor(width / 2) - 3
  const crossY = height - 6
  return {
    width,
    height,
    rooms,
    passages: [
      { id: 'main-cross-passage', x: 0, y: crossY, width, height: 1 },
      { id: 'upper-gallery', x: 0, y: crossY - 1, width, height: 1 },
      { id: 'entrance-passage', x: entranceX, y: crossY + 1, width: 1, height: Math.max(1, height - crossY - 2) },
    ],
    walls: [],
    entrances: [{ id: 'main-entrance', x: entranceX, y: height - 1 }],
    exits: [{ id: 'main-exit', x: entranceX, y: height - 1 }],
  }
}

export function editorItemsFromCompound(compound) {
  return [...compound.map.rooms, ...compound.items]
}

export function createCompoundData(items, mapData = null) {
  const baseMap = createBaseMap(items.filter((item) => item.type === 'room').map((room) => ({ ...room })))
  const map = mapData ? {
    ...mapData,
    rooms: baseMap.rooms,
    passages: mapData.passages.map((passage) => ({ ...passage })),
    entrances: (mapData.entrances ?? baseMap.entrances).map((point) => ({ ...point })),
    exits: (mapData.exits ?? baseMap.exits).map((point) => ({ ...point })),
    walls: (mapData.walls ?? []).map((wall) => ({ ...wall })),
  } : baseMap
  return {
    version: COMPOUND_DATA_VERSION,
    map,
    items: items.filter((item) => item.type !== 'room').map((item) => normalizeTrapData(item)),
  }
}

export function overlaps(item, x, y, w = item.w, h = item.h) {
  return x < item.x + item.w && x + w > item.x && y < item.y + item.h && y + h > item.y
}

function mapDimensions(map) { return { width: map?.width ?? MAP_COLS, height: map?.height ?? MAP_ROWS } }

export function canReachEntrance(items, map = null) {
  const { width, height } = mapDimensions(map)
  const entrancePoint = map?.entrances?.[0] ?? map?.exits?.[0] ?? { x: Math.floor(width / 2) - 3, y: height - 1 }
  const crossY = map?.passages?.find((passage) => passage.x === 0 && passage.width === width)?.y ?? height - 6
  const blocked = (x, y) => items.some((item) => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h)
  const entrance = entrancePoint
  if (blocked(entrance.x, entrance.y)) return false

  const queue = Array.from({ length: width }, (_, x) => ({ x, y: crossY })).filter(({ x, y }) => !blocked(x, y))
  const visited = new Set(queue.map(({ x, y }) => `${x}:${y}`))
  for (let index = 0; index < queue.length; index += 1) {
    const { x, y } = queue[index]
    if (x === entrance.x && y === entrance.y) return true
    for (const [nextX, nextY] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const key = `${nextX}:${nextY}`
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height || (nextY === height - 1 && nextX !== entrance.x) || visited.has(key) || blocked(nextX, nextY)) continue
      visited.add(key)
      queue.push({ x: nextX, y: nextY })
    }
  }
  return false
}

export function isValidLayout(items, map = null) {
  const { width, height } = mapDimensions(map)
  if (!Array.isArray(items) || !items.every((item) => {
    if (!item || typeof item.id !== 'string' || !['room', 'trap'].includes(item.type)) return false
    if (![item.x, item.y, item.w, item.h].every(Number.isInteger) || item.x < 0 || item.y < 0) return false
    if (item.type === 'trap' && (item.w !== 1 || item.h !== 1)) return false
    if (item.type === 'trap' && item.visibility !== undefined && !['visible', 'hidden'].includes(item.visibility)) return false
    if (item.type === 'trap' && item.trapType !== undefined && !TRAP_TYPES[item.trapType]) return false
    if (item.type === 'trap' && item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0)) return false
    return item.w > 0 && item.h > 0 && item.x + item.w <= width && item.y + item.h <= height
  })) return false
  for (let index = 0; index < items.length; index += 1) {
    if (items.slice(index + 1).some((item) => overlaps(items[index], item.x, item.y, item.w, item.h))) return false
  }
  return canReachEntrance(items, map)
}

function isValidMap(map) {
  if (!map || !Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < LEGACY_MAP_COLS || map.height < LEGACY_MAP_ROWS) return false
  const { width, height } = map
  if (!Array.isArray(map.rooms) || !Array.isArray(map.passages) || !Array.isArray(map.entrances) || !Array.isArray(map.exits)) return false
  const entrancePoint = map.entrances.find((point) => Number.isInteger(point?.x) && point.x >= 0 && point.x < width && point?.y === height - 1)
  const exit = map.exits.some((point) => point?.x === entrancePoint?.x && point?.y === height - 1)
  const crossPassage = map.passages.find((passage) => passage?.x === 0 && passage?.width === width && passage?.height === 1)
  const entrance = Boolean(entrancePoint)
  const entrancePassage = Boolean(entrancePoint && crossPassage && map.passages.some((passage) => passage?.x === entrancePoint.x && passage?.y === crossPassage.y + 1 && passage?.width === 1 && passage?.y + passage.height === height - 1))
  const validPassages = map.passages.every((passage) => passage && Number.isInteger(passage.x) && Number.isInteger(passage.y) && Number.isInteger(passage.width) && Number.isInteger(passage.height) && passage.width > 0 && passage.height > 0 && passage.x >= 0 && passage.y >= 0 && passage.x + passage.width <= width && passage.y + passage.height <= height)
  const validWalls = map.walls === undefined || Array.isArray(map.walls) && map.walls.every((wall) => wall && Number.isInteger(wall.x) && Number.isInteger(wall.y) && wall.x >= 0 && wall.y >= 0 && wall.x < width && wall.y < height)
  return entrance && exit && crossPassage && entrancePassage && validPassages && validWalls
}

function normalizeCompound(compound) {
  if (!compound || compound.version !== COMPOUND_DATA_VERSION || !isValidMap(compound.map) || !Array.isArray(compound.items)) return null
  const { width } = mapDimensions(compound.map)
  const crossPassage = compound.map.passages.find((passage) => passage.x === 0 && passage.width === width && passage.height === 1)
  const passages = compound.map.passages.some((passage) => passage.id === 'upper-gallery') || compound.map.passages.some((passage) => passage.y === crossPassage.y - 1 && passage.x === 0 && passage.width === width && passage.height === 1)
    ? compound.map.passages : [...compound.map.passages, { id: 'upper-gallery', x: 0, y: crossPassage.y - 1, width, height: 1 }]
  const normalized = {
    version: COMPOUND_DATA_VERSION,
    map: { ...compound.map, walls: (compound.map.walls ?? []).map((wall) => ({ ...wall })), rooms: compound.map.rooms.map((room) => ({ ...room })), passages: passages.map((passage) => ({ ...passage })), entrances: compound.map.entrances.map((point) => ({ ...point })), exits: compound.map.exits.map((point) => ({ ...point })) },
    items: compound.items.map((item) => item?.type === 'trap' ? normalizeTrapData(item) : item),
  }
  const editorItems = editorItemsFromCompound(normalized)
  if (normalized.items.some((item) => item?.type !== 'trap') || !isValidLayout(editorItems, normalized.map)) return null
  return normalized
}

function upgradePersonalMap(compound) {
  const isLegacy = compound.map.width === LEGACY_MAP_COLS && compound.map.height === LEGACY_MAP_ROWS
  const isPrevious = compound.map.width === PREVIOUS_MAP_COLS && compound.map.height === PREVIOUS_MAP_ROWS
  if (!isLegacy && !isPrevious) return compound
  const offsetX = (MAP_COLS - compound.map.width) / 2
  const offsetY = MAP_ROWS - compound.map.height
  const oldCross = compound.map.passages.find((passage) => passage.x === 0 && passage.width === compound.map.width && passage.height === 1)
  const oldEntrance = compound.map.entrances[0]
  const passages = compound.map.passages.map((passage) => {
    if (passage.x === 0 && passage.width === compound.map.width && passage.height === 1) return { ...passage, y: passage.y + offsetY, width: MAP_COLS }
    if (passage.x === oldEntrance.x && passage.y === oldCross.y + 1 && passage.width === 1) return { ...passage, x: passage.x + offsetX, y: passage.y + offsetY }
    return { ...passage, x: passage.x + offsetX, y: passage.y + offsetY }
  })
  const expanded = {
    ...compound,
    map: {
      ...compound.map,
      width: MAP_COLS,
      height: MAP_ROWS,
      rooms: compound.map.rooms.map((room) => ({ ...room, x: room.x + offsetX, y: room.y + offsetY })),
      passages,
      walls: (compound.map.walls ?? []).map((wall) => ({ ...wall, x: wall.x + offsetX, y: wall.y + offsetY })),
      entrances: compound.map.entrances.map((point) => ({ ...point, x: point.x + offsetX, y: MAP_ROWS - 1 })),
      exits: compound.map.exits.map((point) => ({ ...point, x: point.x + offsetX, y: MAP_ROWS - 1 })),
    },
    items: compound.items.map((item) => ({ ...item, x: item.x + offsetX, y: item.y + offsetY })),
  }
  return normalizeCompound(expanded) ?? compound
}

export function migrateLegacyCompound(legacyItems) {
  if (!isValidLayout(legacyItems)) return null
  const compatibleItems = legacyItems.map((item) => {
    if (item.type !== 'trap') return item
    const preservePrice = item.legacyPrice === true || (item.trapType === undefined && item.price === undefined && item.cost === undefined)
    const normalized = { ...item, price: item.price ?? item.cost ?? TRAP_COST }
    if (preservePrice) normalized.legacyPrice = true
    else delete normalized.legacyPrice
    return normalizeTrapData(normalized)
  })
  const migrated = createCompoundData(compatibleItems)
  return normalizeCompound(migrated)
}

export function migrateVersion2Compound(compound) {
  if (!compound || compound.version !== 2 || !isValidMap(compound.map) || !Array.isArray(compound.items)) return null
  const flatItems = editorItemsFromCompound(compound)
  if (!isValidLayout(flatItems, compound.map)) return null
  const migrated = migrateLegacyCompound(flatItems)
  if (!migrated) return null
  migrated.map = {
    ...compound.map,
    rooms: compound.map.rooms.map((room) => ({ ...room })),
    passages: compound.map.passages.map((passage) => ({ ...passage })),
    entrances: compound.map.entrances.map((point) => ({ ...point })),
    exits: compound.map.exits.map((point) => ({ ...point })),
  }
  return normalizeCompound(migrated)
}

function persistMigration(store, legacyItems) {
  const migrated = migrateLegacyCompound(legacyItems)
  if (!migrated) return null
  try { store?.setItem(COMPOUND_STORAGE_KEY, JSON.stringify(migrated)) } catch { /* Keep the migrated compound usable if storage is read-only. */ }
  return migrated
}

export function loadCompound(storage) {
  let store
  try {
    store = storage ?? globalThis.localStorage
  } catch { /* Use a valid starter compound when storage is unavailable. */ }
  const read = (key) => {
    try {
      const value = store?.getItem(key)
      return value ? JSON.parse(value) : null
    } catch { return null }
  }

  const parsed = read(COMPOUND_STORAGE_KEY)
  if (Array.isArray(parsed)) return persistMigration(store, parsed) ?? migrateLegacyCompound(STARTER_ITEMS)
  if (parsed?.version === 1 && Array.isArray(parsed.items)) return persistMigration(store, parsed.items) ?? migrateLegacyCompound(STARTER_ITEMS)
  if (parsed?.version === 2) {
    const migratedV2 = migrateVersion2Compound(parsed)
    const upgradedV2 = migratedV2 && upgradePersonalMap(migratedV2)
    if (upgradedV2) { try { store?.setItem(COMPOUND_STORAGE_KEY, JSON.stringify(upgradedV2)) } catch { /* Keep migrated data available if storage is read-only. */ } }
    if (upgradedV2) return upgradedV2
  }
  const normalized = normalizeCompound(parsed)
  if (normalized) {
    const upgraded = upgradePersonalMap(normalized)
    if (upgraded !== normalized) { try { store?.setItem(COMPOUND_STORAGE_KEY, JSON.stringify(upgraded)) } catch { /* Keep the migrated compound usable if storage is read-only. */ } }
    return upgraded
  }

  const parsedLegacy = read(LEGACY_COMPOUND_STORAGE_KEY)
  if (Array.isArray(parsedLegacy)) return persistMigration(store, parsedLegacy) ?? migrateLegacyCompound(STARTER_ITEMS)
  if (parsedLegacy?.version === 1 && Array.isArray(parsedLegacy.items)) return persistMigration(store, parsedLegacy.items) ?? migrateLegacyCompound(STARTER_ITEMS)
  if (parsedLegacy?.version === 2) {
    const migratedV2 = migrateVersion2Compound(parsedLegacy)
    const upgradedV2 = migratedV2 && upgradePersonalMap(migratedV2)
    if (upgradedV2) { try { store?.setItem(COMPOUND_STORAGE_KEY, JSON.stringify(upgradedV2)) } catch { /* Keep migrated data available if storage is read-only. */ } }
    if (upgradedV2) return upgradedV2
  }
  return migrateLegacyCompound(STARTER_ITEMS)
}

export function saveCompound(compoundOrItems, storage) {
  const store = storage ?? globalThis.localStorage
  const compound = Array.isArray(compoundOrItems) ? createCompoundData(compoundOrItems) : normalizeCompound(compoundOrItems)
  if (!compound || !normalizeCompound(compound)) throw new TypeError('Cannot save an invalid compound.')
  store.setItem(COMPOUND_STORAGE_KEY, JSON.stringify(compound))
  return compound
}

export function loadSavedItems(storage) {
  return editorItemsFromCompound(loadCompound(storage))
}

export function spentBudget(items) {
  return items.reduce((total, item) => total + (item.free ? 0 : item.type === 'room' ? ROOM_COST : item.price ?? TRAP_COST), 0)
}

export function calculateBuildBudget(items, passageList = null) {
  const map = createBaseMap(items.filter((item) => item.type === 'room'))
  if (passageList) map.passages = passageList
  const activeTiles = new Set()
  for (const area of [...map.passages, ...map.rooms]) {
    const width = area.width ?? area.w
    const height = area.height ?? area.h
    for (let y = area.y; y < area.y + height; y += 1) for (let x = area.x; x < area.x + width; x += 1) activeTiles.add(`${x}:${y}`)
  }
  const paidRoomCosts = items.filter((item) => item.type === 'room' && !item.free).length * ROOM_COST
  const basePassageTiles = map.passages.filter((passage) => ['main-cross-passage', 'upper-gallery', 'entrance-passage'].includes(passage.id)).reduce((total, passage) => total + passage.width * passage.height, 0)
  const legacyBasePassageTiles = LEGACY_MAP_COLS * 2 + 2
  return BUILD_BUDGET + paidRoomCosts + Math.max(0, activeTiles.size - Math.max(0, basePassageTiles - legacyBasePassageTiles)) * AREA_BUDGET_BONUS
}

export function placePassageTile(passages, x, y, map = null) {
  const { width, height } = mapDimensions(map)
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return { error: 'bounds' }
  if (passages.some((passage) => x >= passage.x && x < passage.x + passage.width && y >= passage.y && y < passage.y + passage.height)) return { error: 'occupied' }
  const passage = { id: `passage-${x}-${y}`, x, y, width: 1, height: 1 }
  return { passages: [...passages, passage], passage }
}

export function removePassageTile(passages, x, y) {
  const passage = passages.find((item) => x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height)
  if (!passage) return { error: 'missing' }
  if (!passage.id?.startsWith('passage-')) return { error: 'protected' }
  return { passages: passages.filter((item) => item.id !== passage.id), passage }
}

export function placeRoom(items, x, y, id, map = null) {
  const { width, height } = mapDimensions(map)
  const entrance = map?.entrances?.[0] ?? { x: Math.floor(width / 2) - 3, y: height - 1 }
  const crossY = map?.passages?.find((passage) => passage.x === 0 && passage.width === width)?.y ?? height - 6
  const w = 2
  const h = 2
  const blocksRoute = (y <= crossY && y + h > crossY) || (x <= entrance.x && x + w > entrance.x && y + h > crossY + 1)
  if (x + w > width || y + h > height || blocksRoute || items.some((item) => overlaps(item, x, y, w, h))) return { error: 'blocked' }
  const item = { id, type: 'room', x, y, w, h, label: 'חדר חדש' }
  const nextItems = [...items, item]
  return canReachEntrance(nextItems, map) ? { items: nextItems, item } : { error: 'route' }
}

export function placeTrap(items, x, y, id, trapType = DEFAULT_TRAP_TYPE, map = null) {
  const { height } = mapDimensions(map)
  const entrancePoint = map?.entrances?.[0] ?? { x: Math.floor(MAP_COLS / 2) - 3, y: height - 1 }
  const entrance = x === entrancePoint.x && y === entrancePoint.y
  if (entrance || items.some((item) => overlaps(item, x, y, 1, 1))) return { error: 'blocked' }
  if (!TRAP_TYPES[trapType]) return { error: 'invalid-type' }
  const item = { id, type: 'trap', x, y, w: 1, h: 1, ...createTrapData(trapType), visibility: 'visible' }
  const nextItems = [...items, item]
  return canReachEntrance(nextItems, map) ? { items: nextItems, item } : { error: 'route' }
}

export function moveItem(items, id, x, y, map = null) {
  const { width, height } = mapDimensions(map)
  const entrance = map?.entrances?.[0] ?? { x: Math.floor(width / 2) - 3, y: height - 1 }
  const crossY = map?.passages?.find((passage) => passage.x === 0 && passage.width === width)?.y ?? height - 6
  const moving = items.find((item) => item.id === id)
  if (!moving) return { error: 'missing' }
  const blocksRoute = moving.type === 'room' && ((y <= crossY && y + moving.h > crossY) || (x <= entrance.x && x + moving.w > entrance.x && y + moving.h > crossY + 1))
  const blocksEntrance = x <= entrance.x && x + moving.w > entrance.x && y <= height - 1 && y + moving.h > height - 1
  const blocked = x < 0 || y < 0 || x + moving.w > width || y + moving.h > height || blocksRoute || blocksEntrance || items.some((item) => item.id !== id && overlaps(item, x, y, moving.w, moving.h))
  if (blocked) return { error: 'blocked' }
  const nextItems = items.map((item) => item.id === id ? { ...item, x, y } : item)
  return canReachEntrance(nextItems, map) ? { items: nextItems } : { error: 'route' }
}

export function removeItem(items, id) {
  return items.filter((item) => item.id !== id)
}

export function toggleTrapVisibility(items, id) {
  return items.map((item) => item.id === id && item.type === 'trap'
    ? { ...item, visibility: item.visibility === 'hidden' ? 'visible' : 'hidden' }
    : item)
}

export function changeTrapType(items, id, trapType) {
  if (!TRAP_TYPES[trapType]) return items
  const defaults = createTrapData(trapType)
  return items.map((item) => {
    if (item.id !== id || item.type !== 'trap') return item
    const changedItem = { ...item, ...defaults }
    delete changedItem.legacyPrice
    return changedItem
  })
}

export function updateTrapSettings(items, id, patch) {
  return items.map((item) => {
    if (item.id !== id || item.type !== 'trap') return item
    const currentItem = patch.effect ? { ...item } : item
    if (patch.effect) delete currentItem.legacyPrice
    return normalizeTrapData({
      ...currentItem,
      ...patch,
      effect: patch.effect ? { ...currentItem.effect, ...patch.effect } : currentItem.effect,
      activation: patch.activation ? { ...currentItem.activation, ...patch.activation } : currentItem.activation,
    })
  })
}
