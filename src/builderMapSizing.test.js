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

test('Builder map fits varied mobile landscape viewports without breaking square cells or the 12 by 8 ratio', () => {
  const landscapeSizes = [[568, 320], [667, 375], [844, 390], [932, 430], [1280, 720], [1366, 900]]

  for (const [width, height] of landscapeSizes) {
    const geometry = calculateBuilderMapGeometry(width, height)
    const horizontalUse = geometry.contentWidth + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.rowAxisWidth + BUILDER_MAP_METRICS.rowAxisGap + BUILDER_MAP_METRICS.frameBleed
    const verticalUse = geometry.contentHeight + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.columnAxisBand + BUILDER_MAP_METRICS.entranceBandHeight + BUILDER_MAP_METRICS.frameBleed

    assert.ok(geometry.cellSize > 0, `${width}x${height} should produce visible cells`)
    assert.ok(horizontalUse <= width, `${width}x${height} should fit horizontally`)
    assert.ok(verticalUse <= height, `${width}x${height} should fit vertically`)
    assert.equal(geometry.trackWidth / 12, geometry.trackHeight / 8)
    assert.equal(geometry.trackWidth / geometry.trackHeight, 12 / 8)
  }
})
