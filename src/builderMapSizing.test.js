import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILDER_MAP_METRICS, calculateBuilderMapGeometry } from './builderMapSizing.js'

test('Builder map uses the largest square cell size that fits the measured viewport', () => {
  const widthLimited = calculateBuilderMapGeometry(1000, 700)
  assert.equal(widthLimited.cellSize, (1000 - 43) / 20)
  assert.equal(widthLimited.trackWidth / 20, widthLimited.trackHeight / 12)
  assert.ok(widthLimited.contentWidth + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.rowAxisWidth + BUILDER_MAP_METRICS.rowAxisGap + BUILDER_MAP_METRICS.frameBleed <= 1000)

  const heightLimited = calculateBuilderMapGeometry(1000, 600)
  assert.equal(heightLimited.cellSize, (600 - 48) / 12)
  assert.equal(heightLimited.trackWidth / 20, heightLimited.trackHeight / 12)
  assert.ok(heightLimited.contentHeight + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.columnAxisHeight + BUILDER_MAP_METRICS.entranceBandHeight + BUILDER_MAP_METRICS.frameBleed <= 600)
})

test('Builder map sizing retains a 20 by 12 grid and safely handles an unmeasured viewport', () => {
  const geometry = calculateBuilderMapGeometry(0, 0, 20, 12)
  assert.equal(geometry.cellSize, 0)
  assert.equal(geometry.trackWidth, 0)
  assert.equal(geometry.trackHeight, 0)
  assert.ok(Math.abs(calculateBuilderMapGeometry(900, 500, 20, 12).trackWidth / calculateBuilderMapGeometry(900, 500, 20, 12).trackHeight - 20 / 12) < 1e-9)
})

test('Builder map fits varied mobile landscape viewports without breaking square cells or the 20 by 12 ratio', () => {
  const landscapeSizes = [[568, 320], [667, 375], [844, 390], [932, 430], [1280, 720], [1366, 900]]

  for (const [width, height] of landscapeSizes) {
    const geometry = calculateBuilderMapGeometry(width, height, 20, 12)
    const horizontalUse = geometry.contentWidth + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.rowAxisWidth + BUILDER_MAP_METRICS.rowAxisGap + BUILDER_MAP_METRICS.frameBleed
    const verticalUse = geometry.contentHeight + 2 * (BUILDER_MAP_METRICS.gridPadding + BUILDER_MAP_METRICS.gridBorder) + BUILDER_MAP_METRICS.columnAxisBand + BUILDER_MAP_METRICS.entranceBandHeight + BUILDER_MAP_METRICS.frameBleed

    assert.ok(geometry.cellSize > 0, `${width}x${height} should produce visible cells`)
    assert.ok(horizontalUse <= width, `${width}x${height} should fit horizontally`)
    assert.ok(verticalUse <= height, `${width}x${height} should fit vertically`)
    assert.equal(geometry.trackWidth / 20, geometry.trackHeight / 12)
    assert.ok(Math.abs(geometry.trackWidth / geometry.trackHeight - 20 / 12) < 1e-9)
  }
})
