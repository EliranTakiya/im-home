import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILDER_MAP_METRICS, calculateBuilderMapGeometry } from './builderMapSizing.js'

test('Builder map uses the largest square cell size that fits the measured viewport', () => {
  const widthLimited = calculateBuilderMapGeometry(1000, 700)
  assert.equal(widthLimited.cellSize, (1000 - 35) / 12)
  assert.equal(widthLimited.trackWidth / 12, widthLimited.trackHeight / 8)
  assert.ok(widthLimited.contentWidth + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.rowAxisWidth + BUILDER_MAP_METRICS.rowAxisGap + BUILDER_MAP_METRICS.frameBleed <= 1000)

  const heightLimited = calculateBuilderMapGeometry(1000, 600)
  assert.equal(heightLimited.cellSize, (600 - 44) / 8)
  assert.equal(heightLimited.trackWidth / 12, heightLimited.trackHeight / 8)
  assert.ok(heightLimited.contentHeight + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.columnAxisHeight + BUILDER_MAP_METRICS.entranceBandHeight + BUILDER_MAP_METRICS.frameBleed <= 600)
})

test('Builder map sizing retains a 12 by 8 grid and safely handles an unmeasured viewport', () => {
  const geometry = calculateBuilderMapGeometry(0, 0)
  assert.equal(geometry.cellSize, 0)
  assert.equal(geometry.trackWidth, 0)
  assert.equal(geometry.trackHeight, 0)
  assert.equal(calculateBuilderMapGeometry(900, 500).trackWidth / calculateBuilderMapGeometry(900, 500).trackHeight, 12 / 8)
})
