import { createCompoundData } from '../compound.js'
import { createTrapData } from '../traps.js'

export const CHALLENGE_HOUSE_VERSION = 1
export const CHALLENGE_HOUSES = Object.freeze([
  Object.freeze({
    id: 'beginner-house', version: CHALLENGE_HOUSE_VERSION, name: 'Beginner House', title: 'האחוזה הישנה', order: 1, guardianDifficulty: 'easy', guardianPerks: Object.freeze([]),
    difficulty: 'מתחילים', description: 'הכירו את המתחם, קראו את המעברים ותכננו את הדרך חזרה.', objective: 'הגיעו לחדר הרחוק ביותר וחזרו לכניסה בחיים.',
    medalThresholds: { gold: 1, silver: 1.25 },
    theme: Object.freeze({ id: 'old-manor', wall: '#211c18', room: '#393127', corridor: '#514330', floor: '#29251f', frame: '#51412e', lamp: '#c99a58', accent: '#d8ae70', grain: 'timber' }),
    decor: Object.freeze([{ x: 2, y: 1, glyph: '▤', label: 'ספרייה' }, { x: 9, y: 1, glyph: '▧', label: 'ארון' }, { x: 2, y: 6, glyph: '▱', label: 'שטיח' }]),
    map: Object.freeze({ width: 12, height: 8,
      rooms: [{ id: 'b-foyer', x: 2, y: 1, w: 3, h: 2, label: 'אולם כניסה' }, { id: 'b-pantry', x: 8, y: 1, w: 2, h: 2, label: 'מחסן' }, { id: 'b-den', x: 1, y: 5, w: 3, h: 2, label: 'חדר מנוחה' }],
      passages: [{ id: 'b-north-link-a', x: 3, y: 3, width: 2, height: 1 }, { id: 'b-north-link-b', x: 8, y: 3, width: 1, height: 1 }, { id: 'b-main-hall', x: 1, y: 4, width: 9, height: 1 }, { id: 'b-entry-link', x: 5, y: 5, width: 1, height: 2 }], walls: [], entrances: [{ x: 5, y: 7 }], exits: [{ x: 5, y: 7 }] }),
    traps: [
      { id: 'b-electric', trapType: 'electric', x: 7, y: 4, visibility: 'visible' },
      { id: 'b-floor', trapType: 'floor', x: 3, y: 4, visibility: 'visible' },
    ],
  }),
  Object.freeze({
    id: 'advanced-house', version: CHALLENGE_HOUSE_VERSION, name: 'Advanced House', title: 'בית הזוויות השבורות', order: 2, guardianDifficulty: 'normal', guardianPerks: Object.freeze(['trap-reinforcement']),
    difficulty: 'מתקדם', description: 'אגפים נפרדים, ציר מרכזי ומעברים צדדיים דורשים תכנון מסלול.', objective: 'הגיעו ליעד וחזרו לכניסה בלי לבזבז צעדים מיותרים.',
    medalThresholds: { gold: 1, silver: 1.35 },
    theme: Object.freeze({ id: 'slate-foundry', wall: '#1d2022', room: '#303233', corridor: '#403a32', floor: '#252626', frame: '#554334', lamp: '#bb8152', accent: '#ce9564', grain: 'stone' }),
    decor: Object.freeze([{ x: 1, y: 0, glyph: '▥', label: 'ארון תצוגה' }, { x: 8, y: 0, glyph: '▦', label: 'מדפים' }, { x: 1, y: 6, glyph: '▤', label: 'שולחן עבודה' }, { x: 10, y: 6, glyph: '▱', label: 'שטיח' }]),
    map: Object.freeze({ width: 12, height: 8,
      rooms: [{ id: 'a-west', x: 0, y: 0, w: 3, h: 2, label: 'אגף מערבי' }, { id: 'a-east', x: 8, y: 0, w: 3, h: 2, label: 'ארכיון' }, { id: 'a-center', x: 5, y: 2, w: 2, h: 2, label: 'חדר מרכזי' }, { id: 'a-south-west', x: 0, y: 5, w: 3, h: 2, label: 'מחסן תחתון' }, { id: 'a-south-east', x: 9, y: 5, w: 3, h: 2, label: 'אגף מזרחי' }],
      passages: [{ id: 'a-north-hall', x: 1, y: 2, width: 9, height: 1 }, { id: 'a-center-drop', x: 5, y: 3, width: 1, height: 2 }, { id: 'a-west-drop', x: 1, y: 3, width: 1, height: 2 }, { id: 'a-east-drop', x: 9, y: 3, width: 1, height: 2 }, { id: 'a-south-cross', x: 1, y: 4, width: 9, height: 1 }, { id: 'a-entry', x: 5, y: 5, width: 1, height: 2 }], walls: [], entrances: [{ x: 5, y: 7 }], exits: [{ x: 5, y: 7 }] }),
    traps: [
      { id: 'a-gas', trapType: 'gas', x: 1, y: 4, visibility: 'hidden', effect: { radius: 1, strength: 1, durationTurns: 2 } },
      { id: 'a-door', trapType: 'door', x: 6, y: 3, visibility: 'visible', effect: { lockDuration: 2, openMode: 'automatic' } },
      { id: 'a-electric', trapType: 'electric', x: 9, y: 4, visibility: 'visible', effect: { strength: 2, durationTurns: 1 } },
    ],
  }),
  Object.freeze({
    id: 'expert-house', version: CHALLENGE_HOUSE_VERSION, name: 'Expert House', title: 'מבוך בית האופל', order: 3, guardianDifficulty: 'hard', guardianPerks: Object.freeze(['trap-reinforcement', 'spectator-control']),
    difficulty: 'מומחים', description: 'חמשת האגפים מחוברים בצמתים מסוכנים; ניהול צעדים, חיים וציוד הוא המפתח.', objective: 'השלימו הלוך ושוב והישארו בחיים מול מערך סכנות משולב.',
    medalThresholds: { gold: 1, silver: 1.45 },
    theme: Object.freeze({ id: 'ember-vault', wall: '#1b1918', room: '#332a25', corridor: '#47342c', floor: '#211f1d', frame: '#704b31', lamp: '#cf7b43', accent: '#e09a58', grain: 'cut-stone' }),
    decor: Object.freeze([{ x: 1, y: 0, glyph: '▤', label: 'ארון עתיק' }, { x: 5, y: 0, glyph: '◇', label: 'ויטרינה' }, { x: 10, y: 0, glyph: '▥', label: 'ספרייה' }, { x: 1, y: 6, glyph: '▱', label: 'שטיח' }, { x: 10, y: 6, glyph: '▦', label: 'שולחן' }]),
    map: Object.freeze({ width: 12, height: 8,
      rooms: [{ id: 'e-west-north', x: 0, y: 0, w: 3, h: 2, label: 'ספרייה' }, { id: 'e-center-north', x: 5, y: 0, w: 2, h: 2, label: 'חדר מראות' }, { id: 'e-east-north', x: 9, y: 0, w: 3, h: 2, label: 'אוצר' }, { id: 'e-west-south', x: 0, y: 5, w: 3, h: 2, label: 'מחסן מערבי' }, { id: 'e-east-south', x: 9, y: 5, w: 3, h: 2, label: 'כספת' }],
      passages: [{ id: 'e-west-neck', x: 2, y: 2, width: 1, height: 2 }, { id: 'e-center-neck', x: 5, y: 2, width: 1, height: 2 }, { id: 'e-east-neck', x: 9, y: 2, width: 1, height: 2 }, { id: 'e-cross-hall', x: 2, y: 4, width: 8, height: 1 }, { id: 'e-west-lower', x: 2, y: 5, width: 1, height: 1 }, { id: 'e-east-lower', x: 9, y: 5, width: 1, height: 1 }, { id: 'e-entry', x: 5, y: 5, width: 1, height: 2 }], walls: [], entrances: [{ x: 5, y: 7 }], exits: [{ x: 5, y: 7 }] }),
    traps: [
      { id: 'e-electric', trapType: 'electric', x: 5, y: 4, visibility: 'hidden', effect: { strength: 2, durationTurns: 2 } },
      { id: 'e-gas', trapType: 'gas', x: 3, y: 4, visibility: 'visible', effect: { radius: 2, strength: 1, durationTurns: 3 } },
      { id: 'e-floor', trapType: 'floor', x: 9, y: 4, visibility: 'hidden', effect: { kind: 'delay', stopTurns: 2 } },
      { id: 'e-door', trapType: 'door', x: 6, y: 2, visibility: 'visible', effect: { lockDuration: 2, openMode: 'automatic' } },
    ],
  }),
])

function createHouseTrap(spec) {
  const defaults = createTrapData(spec.trapType)
  return { id: spec.id, type: 'trap', x: spec.x, y: spec.y, w: 1, h: 1, ...defaults, ...(spec.effect ? { effect: { ...defaults.effect, ...spec.effect } } : {}), visibility: spec.visibility }
}

export function getChallengeHouse(houseId) {
  return CHALLENGE_HOUSES.find((house) => house.id === houseId) ?? null
}

export function createChallengeCompound(houseId) {
  const house = getChallengeHouse(houseId)
  if (!house) return null
  const map = structuredClone(house.map)
  const rooms = house.map.rooms.map((room) => ({ ...room, type: 'room' }))
  return createCompoundData([...rooms, ...house.traps.map(createHouseTrap)], map)
}
