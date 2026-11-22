import { getChallengeHouse } from './challenges/houses.js'
import { createVisit } from './visitEngine.js'
import { createGuardianState, GUARDIAN_DIFFICULTIES } from './guardianAI.js'

export function createChallengeVisit(target, { id, difficulty, perkSelection = {}, equipment = null } = {}) {
  const house = getChallengeHouse(target?.houseId)
  if (!house || target?.visitType !== 'challenge' || target.mapSource !== 'challenge-catalog' || !target.compound || !GUARDIAN_DIFFICULTIES[difficulty]) return null
  const visit = createVisit(target.compound, {
    id,
    visitType: 'challenge',
    mapSource: 'challenge-catalog',
    houseId: house.id,
    ownerMode: 'ai',
    perkSelection,
    equipment,
  })
  visit.guardian = createGuardianState(visit.id, difficulty)
  return visit
}
