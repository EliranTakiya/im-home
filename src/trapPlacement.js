import { findShortestPath, isWalkableTile } from './navigation.js'
import { createTrapData, TRAP_TYPES } from './traps.js'
import { calculateBuildBudget, editorItemsFromCompound, spentBudget } from './compound.js'

const samePoint = (a, b) => a?.x === b?.x && a?.y === b?.y

export function createVisitTrapPlacement(compound, visit, { x, y, trapType = 'electric', id } = {}) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !TRAP_TYPES[trapType]) return { ok: false, error: 'invalid-placement' }
  const point = { x, y }
  if (samePoint(point, visit?.guest?.position) || samePoint(point, visit?.entrance) || samePoint(point, visit?.target)) return { ok: false, error: 'reserved-tile' }
  if (!isWalkableTile(compound, point, visit) || compound.items.some((item) => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h)) return { ok: false, error: 'occupied-tile' }

  const trap = { id: id ?? `visit-trap-${visit.id}-${visit.guardian?.trapsPlaced ?? visit.runtimeTrapsPlaced ?? 0}`, type: 'trap', x, y, w: 1, h: 1, ...createTrapData(trapType), visibility: 'visible' }
  if (trapType === 'floor') trap.effect = { kind: 'delay', stopTurns: 1 }
  const allItems = editorItemsFromCompound(compound)
  if (spentBudget(allItems) + trap.price > calculateBuildBudget(allItems, compound.map.passages)) return { ok: false, error: 'insufficient-budget' }
  const nextCompound = { ...compound, items: [...compound.items, trap] }
  const nextVisit = { ...visit, trapStates: { ...visit.trapStates, [trap.id]: { triggered: false, ignored: false, lockedTurnsRemaining: 0, requiresKey: false, gasTurnsRemaining: 0 } } }
  const destination = visit.stage === 'outbound' ? visit.target : visit.entrance
  const currentLeg = findShortestPath(nextCompound, visit.guest.position, destination, nextVisit)
  const returnLeg = visit.stage === 'outbound' ? findShortestPath(nextCompound, visit.target, visit.entrance, nextVisit) : currentLeg
  if (!currentLeg.length || !returnLeg.length) return { ok: false, error: 'route-blocked' }
  return { ok: true, compound: nextCompound, visit: nextVisit, trap }
}

export function legalVisitTrapTiles(compound, visit) {
  const path = findShortestPath(compound, visit.guest.position, visit.stage === 'outbound' ? visit.target : visit.entrance, visit)
  return path.slice(1).filter((point) => !samePoint(point, visit.target) && !samePoint(point, visit.entrance) && !compound.items.some((item) => point.x >= item.x && point.x < item.x + item.w && point.y >= item.y && point.y < item.y + item.h))
}
