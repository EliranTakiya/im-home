const TURN_OPTIONS = [1, 2, 3, 4, 5].map((turns) => ({ value: turns, label: `${turns} ${turns === 1 ? 'תור' : 'תורות'}` }))

export const TRAP_TYPES = {
  electric: {
    id: 'electric', name: 'מלכודת חשמלית', glyph: 'ϟ', price: 120,
    description: 'פוגעת באורח בעת דריכה ויכולה לעצור אותו.',
    defaultEffect: { kind: 'damage', strength: 1, durationTurns: 1 },
    strengthOptions: [{ value: 1, label: 'נמוכה' }, { value: 2, label: 'בינונית' }, { value: 3, label: 'גבוהה' }],
    durationOptions: TURN_OPTIONS,
    activationOptions: [{ value: 'step', label: 'בעת דריכה' }, { value: 'manual', label: 'בהפעלה ידנית' }],
    defaultActivation: 'step',
  },
  floor: {
    id: 'floor', name: 'רצפה נופלת', glyph: '⌄', price: 130,
    description: 'גורמת לאורח ליפול, להתעכב או לחזור לנקודת ההתחלה.',
    defaultEffect: { kind: 'restart', stopTurns: 1 },
    effectOptions: [{ value: 'fall', label: 'נפילה ועצירה' }, { value: 'delay', label: 'עיכוב' }, { value: 'restart', label: 'אובדן התקדמות וחזרה להתחלה' }],
    activationOptions: [{ value: 'step', label: 'בעת דריכה' }, { value: 'manual', label: 'בהפעלה ידנית' }],
    defaultActivation: 'step',
  },
  gas: {
    id: 'gas', name: 'מלכודת גז', glyph: '◌', price: 150,
    description: 'יוצרת אזור מסוכן בעל רדיוס ומשך השפעה מוגדרים.',
    defaultEffect: { kind: 'hazard-zone', radius: 1, strength: 1, durationTurns: 1 },
    radiusOptions: [1, 2, 3],
    strengthOptions: [{ value: 1, label: 'נמוכה' }, { value: 2, label: 'בינונית' }, { value: 3, label: 'גבוהה' }],
    durationOptions: TURN_OPTIONS,
    activationOptions: [{ value: 'area-entry', label: 'בעת כניסה לאזור' }, { value: 'manual', label: 'בהפעלה ידנית' }],
    defaultActivation: 'area-entry',
  },
  door: {
    id: 'door', name: 'דלת ננעלת', glyph: '▣', price: 110,
    description: 'חוסמת מעבר, והאורח יידרש לחפש דרך אחרת.',
    defaultEffect: { kind: 'block-and-reroute', lockDuration: 1, openMode: 'automatic' },
    durationOptions: TURN_OPTIONS,
    openModeOptions: [{ value: 'automatic', label: 'פתיחה אוטומטית' }, { value: 'key', label: 'נדרש מפתח' }],
    activationOptions: [{ value: 'passage-attempt', label: 'בעת ניסיון מעבר' }, { value: 'manual', label: 'בהפעלה ידנית' }],
    defaultActivation: 'passage-attempt',
  },
}

export const DEFAULT_TRAP_TYPE = 'electric'
export const TRAP_TYPE_LIST = Object.values(TRAP_TYPES)

export function calculateTrapPrice(trap) {
  const definition = TRAP_TYPES[trap.trapType] ?? TRAP_TYPES[DEFAULT_TRAP_TYPE]
  const effect = trap.effect ?? definition.defaultEffect
  if (trap.trapType === 'electric') return definition.price + Math.max(0, (effect.strength ?? 1) - 1) * 25 + Math.max(0, (effect.durationTurns ?? 1) - 1) * 15
  if (trap.trapType === 'floor') return definition.price
  if (trap.trapType === 'gas') return definition.price + Math.max(0, (effect.radius ?? 1) - 1) * 25 + Math.max(0, (effect.strength ?? 1) - 1) * 25 + Math.max(0, (effect.durationTurns ?? 1) - 1) * 15
  if (trap.trapType === 'door') return definition.price + (effect.openMode === 'key' ? 30 : Math.max(0, (effect.lockDuration ?? 1) - 1) * 15)
  return definition.price
}

export function createTrapData(trapType = DEFAULT_TRAP_TYPE) {
  const definition = TRAP_TYPES[trapType] ?? TRAP_TYPES[DEFAULT_TRAP_TYPE]
  const trap = {
    trapType: definition.id,
    name: definition.name,
    description: definition.description,
    effect: { ...definition.defaultEffect },
    activation: { event: definition.defaultActivation },
  }
  return { ...trap, price: calculateTrapPrice(trap) }
}

export function normalizeTrapData(trap) {
  const type = TRAP_TYPES[trap.trapType] ? trap.trapType : DEFAULT_TRAP_TYPE
  const defaults = createTrapData(type)
  const definition = TRAP_TYPES[type]
  const activationEvent = definition.activationOptions.some((option) => option.value === trap.activation?.event)
    ? trap.activation.event
    : defaults.activation.event
  let effect = { ...defaults.effect }

  if (type === 'electric') {
    const strengths = definition.strengthOptions.map((option) => option.value)
    const durations = definition.durationOptions.map((option) => option.value)
    effect = {
      kind: 'damage',
      strength: strengths.includes(trap.effect?.strength) ? trap.effect.strength : defaults.effect.strength,
      durationTurns: durations.includes(trap.effect?.durationTurns) ? trap.effect.durationTurns : defaults.effect.durationTurns,
    }
  } else if (type === 'floor' && definition.effectOptions.some((option) => option.value === trap.effect?.kind)) {
    effect = { kind: trap.effect.kind, stopTurns: 1 }
  } else if (type === 'gas') {
    const durations = definition.durationOptions.map((option) => option.value)
    const strengths = definition.strengthOptions.map((option) => option.value)
    effect = {
      kind: 'hazard-zone',
      radius: definition.radiusOptions.includes(trap.effect?.radius) ? trap.effect.radius : defaults.effect.radius,
      strength: strengths.includes(trap.effect?.strength) ? trap.effect.strength : defaults.effect.strength,
      durationTurns: durations.includes(trap.effect?.durationTurns) ? trap.effect.durationTurns : defaults.effect.durationTurns,
    }
  } else if (type === 'door') {
    const durations = definition.durationOptions.map((option) => option.value)
    effect = {
      kind: 'block-and-reroute',
      lockDuration: durations.includes(trap.effect?.lockDuration) ? trap.effect.lockDuration : defaults.effect.lockDuration,
      openMode: definition.openModeOptions.some((option) => option.value === trap.effect?.openMode) ? trap.effect.openMode : defaults.effect.openMode,
    }
  }

  const normalized = {
    ...trap,
    ...defaults,
    name: typeof trap.name === 'string' ? trap.name : defaults.name,
    description: typeof trap.description === 'string' ? trap.description : defaults.description,
    visibility: trap.visibility === 'hidden' ? 'hidden' : 'visible',
    effect,
    activation: { event: activationEvent },
  }
  const legacyPrice = normalized.legacyPrice === true && Number.isFinite(trap.price)
  return { ...normalized, price: legacyPrice ? trap.price : calculateTrapPrice(normalized) }
}
