import { createChallengeCompound, getChallengeHouse } from './challenges/houses.js'
import { isChallengeHouseUnlocked } from './challenges/progress.js'

export const VISIT_TYPES = Object.freeze({ CHALLENGE: 'challenge', REGULAR: 'regular', PLAYER_HOUSE: 'player-house' })

/** Resolve an explicitly selected challenge into its immutable game map target. */
export function selectChallengeVisitTarget(progress, houseId) {
  const house = getChallengeHouse(houseId)
  if (!house || !isChallengeHouseUnlocked(progress, houseId)) return null
  const compound = createChallengeCompound(houseId)
  if (!compound) return null
  return Object.freeze({ visitType: VISIT_TYPES.CHALLENGE, mapSource: 'challenge-catalog', houseId: house.id, compound })
}

/** Regular/player-house visits must come from an explicit remote player target. */
export function selectPlayerHouseVisitTarget(house) {
  if (!house || typeof house.id !== 'string' || !house.id || house.mapSource !== 'player-house') return null
  if (!house.compound || house.compound.version !== 3) return null
  return Object.freeze({ visitType: VISIT_TYPES.PLAYER_HOUSE, mapSource: 'player-house', houseId: house.id, compound: structuredClone(house.compound) })
}

