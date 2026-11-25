import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Builder measures its map viewport and scales the whole 12 by 8 board without making it scrollable', async () => {
  const component = await readFile(new URL('./Builder.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./BuilderWorkspace.css', import.meta.url), 'utf8')

  assert.match(component, /new ResizeObserver\(measure\)/)
  assert.match(component, /availableGridHeight \* MAP_COLS \/ MAP_ROWS/)
  assert.match(component, /className="map-fit-viewport" ref=\{mapViewportRef\}/)
  assert.match(css, /\.map-fit-viewport \.compound-grid\{[^}]*min-width:0;[^}]*max-width:100%/)
  assert.match(css, /\.map-panel\{[^}]*overflow:hidden/)
  assert.match(css, /@media\(max-height:520px\) and \(orientation:landscape\)/)
})

test('Builder tools and route analysis are accessible on demand and do not occupy the map by default', async () => {
  const component = await readFile(new URL('./Builder.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./BuilderWorkspace.css', import.meta.url), 'utf8')

  assert.match(component, /aria-controls="builder-tools"/)
  assert.match(component, /open \? 'toolbar-open'/)
  assert.match(component, /aria-expanded=\{analysisOpen\}/)
  assert.match(css, /\.builder-toolbar:not\(\.builder-toolbar-floating\)\{display:none\}/)
  assert.match(css, /\.builder-toolbar:not\(\.builder-toolbar-floating\)\.toolbar-open\{position:fixed/)
  assert.match(css, /\.map-panel>\.route-analysis\{[^}]*overflow:auto/)
})

test('startup readiness waits for app initialization, the official artwork, and only a short anti-flash minimum', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  const loading = await readFile(new URL('./OfficialLoadingScreen.jsx', import.meta.url), 'utf8')
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))

  assert.match(app, /setTimeout\(\(\) => setAppReady\(true\), 0\)/)
  assert.match(loading, /const MINIMUM_DISPLAY_MS = 500/)
  assert.match(loading, /!appReady \|\| !artworkReady/)
  assert.match(loading, /window\.setTimeout\(onReady, remaining\)/)
  assert.equal(manifest.orientation, 'landscape')
  assert.match(app, /<OrientationPrompt active=\{screen !== 'loading'\} \/>/)
})
