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

export function calculateBuilderMapGeometry(width, height, columns = 20, rows = 12) {
  const { cellGap, gridPadding, gridBorder, rowAxisWidth, rowAxisGap, columnAxisBand, entranceBandHeight, frameBleed } = BUILDER_MAP_METRICS
  const horizontalChrome = (columns - 1) * cellGap + 2 * (gridPadding + gridBorder) + rowAxisWidth + rowAxisGap + frameBleed
  const verticalChrome = (rows - 1) * cellGap + 2 * (gridPadding + gridBorder) + columnAxisBand + entranceBandHeight + frameBleed
  const cellSize = Math.max(0, Math.min((width - horizontalChrome) / columns, (height - verticalChrome) / rows))

  return {
    cellSize,
    trackWidth: columns * cellSize,
    trackHeight: rows * cellSize,
    contentWidth: columns * cellSize + (columns - 1) * cellGap,
    contentHeight: rows * cellSize + (rows - 1) * cellGap,
  }
}
