import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Builder shares one measured viewport for its coordinates and complete 12 by 8 board', async () => {
  const component = await readFile(new URL('./Builder.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./BuilderWorkspace.css', import.meta.url), 'utf8')

  assert.match(component, /new ResizeObserver\(measure\)/)
  assert.match(component, /mapCellSize = Math\.max\(0, Math\.min\(\(mapViewport\.width - 18 - 45\) \/ MAP_COLS, \(mapViewport\.height - 27 - 33\) \/ MAP_ROWS\)\)/)
  assert.match(component, /'--map-grid-track-width': `\$\{MAP_COLS \* mapCellSize\}px`/)
  assert.match(component, /className="map-fit-viewport" ref=\{mapViewportRef\}/)
  assert.match(component, /<MapFirstLayout className=\{`builder-layout/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.map-fit-viewport \.compound-grid\{[^}]*aspect-ratio:auto/)
  assert.match(css, /\.map-coordinates-top\{[^}]*width:var\(--map-grid-track-width\)/)
  assert.match(css, /\.map-coordinates-side\{height:var\(--map-grid-track-height\)/)
  assert.match(css, /\.map-coordinates-top[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/)
  assert.match(css, /\.map-coordinates-side\{grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/)
  assert.match(css, /\.map-panel\{[^}]*overflow:hidden/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout\.has-start-rail\.has-end-rail\{grid-template-columns/)
  assert.doesNotMatch(css, /\.builder-layout\{display:grid;grid-template-columns:minmax\(0,1fr\)/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout\.has-start-rail\.has-end-rail\{grid-template-columns:minmax\(112px,\.62fr\) minmax\(0,4\.2fr\) minmax\(160px,\.88fr\)/)
  assert.match(css, /@media\(orientation:portrait\) and \(max-width:760px\)\{\.builder-layout\.ih-map-first-layout\{grid-template-columns:minmax\(0,1fr\)/)
})

test('visit journal renders a compact newest-first view while retaining full saved history', async () => {
  const component = await readFile(new URL('./VisitGame.jsx', import.meta.url), 'utf8')
  const journal = await readFile(new URL('./visitJournal.js', import.meta.url), 'utf8')
  const styles = await readFile(new URL('./VisitGameShell.css', import.meta.url), 'utf8')
  const tests = await readFile(new URL('./visitJournal.test.js', import.meta.url), 'utf8')

  assert.match(component, /getRecentVisitEvents\(visit\.events\)/)
  assert.match(component, /visit\.events\.length - 1 - index/)
  assert.match(component, /\[\.\.\.visit\.events\]\.reverse\(\)\.map/)
  assert.match(journal, /COMPACT_VISIT_EVENT_LIMIT = 5/)
  assert.match(tests, /leaves the original complete history untouched/)
  assert.match(styles, /visit-live-journal/)
  assert.match(styles, /prefers-reduced-motion:reduce\)\{\.visit-live-journal/)
})

test('Builder tool selection remains available until manually closed and route analysis uses a fixed utility zone', async () => {
  const component = await readFile(new URL('./Builder.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./BuilderWorkspace.css', import.meta.url), 'utf8')

  assert.match(component, /aria-controls="builder-tools"/)
  assert.match(component, /open \? 'toolbar-open'/)
  assert.match(component, /aria-expanded=\{analysisOpen\}/)
  assert.doesNotMatch(component, /setTool\(tool === 'trap' \? null : 'trap'\); setMoveId\(null\); if \(!floating\) onClose/)
  assert.match(component, /onClick=\{\(\) => onSelectTrapType\(definition\.id\)\}/)
  assert.match(component, /<RouteAnalysis analysis=\{routeAnalysis\} onClose=\{\(\) => setAnalysisOpen\(false\)\} \/>/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.builder-toolbar:not\(\.builder-toolbar-floating\)\{position:relative/)
  assert.match(css, /\.builder-utility-rail>\.route-analysis\{position:relative/)
  assert.match(css, /\.builder-utility-rail>\.route-analysis\{position:absolute;z-index:30;inset:0/)
})

test('startup readiness waits for initialization, artwork, and the five-second minimum without restarting orientation UI on internal screens', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  const loading = await readFile(new URL('./OfficialLoadingScreen.jsx', import.meta.url), 'utf8')
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))

  assert.match(app, /setTimeout\(\(\) => setAppReady\(true\), 0\)/)
  assert.match(loading, /const MINIMUM_DISPLAY_MS = 5000/)
  assert.match(loading, /!appReady \|\| !artworkReady/)
  assert.match(loading, /window\.setTimeout\(onReady, remaining\)/)
  assert.equal(manifest.orientation, 'landscape')
  assert.match(app, /<OrientationPrompt active=\{screen === 'home'\} \/>/)
  assert.match(app, /className=\{`command-center-shell \$\{screen === 'home' \? '' : 'shell-inactive'\}`\}/)
})

test('fixed landscape game layout fits VisitGame map and keeps the movement pad in a dedicated side rail', async () => {
  const css = await readFile(new URL('./VisitGameShell.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(orientation:landscape\) and \(max-height:600px\)/)
  assert.match(css, /\.visit-shell\{display:flex;flex-direction:column;width:100%;height:100dvh/)
  assert.match(css, /\.visit-world-panel>\.visit-map-stage\.ih-map-first-layout\{flex:1 1 0;[^}]*grid-template-rows:minmax\(0,1fr\)/)
  assert.match(css, /\.visit-map-stage\.ih-map-first-layout>\.ih-map-first-map/)
  assert.doesNotMatch(css, /\.visit-world-panel\{display:grid;grid-template-rows/)
  assert.doesNotMatch(css, /\.visit-map-stage>\.visit-map-wrap\{/)
  assert.doesNotMatch(css, /\.visit-map-stage>\.visit-floating-controls\{/)
})
