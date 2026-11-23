export function hostPerkAvailability(visit, perk, now = Date.now()) {
  if (!visit || perk?.role !== 'owner') return { ok: false, reason: 'role' }
  const activations = visit.perks?.activations?.owner?.[perk.id] ?? 0
  if (activations >= (perk.maxActivationsPerVisit ?? 1)) return { ok: false, reason: 'usage-limit' }
  if (perk.effect === 'spectator-stun') {
    const energy = visit.spectator?.energy ?? perk.effectConfig.energyPerVisit
    if (energy < perk.effectConfig.energyCost) return { ok: false, reason: 'energy' }
    const cooldownUntil = visit.spectator?.cooldowns?.[perk.id] ?? 0
    if (cooldownUntil > now) return { ok: false, reason: 'cooldown', remainingMs: cooldownUntil - now }
    if ((visit.guest?.stunTurnsRemaining ?? 0) > 0) return { ok: false, reason: 'guest-already-stunned' }
    if (visit.spectator?.blockedMovePending) return { ok: false, reason: 'guest-already-stunned' }
  }
  return { ok: true }
}

export function hasNearbyTrapWarning(compound, visit, radius = 2) {
  if (!visit?.perks?.active?.guest?.includes('trap-warning')) return false
  return compound.items.some((trap) => trap.type === 'trap' && !visit.trapStates?.[trap.id]?.triggered && Math.max(Math.abs(trap.x - visit.guest.position.x), Math.abs(trap.y - visit.guest.position.y)) <= radius)
}

export function applySelectedPerkEffect(currentVisit, perk, { trapId = null, activationId, now = Date.now() } = {}) {
  if (!currentVisit || !perk || !activationId) return { ok: false, error: 'invalid-effect-context' }
  const guardianOwner = perk.role === 'owner' && currentVisit.visitType === 'challenge' && currentVisit.ownerMode === 'ai' && currentVisit.perks?.ownerActor === 'guardian'
  const humanOwner = perk.role === 'owner' && currentVisit.visitType === 'regular' && currentVisit.ownerMode === 'human'
  if (perk.role === 'owner' && !guardianOwner && !humanOwner || perk.role === 'guest' && currentVisit.visitType === 'challenge' && currentVisit.ownerMode === 'ai' && currentVisit.perks?.ownerActor !== 'guardian') return { ok: false, error: 'unauthorized-actor' }
  if (currentVisit.perks?.effectLedger?.includes(activationId)) return { ok: false, duplicate: true, visit: currentVisit }
  const visit = structuredClone(currentVisit)
  visit.perks.effectLedger ??= []
  visit.spectator ??= { energy: perk.effectConfig?.energyPerVisit ?? 50, maxEnergy: perk.effectConfig?.energyPerVisit ?? 50, cooldowns: {} }
  visit.spectator.cooldowns ??= {}
  const log = (message, details = {}) => visit.events.push({ turn: visit.guest.turns, type: 'perk', message, perkId: perk.id, ...details })

  if (perk.effect === 'extend-step-budget') {
    const remaining = Math.max(0, visit.stepBudget - visit.guest.stepsTaken)
    if (remaining > Math.ceil(visit.stepBudget * perk.effectConfig.triggerRemainingRatio)) return { ok: false, error: 'not-ready' }
    visit.stepBudget += perk.effectConfig.amount
    log(`${perk.name} הוסיף ${perk.effectConfig.amount} צעדים למכסה.`)
  } else if (perk.effect === 'reinforce-trap') {
    const trap = visit.trapStates[trapId]
    if (!trap || trap.triggered || trap.reinforcementMultiplier) return { ok: false, error: 'trap-unavailable' }
    trap.reinforcementMultiplier = perk.effectConfig.multiplier
    log(`${perk.name} חיזק מלכודת ב־${Math.round((perk.effectConfig.multiplier - 1) * 100)}%.`, { trapId })
  } else if (perk.effect === 'spectator-stun') {
    if (visit.spectator.energy < perk.effectConfig.energyCost) return { ok: false, error: 'energy' }
    if ((visit.spectator.cooldowns[perk.id] ?? 0) > now) return { ok: false, error: 'cooldown' }
    if ((visit.guest.stunTurnsRemaining ?? 0) > 0) return { ok: false, error: 'guest-already-stunned' }
    visit.spectator.energy -= perk.effectConfig.energyCost
    visit.spectator.cooldowns[perk.id] = now + perk.effectConfig.cooldownMs
    visit.spectator.blockedMovePending = true
    log(`${perk.name} עצר את האורח לתור אחד.`, { energySpent: perk.effectConfig.energyCost })
  } else if (perk.effect === 'absorb-next-trap-hit') {
    log(`${perk.name} מוכן לספוג את הפגיעה הבאה.`)
  } else if (perk.effect === 'nearby-trap-warning') {
    log(`${perk.name} הופעל; התרעה תוצג בקרבת מלכודת.`)
  }
  visit.perks.effectLedger.push(activationId)
  return { ok: true, visit }
}
