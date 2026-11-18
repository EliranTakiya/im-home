import { MAP_COLS, MAP_ROWS } from './compound.js'

export const VISIT_STEP_MULTIPLIER = 1.5
export const ROUTE_SAMPLE_LIMIT = 2000
const DIRECTIONS = [{ x: 0, y: -1, facing: 'north' }, { x: 1, y: 0, facing: 'east' }, { x: 0, y: 1, facing: 'south' }, { x: -1, y: 0, facing: 'west' }]
const directionIndex = (direction) => DIRECTIONS.findIndex((entry) => entry.facing === direction)
const pointKey = ({ x, y }) => `${x}:${y}`

function entranceOf(compound) { return compound.map.entrances[0] ?? compound.map.exits[0] ?? { x: 5, y: MAP_ROWS - 1 } }
function exitOf(compound) { return compound.map.exits[0] ?? entranceOf(compound) }

function explicitWall(compound, point) {
  return (compound.map.walls ?? []).some((wall) => point.x >= wall.x && point.x < wall.x + (wall.w ?? wall.width ?? 1) && point.y >= wall.y && point.y < wall.y + (wall.h ?? wall.height ?? 1))
}

export function isWalkableTile(compound, point, visit = null) {
  if (!point || point.x < 0 || point.x >= (compound.map.width ?? MAP_COLS) || point.y < 0 || point.y >= (compound.map.height ?? MAP_ROWS)) return false
  if (explicitWall(compound, point)) return false
  const inRoom = (compound.map.rooms ?? []).some((room) => point.x >= room.x && point.x < room.x + room.w && point.y >= room.y && point.y < room.y + room.h)
  const inPassage = (compound.map.passages ?? []).some((passage) => point.x >= passage.x && point.x < passage.x + passage.width && point.y >= passage.y && point.y < passage.y + passage.height)
  const accessPoint = [...(compound.map.entrances ?? []), ...(compound.map.exits ?? [])].some((access) => access.x === point.x && access.y === point.y)
  if (!inRoom && !inPassage && !accessPoint) return false
  const door = compound.items.find((item) => item.type === 'trap' && item.trapType === 'door' && item.x === point.x && item.y === point.y)
  if (!door) return true
  const state = visit?.trapStates?.[door.id]
  if (state?.requiresKey || (state?.lockedTurnsRemaining ?? 0) > 0) return false
  return true
}

export function walkableNeighbors(compound, point, visit = null) {
  return DIRECTIONS.map(({ x, y }) => ({ x: point.x + x, y: point.y + y }))
    .filter((next) => isWalkableTile(compound, next, visit))
}

export function directionFacing(facing = 'north', command = 'forward') {
  const index = directionIndex(facing)
  if (index < 0) return null
  const offset = { forward: 0, right: 1, backward: 2, left: 3 }[command]
  if (offset === undefined) return null
  return DIRECTIONS[(index + offset) % DIRECTIONS.length]
}

export function facingRotationDegrees(facing = 'north') {
  const index = directionIndex(facing)
  return index < 0 ? null : index * 90
}

export function stepTarget(position, facing, command) {
  const direction = directionFacing(facing, command)
  if (!direction) return null
  const nextFacing = command === 'right' || command === 'left' ? direction.facing : facing
  return { position: { x: position.x + direction.x, y: position.y + direction.y }, facing: nextFacing }
}

export function findShortestPath(compound, start, goal, visit = null) {
  if (!isWalkableTile(compound, start, visit) || !isWalkableTile(compound, goal, visit)) return []
  const queue = [start]
  const previous = new Map([[pointKey(start), null]])
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index]
    if (pointKey(point) === pointKey(goal)) break
    for (const next of walkableNeighbors(compound, point, visit)) {
      const nextKey = pointKey(next)
      if (previous.has(nextKey)) continue
      previous.set(nextKey, pointKey(point))
      queue.push(next)
    }
  }
  if (!previous.has(pointKey(goal))) return []
  const result = []
  let cursor = pointKey(goal)
  while (cursor !== null) {
    const [x, y] = cursor.split(':').map(Number)
    result.unshift({ x, y })
    cursor = previous.get(cursor)
  }
  return result
}

function distancesFrom(compound, start, visit = null) {
  const distances = new Map()
  if (!isWalkableTile(compound, start, visit)) return distances
  const queue = [start]
  distances.set(pointKey(start), 0)
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index]
    const distance = distances.get(pointKey(point))
    for (const next of walkableNeighbors(compound, point, visit)) {
      if (distances.has(pointKey(next))) continue
      distances.set(pointKey(next), distance + 1)
      queue.push(next)
    }
  }
  return distances
}

export function selectCompoundTarget(compound, entrance = entranceOf(compound)) {
  const rooms = compound.map.rooms ?? []
  const distances = distancesFrom(compound, entrance)
  let farthest = null
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
      const point = { x, y }
      const distance = distances.get(pointKey(point)) ?? -1
      if (distance > 0 && (!farthest || distance > farthest.distance)) farthest = { point, distance }
    }
  }
  return farthest?.point ?? entrance
}

export function minimumVisitSteps(compound) {
  const entrance = entranceOf(compound)
  const goal = selectCompoundTarget(compound, entrance)
  if ((compound.map.rooms ?? []).length > 0 && pointKey(goal) === pointKey(entrance)) return { entrance, goal, outbound: [], returning: [], steps: Infinity }
  const outbound = findShortestPath(compound, entrance, goal)
  const returning = findShortestPath(compound, goal, exitOf(compound))
  if (!outbound.length || !returning.length) return { entrance, goal, outbound: [], returning: [], steps: Infinity }
  return { entrance, goal, outbound, returning, steps: outbound.length - 1 + returning.length - 1 }
}

export function calculateStepBudget(compound) {
  const minimum = minimumVisitSteps(compound).steps
  return Number.isFinite(minimum) ? Math.ceil(minimum * VISIT_STEP_MULTIPLIER) : 0
}

function trapRisk(trap) {
  if (trap.trapType === 'electric') return 2 + (trap.effect?.strength ?? 1) * 2 + (trap.effect?.durationTurns ?? 1)
  if (trap.trapType === 'floor') return trap.effect?.kind === 'restart' ? 6 : 3
  if (trap.trapType === 'gas') return 2 + (trap.effect?.strength ?? 1) * 2 + (trap.effect?.durationTurns ?? 1)
  if (trap.trapType === 'door') return trap.effect?.openMode === 'key' ? 8 : 2 + (trap.effect?.lockDuration ?? 1)
  return 0
}

function threatsAt(compound, point) {
  return compound.items.filter((trap) => trap.type === 'trap' && (trap.trapType === 'gas'
    ? Math.max(Math.abs(trap.x - point.x), Math.abs(trap.y - point.y)) <= (trap.effect?.radius ?? 1)
    : trap.x === point.x && trap.y === point.y))
}

function pathThreats(compound, path) {
  return new Set(path.flatMap((point) => threatsAt(compound, point).map((trap) => trap.id)))
}

function pathRisk(compound, path) {
  return path.reduce((total, point) => total + threatsAt(compound, point).reduce((sum, trap) => sum + trapRisk(trap), 0), 0)
}

function safestPath(compound, start, goal) {
  const open = [{ point: start, cost: 0, path: [start] }]
  const best = new Map([[pointKey(start), 0]])
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost)
    const current = open.shift()
    if (pointKey(current.point) === pointKey(goal)) return current.path
    if (current.cost !== best.get(pointKey(current.point))) continue
    for (const next of walkableNeighbors(compound, current.point)) {
      const risk = threatsAt(compound, next).reduce((sum, trap) => sum + trapRisk(trap), 0)
      const cost = current.cost + 1 + risk * 4
      if (cost >= (best.get(pointKey(next)) ?? Infinity)) continue
      best.set(pointKey(next), cost)
      open.push({ point: next, cost, path: [...current.path, next] })
    }
  }
  return []
}

export function analyzeCompoundPaths(compound, { routeLimit = ROUTE_SAMPLE_LIMIT, expansionLimit = 30000 } = {}) {
  const { entrance, goal, outbound, returning, steps } = minimumVisitSteps(compound)
  if (!Number.isFinite(steps)) return { reachable: false, entrance, goal, minimumSteps: null, stepBudget: 0, routeCount: 0, routeCountCapped: false, junctions: [], shortestRisk: null, safestRisk: null, easyBypass: false, trapCount: compound.items.filter((item) => item.type === 'trap').length, unreachableRooms: (compound.map.rooms ?? []).length }

  const distanceToGoal = distancesFrom(compound, goal)
  const distanceFromEntrance = distancesFrom(compound, entrance)
  const unreachableRooms = (compound.map.rooms ?? []).filter((room) => {
    for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) if (distanceFromEntrance.has(pointKey({ x, y }))) return false
    return true
  })
  const junctions = []
  for (let y = 0; y < compound.map.height; y += 1) for (let x = 0; x < compound.map.width; x += 1) {
    const point = { x, y }
    if (distanceToGoal.has(pointKey(point)) && distanceFromEntrance.has(pointKey(point)) && walkableNeighbors(compound, point).length >= 3) junctions.push(point)
  }

  const traps = compound.items.filter((item) => item.type === 'trap')
  const shortestRisk = pathRisk(compound, outbound)
  const safest = safestPath(compound, entrance, goal)
  const safestRisk = pathRisk(compound, safest)
  let routeCount = 0
  let expansions = 0
  let routeCountCapped = false
  const visited = new Set([pointKey(entrance)])
  function countRoutes(point) {
    if (routeCount >= routeLimit || expansions >= expansionLimit) { routeCountCapped = true; return }
    expansions += 1
    if (pointKey(point) === pointKey(goal)) { routeCount += 1; return }
    const nextPoints = walkableNeighbors(compound, point).filter((next) => !visited.has(pointKey(next)))
      .sort((a, b) => (distanceToGoal.get(pointKey(a)) ?? Infinity) - (distanceToGoal.get(pointKey(b)) ?? Infinity))
    for (const next of nextPoints) {
      visited.add(pointKey(next))
      countRoutes(next)
      visited.delete(pointKey(next))
      if (routeCountCapped) return
    }
  }
  countRoutes(entrance)
  const trapsOnShortest = pathThreats(compound, outbound).size
  const easyBypass = traps.length >= 3 && (safestRisk === 0 || trapsOnShortest <= Math.max(1, Math.floor(traps.length * 0.25)))
  return {
    reachable: unreachableRooms.length === 0 && (compound.map.rooms ?? []).length > 0, unreachableRooms: unreachableRooms.length, entrance, goal, outbound, returning, minimumSteps: steps,
    stepBudget: Math.ceil(steps * VISIT_STEP_MULTIPLIER), routeCount, routeCountCapped,
    junctions, shortestRisk, safestRisk, safestLength: Math.max(0, safest.length - 1), trapsOnShortest,
    trapCount: traps.length, easyBypass,
  }
}
