export const BUILDER_MAP_METRICS = Object.freeze({
  cellGap: 1,
  gridPadding: 2,
  gridBorder: 1,
  rowAxisWidth: 14,
  rowAxisGap: 4,
  columnAxisBand: 17,
  columnAxisHeight: 13,
  entranceBandHeight: 14,
  frameBleed: 0,
})

// Touch landscape fills the marked Builder work area with larger uniform grid
// tracks while keeping the board close to its intended widescreen proportions.
export const LANDSCAPE_BUILDER_MAP_METRICS = Object.freeze({
  ...BUILDER_MAP_METRICS,
  gridPadding: 0,
  rowAxisWidth: 12,
  rowAxisGap: 2,
  columnAxisBand: 10,
  columnAxisHeight: 9,
  entranceBandHeight: 8,
})

export function calculateBuilderMapGeometry(width, height, columns = 20, rows = 12, metrics = BUILDER_MAP_METRICS) {
  const { cellGap, gridPadding, gridBorder, rowAxisWidth, rowAxisGap, columnAxisBand, entranceBandHeight, frameBleed } = metrics
  const horizontalChrome = (columns - 1) * cellGap + 2 * (gridPadding + gridBorder) + rowAxisWidth + rowAxisGap + frameBleed
  const verticalChrome = (rows - 1) * cellGap + 2 * (gridPadding + gridBorder) + columnAxisBand + entranceBandHeight + frameBleed
  const availableCellWidth = Math.max(0, (width - horizontalChrome) / columns)
  const availableCellHeight = Math.max(0, (height - verticalChrome) / rows)
  const cellSize = Math.min(availableCellWidth, availableCellHeight)

  return {
    cellSize,
    cellWidth: cellSize,
    cellHeight: cellSize,
    trackWidth: columns * cellSize,
    trackHeight: rows * cellSize,
    contentWidth: columns * cellSize + (columns - 1) * cellGap,
    contentHeight: rows * cellSize + (rows - 1) * cellGap,
  }
}
