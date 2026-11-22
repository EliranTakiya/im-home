import { DEVELOPMENT_MODE } from './gameConfig.js'

export const PERK_DATA_VERSION = 1
export const PERK_STORAGE_KEY = 'im-home-perks-v1'
export const PERK_ROLES = Object.freeze(['owner', 'guest'])
export const PERK_GRANT_SOURCES = Object.freeze(['achievement', 'challenge', 'reward'])
export const HOST_PERK_CONFIG = Object.freeze({ energyPerVisit: 50 })

export const PERK_CATALOG = Object.freeze([
  Object.freeze({
    id: 'trap-map',
    role: 'owner',
    category: 'defense',
    name: 'מפת המלכודות',
    description: 'מציגה לבעל המתחם בלבד את מיקומן של המלכודות הנסתרות למשך הביקור.',
    effect: 'reveal-hidden-traps',
    effectConfig: { duration: 'visit' },
    status: 'implemented',
    unlocked: false,
    enabled: true,
    unlockRequirement: 'השלמת אתגר הגנתי או הישג בעל הבית',
    unlockDescription: 'ייפתח בהמשך דרך הישגים במסלול בעל הבית.',
    usageLimit: { perVisit: 1 },
    cooldown: 0,
    maxActivationsPerVisit: 1,
    limitKinds: ['permanent', 'visits', 'activations'],
  }),
  Object.freeze({
    id: 'trap-reinforcement', role: 'owner', category: 'defense', name: 'Trap Reinforcement',
    description: 'מחזק מלכודת אחת ב־25% במהלך הביקור, בלי לעבור את תקרת הנזק של המלכודת.',
    effect: 'reinforce-trap', effectConfig: { multiplier: 1.25, maxActivationsPerVisit: 1 },
    status: 'implemented', unlocked: false, enabled: true,
    unlockRequirement: 'ניסיון והצלחות במסלול בעל הבית', unlockDescription: 'ייפתח דרך ניסיון והצלחות במסלול בעל הבית.',
    usageLimit: { perVisit: 1 }, cooldown: 0, maxActivationsPerVisit: 1, limitKinds: ['permanent', 'visits', 'activations'],
  }),
  Object.freeze({
    id: 'spectator-control', role: 'owner', category: 'offense', name: 'Spectator Control',
    description: 'עוצר את האורח לתור אחד. עד שתי הפעלות לביקור, עם השהיה של 30 שניות ועלות 25 אנרגיה.',
    effect: 'spectator-stun', effectConfig: { stunTurns: 1, energyCost: 25, energyPerVisit: HOST_PERK_CONFIG.energyPerVisit, cooldownMs: 30000 },
    status: 'implemented', unlocked: false, enabled: true,
    unlockRequirement: 'התקדמות במסלול בעל הבית', unlockDescription: 'ייפתח דרך התקדמות במסלול בעל הבית.',
    usageLimit: { perVisit: 2 }, cooldown: 30000, maxActivationsPerVisit: 2, limitKinds: ['permanent', 'visits', 'activations'],
  }),
  Object.freeze({
    id: 'extra-steps', role: 'guest', category: 'defense', name: 'Extra Steps',
    description: 'מוסיף 8 צעדים לביקור לאחר שנותרו 25% ממכסת הצעדים. הפעלה אחת לביקור.',
    effect: 'extend-step-budget', effectConfig: { amount: 8, triggerRemainingRatio: 0.25 },
    status: 'implemented', unlocked: false, enabled: true,
    unlockRequirement: 'השלמת ביקורים מוצלחים וצבירת ניסיון אישי', unlockDescription: 'ייפתח דרך ביקורים מוצלחים והתקדמות אישית.',
    usageLimit: { perVisit: 1 }, cooldown: 0, maxActivationsPerVisit: 1, limitKinds: ['permanent', 'visits', 'activations'],
  }),
  Object.freeze({
    id: 'trap-warning', role: 'guest', category: 'defense', name: 'Trap Warning',
    description: 'מתריע כאשר מלכודת שלא הופעלה נמצאת עד שתי משבצות מהאורח, בלי לחשוף את מיקומה.',
    effect: 'nearby-trap-warning', effectConfig: { radius: 2, duration: 'visit' },
    status: 'implemented', unlocked: false, enabled: true,
    unlockRequirement: 'התקדמות אישית והשלמת אתגרים', unlockDescription: 'ייפתח דרך התקדמות אישית והשלמת אתגרים.',
    usageLimit: { perVisit: 1 }, cooldown: 0, maxActivationsPerVisit: 1, limitKinds: ['permanent', 'visits', 'activations'],
  }),
  Object.freeze({
    id: 'emergency-shield', role: 'guest', category: 'defense', name: 'Emergency Shield',
    description: 'סופג במלואה את הפגיעה הבאה ממלכודת אחת במהלך הביקור.',
    effect: 'absorb-next-trap-hit', effectConfig: { hits: 1 },
    status: 'implemented', unlocked: false, enabled: true,
    unlockRequirement: 'הישגים והשלמת ביקורים קשים', unlockDescription: 'ייפתח דרך הישגים וביקורים קשים.',
    usageLimit: { perVisit: 1 }, cooldown: 0, maxActivationsPerVisit: 1, limitKinds: ['permanent', 'visits', 'activations'],
  }),
])

const clone = (value) => structuredClone(value)
const validRole = (role) => PERK_ROLES.includes(role)
const profileKey = (role, profileId) => `${role}:${profileId}`

export function createPerkStore() {
  return { version: PERK_DATA_VERSION, profiles: {}, visitSelections: {}, grantLedger: [], activationLedger: [] }
}

function normalizePerkStore(store) {
  if (store?.version !== PERK_DATA_VERSION && store?.version !== 1 || !store.profiles || typeof store.profiles !== 'object') return createPerkStore()
  return {
    version: PERK_DATA_VERSION,
    profiles: store.profiles,
    visitSelections: store.visitSelections && typeof store.visitSelections === 'object' ? store.visitSelections : {},
    grantLedger: Array.isArray(store.grantLedger) ? store.grantLedger : [],
    activationLedger: Array.isArray(store.activationLedger) ? store.activationLedger : [],
  }
}

function ensureProfile(store, role, profileId) {
  const key = profileKey(role, profileId)
  store.profiles[key] ??= { profileId, role, inventory: {} }
  if (store.profiles[key].role !== role) throw new TypeError('Perk profile role mismatch.')
  store.profiles[key].inventory ??= {}
  return store.profiles[key]
}

function definitionFor(role, perkId) {
  const definition = PERK_CATALOG.find((perk) => perk.id === perkId)
  return definition?.role === role ? definition : null
}

function hasRemainingUse(inventory) {
  return inventory && inventory.owned === true && (inventory.remainingUses === null || inventory.remainingUses > 0)
}

export function listPerksForRole(role) {
  if (!validRole(role)) return []
  return PERK_CATALOG.filter((perk) => perk.role === role && perk.enabled)
}

export function grantPerk(currentStore, { profileId, role, perkId, source, grantId = `${source}:${role}:${profileId}:${perkId}`, limitKind = 'permanent', remainingUses = null }) {
  if (!validRole(role) || typeof profileId !== 'string' || !profileId || !definitionFor(role, perkId)) return { ok: false, error: 'role-or-perk-mismatch', store: currentStore }
  if (!PERK_GRANT_SOURCES.includes(source)) return { ok: false, error: 'unsupported-grant-source', store: currentStore }
  if (typeof grantId !== 'string' || !grantId) return { ok: false, error: 'invalid-grant-id', store: currentStore }
  const definition = definitionFor(role, perkId)
  if (definition.status !== 'implemented' || !definition.limitKinds.includes(limitKind)) return { ok: false, error: 'unsupported-perk-policy', store: currentStore }
  if (limitKind === 'permanent' ? remainingUses !== null : !Number.isInteger(remainingUses) || remainingUses < 1) return { ok: false, error: 'invalid-use-limit', store: currentStore }

  const store = clone(normalizePerkStore(currentStore))
  const previousGrant = store.grantLedger.find((entry) => entry.grantId === grantId)
  if (previousGrant) {
    if (previousGrant.role !== role || previousGrant.profileId !== profileId || previousGrant.perkId !== perkId) return { ok: false, error: 'grant-id-conflict', store: currentStore }
    return { ok: true, duplicate: true, store, inventory: store.profiles[profileKey(role, profileId)]?.inventory?.[perkId] }
  }
  const profile = ensureProfile(store, role, profileId)
  const existing = profile.inventory[perkId]
  const nextRemaining = existing?.owned && existing.limitKind === limitKind && limitKind !== 'permanent'
    ? existing.remainingUses + remainingUses
    : remainingUses
  profile.inventory[perkId] = { owned: true, source, grantedAt: new Date().toISOString(), limitKind, remainingUses: nextRemaining }
  store.grantLedger.push({ grantId, profileId, role, perkId, source, grantedAt: profile.inventory[perkId].grantedAt })
  return { ok: true, store, inventory: profile.inventory[perkId] }
}

export function validatePerkSelection(storeValue, { profileId, role, selectedIds = [], maxSelected }) {
  const store = normalizePerkStore(storeValue)
  if (!validRole(role) || typeof profileId !== 'string' || !profileId) return { ok: false, error: 'invalid-role-or-profile' }
  if (!Number.isInteger(maxSelected) || maxSelected < 0) return { ok: false, error: 'invalid-selection-limit' }
  if (!Array.isArray(selectedIds) || new Set(selectedIds).size !== selectedIds.length) return { ok: false, error: 'duplicate-selection' }
  if (selectedIds.length > maxSelected) return { ok: false, error: 'selection-limit' }
  const profile = store.profiles[profileKey(role, profileId)]
  for (const perkId of selectedIds) {
    const definition = definitionFor(role, perkId)
    if (!definition) return { ok: false, error: 'role-or-perk-mismatch' }
    if (!definition.enabled || definition.status !== 'implemented') return { ok: false, error: 'perk-not-implemented' }
    if (!DEVELOPMENT_MODE && !hasRemainingUse(profile?.inventory?.[perkId])) return { ok: false, error: 'perk-locked-or-exhausted' }
  }
  return { ok: true, selectedIds: [...selectedIds] }
}

export function saveVisitPerkSelection(currentStore, { visitId, profiles, selections, maxSelected }) {
  if (typeof visitId !== 'string' || !visitId || !selections || !profiles) return { ok: false, error: 'invalid-visit-selection', store: currentStore }
  const store = clone(normalizePerkStore(currentStore))
  const record = {}
  for (const role of PERK_ROLES) {
    const profileId = profiles[role]
    const validation = validatePerkSelection(store, { profileId, role, selectedIds: selections[role] ?? [], maxSelected })
    if (!validation.ok) return { ok: false, error: validation.error, store: currentStore }
    record[role] = { profileId, selectedIds: validation.selectedIds }
  }
  store.visitSelections[visitId] = record
  return { ok: true, store, selection: record }
}

export function createVisitPerkState(visitId, selection = {}) {
  return {
    visitId,
    selections: { owner: [...(selection.owner?.selectedIds ?? selection.owner ?? [])], guest: [...(selection.guest?.selectedIds ?? selection.guest ?? [])] },
    active: { owner: [], guest: [] },
    activations: { owner: {}, guest: {} },
    effectLedger: [],
    events: [],
  }
}

export function activatePerk(currentStore, currentVisitPerks, { visitId, profileId, role, actorRole = role, perkId, activationId }) {
  const guardianOwner = role === 'owner' && actorRole === 'guardian' && currentVisitPerks?.ownerActor === 'guardian'
  if (!validRole(role) || actorRole !== role && !guardianOwner || typeof activationId !== 'string' || !activationId) return { ok: false, error: 'role-or-activation-mismatch', store: currentStore, visitPerks: currentVisitPerks }
  const definition = definitionFor(role, perkId)
  if (!definition || !definition.enabled || definition.status !== 'implemented') return { ok: false, error: 'role-or-perk-mismatch', store: currentStore, visitPerks: currentVisitPerks }
  if (!currentVisitPerks || currentVisitPerks.visitId !== visitId || !currentVisitPerks.selections?.[role]?.includes(perkId)) return { ok: false, error: 'perk-not-selected-for-visit', store: currentStore, visitPerks: currentVisitPerks }

  const store = clone(normalizePerkStore(currentStore))
  const visitPerks = clone(currentVisitPerks)
  const ledgerEntry = store.activationLedger.find((entry) => entry.activationId === activationId)
  if (ledgerEntry) {
    if (ledgerEntry.visitId !== visitId || ledgerEntry.role !== role || ledgerEntry.perkId !== perkId || ledgerEntry.profileId !== profileId) return { ok: false, error: 'activation-id-conflict', store: currentStore, visitPerks: currentVisitPerks }
    if (!visitPerks.active[role].includes(perkId)) visitPerks.active[role].push(perkId)
    return { ok: true, duplicate: true, store, visitPerks }
  }

  const storedSelection = store.visitSelections[visitId]?.[role]
  if (!guardianOwner && (storedSelection?.profileId !== profileId || !storedSelection.selectedIds.includes(perkId))) return { ok: false, error: 'selection-not-persisted-for-profile', store: currentStore, visitPerks: currentVisitPerks }
  const profile = store.profiles[profileKey(role, profileId)]
  const inventory = profile?.inventory?.[perkId]
  const visitChargeUsed = inventory?.limitKind === 'visits' && store.activationLedger.some((entry) => entry.visitId === visitId && entry.profileId === profileId && entry.role === role && entry.perkId === perkId)
  if (!guardianOwner && !DEVELOPMENT_MODE && !hasRemainingUse(inventory) && !visitChargeUsed) return { ok: false, error: 'perk-locked-or-exhausted', store: currentStore, visitPerks: currentVisitPerks }
  if ((visitPerks.activations[role][perkId] ?? 0) >= definition.maxActivationsPerVisit) return { ok: false, error: 'visit-activation-limit', store: currentStore, visitPerks: currentVisitPerks }

  if (!guardianOwner && !DEVELOPMENT_MODE && (inventory.limitKind === 'activations' || inventory.limitKind === 'visits' && !visitChargeUsed)) inventory.remainingUses -= 1
  visitPerks.active[role].push(perkId)
  visitPerks.activations[role][perkId] = (visitPerks.activations[role][perkId] ?? 0) + 1
  const entry = { activationId, visitId, profileId, role, perkId, activatedAt: new Date().toISOString(), remainingUses: guardianOwner || DEVELOPMENT_MODE ? null : inventory.remainingUses }
  store.activationLedger.push(entry)
  visitPerks.events.push({ ...entry, type: 'perk-activated' })
  return { ok: true, duplicate: false, store, visitPerks, inventory: { ...inventory } }
}

export function isPerkActive(visitPerks, role, perkId) {
  return validRole(role) && visitPerks?.active?.[role]?.includes(perkId) === true
}

export function canRevealHiddenTraps(visit, viewerRole) {
  return viewerRole === 'owner' && visit?.outcome === 'active' && visit.perks?.selections?.owner?.includes('trap-map') === true && isPerkActive(visit.perks, 'owner', 'trap-map')
}

export function projectTrapsForViewer(traps, visit, viewerRole) {
  const canMap = canRevealHiddenTraps(visit, viewerRole)
  return traps.filter((trap) => trap.visibility !== 'hidden' || canMap || viewerRole === 'guest' && visit?.trapStates?.[trap.id]?.triggered)
}

export function loadPerkStore(storage = globalThis.localStorage) {
  try { return normalizePerkStore(JSON.parse(storage?.getItem(PERK_STORAGE_KEY) ?? 'null')) } catch { return createPerkStore() }
}

export function savePerkStore(store, storage = globalThis.localStorage) {
  try {
    const normalized = normalizePerkStore(store)
    storage?.setItem(PERK_STORAGE_KEY, JSON.stringify(normalized))
    return Boolean(storage)
  } catch { return false }
}
