import test from 'node:test'
import assert from 'node:assert/strict'
import { STARTER_ITEMS, createCompoundData } from './compound.js'
import { analyzeCompoundPaths, calculateStepBudget, facingRotationDegrees, findShortestPath, isWalkableTile, minimumVisitSteps, stepTarget } from './navigation.js'

test('starter compound has several legal routes, useful junctions, and a data-derived round-trip step budget', () => {
  const compound = createCompoundData(STARTER_ITEMS)
  const analysis = analyzeCompoundPaths(compound)
  assert.equal(analysis.reachable, true)
  assert.ok(analysis.routeCount > 1)
  assert.ok(analysis.junctions.length > 0)
  assert.ok(analysis.minimumSteps > 0)
  assert.equal(analysis.stepBudget, Math.ceil(analysis.minimumSteps * 1.5))
  assert.equal(calculateStepBudget(compound), analysis.stepBudget)
})

test('rooms disconnected by a wall are reported and cannot be treated as a valid compound', () => {
  const compound = createCompoundData(STARTER_ITEMS)
  compound.map.walls = Array.from({ length: compound.map.width }, (_, x) => ({ x, y: 3 }))
  const analysis = analyzeCompoundPaths(compound)
  assert.equal(isWalkableTile(compound, { x: 5, y: 3 }), false)
  assert.equal(findShortestPath(compound, compound.map.entrances[0], { x: 2, y: 2 }).length, 0)
  assert.equal(analysis.reachable, false)
  assert.ok(analysis.unreachableRooms > 0)
})

test('owner analysis identifies a trap-free route that bypasses a dense trap layout', () => {
  const traps = [
    { id: 'e1', type: 'trap', trapType: 'electric', x: 0, y: 4, w: 1, h: 1 },
    { id: 'g1', type: 'trap', trapType: 'gas', x: 1, y: 3, w: 1, h: 1 },
    { id: 'f1', type: 'trap', trapType: 'floor', x: 11, y: 4, w: 1, h: 1 },
  ]
  const analysis = analyzeCompoundPaths(createCompoundData([...STARTER_ITEMS, ...traps]))
  assert.equal(analysis.trapCount, 3)
  assert.equal(analysis.easyBypass, true)
  assert.equal(analysis.safestRisk, 0)
})

test('all four relative commands produce the expected compass movement from every facing', () => {
  const cases = {
    north: { forward: [0, -1, 'north'], backward: [0, 1, 'north'], left: [-1, 0, 'west'], right: [1, 0, 'east'] },
    east: { forward: [1, 0, 'east'], backward: [-1, 0, 'east'], left: [0, -1, 'north'], right: [0, 1, 'south'] },
    south: { forward: [0, 1, 'south'], backward: [0, -1, 'south'], left: [1, 0, 'east'], right: [-1, 0, 'west'] },
    west: { forward: [-1, 0, 'west'], backward: [1, 0, 'west'], left: [0, 1, 'south'], right: [0, -1, 'north'] },
  }
  for (const [facing, commands] of Object.entries(cases)) {
    for (const [command, [dx, dy, nextFacing]] of Object.entries(commands)) {
      assert.deepEqual(stepTarget({ x: 5, y: 5 }, facing, command), { position: { x: 5 + dx, y: 5 + dy }, facing: nextFacing }, `${facing} + ${command}`)
    }
  }
})

test('facing arrow rotation uses the same north-east-south-west screen coordinate order', () => {
  for (const [facing, degrees] of Object.entries({ north: 0, east: 90, south: 180, west: 270 })) {
    assert.equal(facingRotationDegrees(facing), degrees, `${facing} arrow angle`)
  }
  assert.equal(facingRotationDegrees('invalid'), null)
})

test('minimum route includes the return trip from the selected goal to the entrance', () => {
  const compound = createCompoundData(STARTER_ITEMS)
  const route = minimumVisitSteps(compound)
  assert.equal(route.steps, route.outbound.length - 1 + route.returning.length - 1)
  assert.deepEqual(
    { x: route.returning.at(-1).x, y: route.returning.at(-1).y },
    { x: route.entrance.x, y: route.entrance.y },
  )
})
