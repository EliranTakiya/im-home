import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('main-menu visit actions have distinct destinations and no duplicate New Visit action', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  assert.match(app, /className="secondary-button" onClick=\{\(\) => setScreen\('challenge-selection'\)\}><span className="play-icon">◆<\/span> AI Challenge/)
  assert.match(app, /setScreen\('visit-selection'\) \}\}><span className="play-icon">▶<\/span> Start a Visit/)
  assert.match(app, /className="secondary-button visit-coming-soon" disabled[\s\S]*?Visit Other Players · Coming Soon/)
  assert.match(app, /onClick=\{continueVisit\}[^>]*>[\s\S]*?Continue Visit · ביקור רגיל/)
  assert.match(app, /onClick=\{continueChallenge\}[^>]*>[\s\S]*?Continue AI Challenge/)
  assert.doesNotMatch(app, /בחירת ביקור|התחילו ביקור/)
})

test('continue visit relies on validated ordinary storage and new visit waits for a successful save', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  const continueFlow = app.slice(app.indexOf('function continueVisit()'), app.indexOf('function returnHome'))
  const startFlow = app.slice(app.indexOf('function startVisitWithEquipment'), app.indexOf('function cancelVisitDraft'))
  assert.match(continueFlow, /const active = loadActiveVisit\(\)/)
  assert.doesNotMatch(continueFlow, /visit\?\.session\.outcome/)
  assert.match(startFlow, /if \(!saveActiveVisit\(target\.compound, session\)\)\s*\{[\s\S]*?return\s*\}/)
  assert.ok(startFlow.indexOf('saveActiveVisit') < startFlow.indexOf('setVisit({ compound: target.compound, session })'))
})

test('ordinary and challenge selection flows remain separate and responsive home actions wrap', async () => {
  const [selection, css] = await Promise.all([
    readFile(new URL('./VisitSelection.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./App.css', import.meta.url), 'utf8'),
  ])
  assert.match(selection, /!challengeMode \? <section className="selection-category destination-empty-state"/)
  assert.match(selection, /: showAchievements \? <Achievements/)
  assert.match(selection, /הבית האישי שלך נשאר ב־My Home ואינו נבחר אוטומטית/)
  assert.match(css, /\.hero-actions\s*\{[^}]*flex-wrap:\s*wrap/)
})
