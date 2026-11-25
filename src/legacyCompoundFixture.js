import { createCompoundData } from './compound.js'

export function createLegacyCompoundFixture(items) {
  const rooms = items.filter((item) => item.type === 'room')
  return createCompoundData(items, {
    width: 12,
    height: 8,
    rooms,
    passages: [
      { id: 'main-cross-passage', x: 0, y: 4, width: 12, height: 1 },
      { id: 'upper-gallery', x: 0, y: 3, width: 12, height: 1 },
      { id: 'entrance-passage', x: 5, y: 5, width: 1, height: 2 },
    ],
    walls: [],
    entrances: [{ id: 'main-entrance', x: 5, y: 7 }],
    exits: [{ id: 'main-exit', x: 5, y: 7 }],
  })
}
