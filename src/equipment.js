export const EQUIPMENT_STORAGE_KEY = 'im-home-guest-equipment-v1'
export const EQUIPMENT_VERSION = 1
export const DEFAULT_BACKPACK_CAPACITY = 6

// Effects are intentionally data driven so new equipment can be registered without
// changing the visit model. Existing compound trap ids are the only compatibility keys.
export const EQUIPMENT_CATALOG = {
  'insulated-gloves': {
    id: 'insulated-gloves', name: 'כפפות מבודדות', type: 'protection',
    description: 'מפחיתות נזק ממלכודת חשמלית. שדרוג פותח גם סריקה של מלכודות חשמליות סמוכות.',
    compatibleTrapTypes: ['electric'], space: 2, usesPerVisit: 1,
    upgradeLevel: 0, maxUpgradeLevel: 3,
    impact: { kind: 'reduce-next-damage', amount: 5 },
    detection: { minUpgradeLevel: 1, radius: 1 },
  },
  'gas-mask': {
    id: 'gas-mask', name: 'מסכת גז', type: 'protection',
    description: 'מפחיתה נזק בכל תור של אירוע גז. שדרוג פותח סריקת אזורי גז סמוכים.',
    compatibleTrapTypes: ['gas'], space: 3, usesPerVisit: 2,
    upgradeLevel: 0, maxUpgradeLevel: 3,
    impact: { kind: 'reduce-damage-per-turn', amount: 5 },
    detection: { minUpgradeLevel: 1, radius: 1 },
  },
  'floor-kit': {
    id: 'floor-kit', name: 'ערכת רצפה', type: 'utility',
    description: 'מזהה רצפה נופלת סמוכה. שימוש בהפעלה מונע חזרה לכניסה, אך עדיין עוצר את האורח.',
    compatibleTrapTypes: ['floor'], space: 2, usesPerVisit: 1,
    upgradeLevel: 0, maxUpgradeLevel: 3,
    impact: { kind: 'prevent-restart' },
    detection: { minUpgradeLevel: 0, radius: 1 },
  },
  'door-kit': {
    id: 'door-kit', name: 'ערכת דלתות', type: 'utility',
    description: 'מזהה את מצב הדלת. מקצרת נעילה מתוזמנת, אך אינה פותחת דלת שדורשת מפתח.',
    compatibleTrapTypes: ['door'], space: 2, usesPerVisit: 1,
    upgradeLevel: 0, maxUpgradeLevel: 3,
    impact: { kind: 'shorten-timed-lock', turns: 1 },
    detection: { minUpgradeLevel: 0, radius: 1 },
  },
}

export function createEquipmentStore() {
  return {
    version: EQUIPMENT_VERSION,
    backpackCapacity: DEFAULT_BACKPACK_CAPACITY,
    upgrades: {},
    selectedToolIds: [],
  }
}

export function normalizeEquipmentStore(value) {
  const base = createEquipmentStore()
  if (!value || typeof value !== 'object') return base
  const upgrades = {}
  for (const [id, level] of Object.entries(value.upgrades ?? {})) {
    if (EQUIPMENT_CATALOG[id]) upgrades[id] = Math.max(0, Math.min(EQUIPMENT_CATALOG[id].maxUpgradeLevel, Math.floor(Number(level) || 0)))
  }
  return {
    ...base,
    backpackCapacity: Math.max(0, Math.floor(Number(value.backpackCapacity) || DEFAULT_BACKPACK_CAPACITY)),
    upgrades,
    selectedToolIds: [...new Set((Array.isArray(value.selectedToolIds) ? value.selectedToolIds : []).filter((id) => EQUIPMENT_CATALOG[id]))],
  }
}

export function loadEquipmentStore(storage = globalThis.localStorage) {
  try { return normalizeEquipmentStore(JSON.parse(storage?.getItem(EQUIPMENT_STORAGE_KEY) ?? 'null')) } catch { return createEquipmentStore() }
}

export function saveEquipmentStore(store, storage = globalThis.localStorage) {
  try { storage?.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(normalizeEquipmentStore(store))); return Boolean(storage) } catch { return false }
}

export function getToolSpace(toolId) { return EQUIPMENT_CATALOG[toolId]?.space ?? Infinity }

export function validateToolSelection(store, selectedToolIds) {
  const normalized = normalizeEquipmentStore(store)
  const ids = [...new Set(selectedToolIds ?? [])]
  if (ids.some((id) => !EQUIPMENT_CATALOG[id])) return { ok: false, error: 'unknown-tool' }
  const usedSpace = ids.reduce((sum, id) => sum + getToolSpace(id), 0)
  if (usedSpace > normalized.backpackCapacity) return { ok: false, error: 'capacity', usedSpace, capacity: normalized.backpackCapacity }
  return { ok: true, selectedToolIds: ids, usedSpace, capacity: normalized.backpackCapacity }
}

export function selectTools(store, selectedToolIds) {
  const validation = validateToolSelection(store, selectedToolIds)
  if (!validation.ok) return validation
  return { ok: true, store: { ...normalizeEquipmentStore(store), selectedToolIds: validation.selectedToolIds } }
}

export function createVisitEquipment(store, selectedToolIds = normalizeEquipmentStore(store).selectedToolIds) {
  const normalized = normalizeEquipmentStore(store)
  const validation = validateToolSelection(normalized, selectedToolIds)
  if (!validation.ok) throw new TypeError(validation.error)
  return {
    selectedToolIds: validation.selectedToolIds,
    tools: Object.fromEntries(validation.selectedToolIds.map((id) => {
      const definition = EQUIPMENT_CATALOG[id]
      const level = normalized.upgrades[id] ?? definition.upgradeLevel
      const impact = structuredClone(definition.impact)
      if (typeof impact.amount === 'number') impact.amount += level * 5
      if (typeof impact.turns === 'number') impact.turns += level
      return [id, { id, upgradeLevel: level, usesRemaining: definition.usesPerVisit + level, impact, uses: [] }]
    })),
  }
}

export function consumeToolUse(equipment, toolId, trapType, actionId) {
  const tool = equipment?.tools?.[toolId]
  const definition = EQUIPMENT_CATALOG[toolId]
  if (!tool || !definition || !definition.compatibleTrapTypes.includes(trapType)) return { ok: false, error: 'incompatible-tool' }
  if (tool.uses.some((use) => use.actionId === actionId)) return { ok: false, error: 'already-used' }
  if (!Number.isInteger(tool.usesRemaining) || tool.usesRemaining <= 0) return { ok: false, error: 'no-uses' }
  tool.usesRemaining -= 1
  tool.uses.push({ actionId, trapType })
  return { ok: true, tool }
}

export function availableToolsForTrap(equipment, trapType) {
  return Object.values(equipment?.tools ?? {}).filter((tool) =>
    EQUIPMENT_CATALOG[tool.id]?.compatibleTrapTypes.includes(trapType) && tool.usesRemaining > 0,
  )
}

export function toolsForTrapEncounter(equipment, trap) {
  if (trap.trapType === 'door' && trap.effect?.openMode === 'key') return []
  if (trap.trapType === 'floor' && trap.effect?.kind !== 'restart') return []
  return availableToolsForTrap(equipment, trap.trapType)
}

export function equipmentDetectsTrap(equipment, trap, position) {
  const distance = (point) => Math.max(Math.abs(point.x - trap.x), Math.abs(point.y - trap.y))
  return Object.values(equipment?.tools ?? {}).some((tool) => {
    const definition = EQUIPMENT_CATALOG[tool.id]
    if (!definition?.compatibleTrapTypes.includes(trap.trapType) || tool.upgradeLevel < definition.detection.minUpgradeLevel) return false
    const radius = definition.detection.radius + Math.max(0, tool.upgradeLevel - definition.detection.minUpgradeLevel)
    return position && distance(position) <= radius
  })
}
