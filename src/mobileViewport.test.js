import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Builder shares one measured viewport for its coordinates and complete 12 by 8 board', async () => {
  const component = await readFile(new URL('./Builder.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./BuilderWorkspace.css', import.meta.url), 'utf8')
  const sizing = await readFile(new URL('./builderMapSizing.js', import.meta.url), 'utf8')

  assert.match(component, /new ResizeObserver\(measure\)/)
  assert.match(component, /calculateBuilderMapGeometry\(mapViewport\.width, mapViewport\.height, MAP_COLS, MAP_ROWS\)/)
  assert.match(sizing, /horizontalChrome = \(columns - 1\) \* cellGap \+ 2 \* \(gridPadding \+ gridBorder\) \+ rowAxisWidth \+ rowAxisGap \+ frameBleed/)
  assert.match(sizing, /verticalChrome = \(rows - 1\) \* cellGap \+ 2 \* \(gridPadding \+ gridBorder\) \+ columnAxisBand \+ entranceBandHeight \+ frameBleed/)
  assert.match(component, /'--map-grid-track-width': `\$\{mapGeometry\.trackWidth\}px`/)
  assert.match(component, /'--map-cell-size': `\$\{mapGeometry\.cellSize\}px`/)
  assert.match(component, /className="map-fit-viewport" ref=\{mapViewportRef\}/)
  assert.match(component, /<MapFirstLayout className=\{`builder-layout/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.map-fit-viewport \.compound-grid\{[^}]*aspect-ratio:auto/)
  assert.match(css, /\.map-coordinates-top\{[^}]*width:var\(--map-fit-width\)/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.map-fit-viewport \.map-coordinates-side\{[^}]*height:var\(--map-fit-height\)/)
  assert.match(css, /\.map-fit-viewport \.compound-grid\{[^}]*max-width:none;max-height:none/)
  assert.match(css, /\.map-panel-head\{min-height:14px\}/)
  assert.match(css, /\.map-instruction\{min-height:8px/)
  assert.match(css, /\.compound-grid \.trap-mark\{font-size:clamp\(13px,calc\(var\(--map-cell-size\) \* \.55\),30px\)/)
  assert.match(css, /\.map-coordinates-top[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/)
  assert.match(css, /\.map-coordinates-side\{grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/)
  assert.match(css, /\.map-panel\{[^}]*overflow:hidden/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout\.has-start-rail\.has-end-rail\{grid-template-columns/)
  assert.doesNotMatch(css, /\.builder-layout\{display:grid;grid-template-columns:minmax\(0,1fr\)/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.map-fit-viewport \.map-coordinates-top\{left:calc\(50% - 9px\)[^}]*top:calc\(\(100% - var\(--map-fit-height\) - 44px\)\/2\)[^}]*width:var\(--map-fit-width\)[^}]*padding:0/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.map-fit-viewport \.map-with-rows\{inset-block:var\(--map-column-axis-band\) var\(--map-entrance-band-height\)/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout \.map-fit-viewport \.map-with-rows\{[^}]*direction:rtl/)
  assert.match(css, /\.builder-layout\.ih-map-first-layout\.has-start-rail\.has-end-rail\{grid-template-columns:minmax\(92px,\.38fr\) minmax\(0,5\.8fr\) minmax\(132px,\.62fr\)/)
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

test('single-role Guest Perks uses the full landscape track and keeps its two cards and actions accessible', async () => {
  const component = await readFile(new URL('./PerkSelection.jsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('./PreparationUI.css', import.meta.url), 'utf8')

  assert.match(component, /roles\.length === 1 \? 'perk-selection-layout-single-role'/)
  assert.match(styles, /\.perk-selection-layout-single-role\{[^}]*grid-template-columns:minmax\(0,1fr\);align-items:stretch/)
  assert.match(styles, /\.perk-selection-layout-single-role \.perk-cards\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(styles, /\.perk-selection-layout-single-role \.perk-selection-actions\{position:sticky/)
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
