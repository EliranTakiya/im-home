import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('the official loading artwork is the first screen and yields to the existing home menu after image loading', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  const loading = await readFile(new URL('./OfficialLoadingScreen.jsx', import.meta.url), 'utf8')
  const background = await readFile(new URL('./assets/original loading screen image.jpeg', import.meta.url))

  assert.match(app, /useState\('loading'\)/)
  assert.match(app, /screen === 'loading' && <OfficialLoadingScreen appReady=\{appReady\} onReady=\{finishStartup\}/)
  assert.ok(app.indexOf("screen === 'loading'") < app.indexOf('className="command-center-shell"'))
  assert.match(loading, /original loading screen image\.jpeg/)
  assert.match(loading, /onLoad=\{markArtworkReady\} onError=\{markArtworkReady\}/)
  assert.ok(background.length > 1000)
})

test('the official loading screen preserves artwork proportions and adapts its logo and spinner to landscape', async () => {
  const css = await readFile(new URL('./OfficialLoadingScreen.css', import.meta.url), 'utf8')
  assert.match(css, /\.official-loading-artwork\{[^}]*object-fit:contain/)
  assert.match(css, /@media\(max-height:520px\) and \(orientation:landscape\)/)
  assert.match(css, /@keyframes official-loading-spin/)
  assert.doesNotMatch(css, /loading-percent|progress-percent/)
})
