import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Builder shares one measured viewport for its coordinates and complete 12 by 8 board', async () => {
  const component = await readFile(new URL('./Builder.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./BuilderWorkspace.css', import.meta.url), 'utf8')

  assert.match(component, /new ResizeObserver\(measure\)/)
  assert.match(component, /availableGridHeight \* MAP_COLS \/ MAP_ROWS/)
  assert.match(component, /className="map-fit-viewport" ref=\{mapViewportRef\}/)
  assert.match(component, /<MapFirstLayout className=\{`builder-layout/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.map-fit-viewport \.compound-grid\{[^}]*aspect-ratio:12\/8/)
  assert.match(css, /\.map-coordinates-top[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/)
  assert.match(css, /\.map-coordinates-side\{grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/)
  assert.match(css, /\.map-panel\{[^}]*overflow:hidden/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout\.has-start-rail\.has-end-rail\{grid-template-columns/)
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
  assert.match(css, /\.visit-world-panel\{display:grid;grid-template-rows:auto auto auto minmax\(0,1fr\)/)
  assert.match(css, /\.visit-map-stage>\.visit-map-wrap\{grid-column:1;grid-row:1\/3/)
  assert.match(css, /\.visit-map-stage>\.visit-floating-controls\{grid-column:2;grid-row:2/)
})
