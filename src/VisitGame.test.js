import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./VisitGame.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('./VisitGame.css', import.meta.url), 'utf8')

test('floating direction controls sit next to the map and expose current facing', () => {
  assert.match(source, /className="visit-map-stage">\s*<VisitMap[\s\S]*?<DirectionPad[^>]+facing=\{guest\.facing/)
  assert.match(source, /מבט \{facingLabels\[facing\]/)
  assert.match(source, /facingRotationDegrees\(visit\.guest\.facing \?\? 'north'\)/)
  assert.match(source, /className="visit-compass-hint"/)
  assert.doesNotMatch(source, /visit-movement-tools/)
})

test('keyboard and button movement share commands and immediately stop automatic movement', () => {
  assert.match(source, /ArrowUp: 'forward'[\s\S]*?ArrowLeft: 'left'[\s\S]*?ArrowRight: 'right'/)
  assert.match(source, /onClick=\{\(\) => onMove\('backward'\)\}/)
  assert.equal((source.match(/stopAutoMovement\(\)/g) ?? []).length >= 3, true)
  assert.match(source, /function stopAutoMovement\(\) \{[\s\S]*?clearInterval\(autoTimerRef\.current\)/)
})

test('control layout adapts for desktop, mobile, and short screens without covering the map', () => {
  assert.match(styles, /\.visit-map-stage\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) clamp\(/)
  assert.match(styles, /@media\(max-width:1000px\)[\s\S]*?\.visit-layout\{grid-template-columns:minmax\(0,1fr\)\}/)
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*?\.visit-map-stage\{grid-template-columns:minmax\(0,1fr\)/)
  assert.match(styles, /@media\(max-width:420px\)/)
  assert.match(styles, /@media\(max-height:650px\) and \(min-width:761px\)/)
  assert.match(styles, /touch-action:manipulation/)
  assert.match(styles, /\.visit-map\{direction:ltr\}/)
  assert.match(styles, /rotate\(var\(--facing-rotation,0deg\)\)/)
  assert.doesNotMatch(styles, /\.visit-floating-controls\{[^}]*position:fixed/)
})

test('the trap decision uses a fixed, scroll-safe modal with its actions kept visible', () => {
  assert.match(source, /isActive && visit\.pendingAction && <TrapDecisionDialog/)
  assert.match(source, /role="dialog" aria-modal="true"/)
  assert.match(source, /השתמש בכלי/)
  assert.match(source, /המשך ללא כלי/)
  assert.match(source, /usesRemaining/)
  assert.match(source, /describeToolImpact\(tool\)/)
  assert.match(source, /decisionLockRef\.current === decisionKey/)
  assert.match(source, /if \(visitRef\.current\.pendingAction\) return/)
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(styles, /\.trap-decision-backdrop\{position:fixed/)
  assert.match(styles, /max-height:calc\(100dvh - 24px - env\(safe-area-inset-top\)/)
  assert.match(styles, /\.trap-decision-actions\{[^}]*flex:0 0 auto/)
  assert.match(styles, /\.trap-decision-content\{min-height:0;overflow:auto/)
  assert.match(styles, /@media\(max-width:380px\)/)
  assert.match(styles, /@media\(max-height:520px\) and \(orientation:landscape\)/)
})

test('the game HUD keeps core status and turn controls beside the map', () => {
  assert.match(source, /className="visit-hud"/)
  assert.match(source, /visit-hud-step/)
  assert.match(source, /visit-hud-auto-button/)
  assert.match(source, /aria-expanded=\{equipmentOpen\}/)
  assert.match(source, /className="visit-hud-equipment-popover"/)
  assert.match(styles, /\.visit-hud\{display:grid/)
  assert.match(styles, /\.visit-hud-equipment-popover\{position:fixed/)
  assert.match(styles, /env\(safe-area-inset-bottom\)/)
})

test('the visit visual layer follows saved guest position and facing without changing movement state', () => {
  assert.match(source, /className="visit-guest-layer"/)
  assert.match(source, /left: `\$\{\(\(visit\.guest\.position\.x \+ 0\.5\) \/ MAP_COLS\) \* 100\}%`/)
  assert.match(source, /top: `\$\{\(\(visit\.guest\.position\.y \+ 0\.5\) \/ MAP_ROWS\) \* 100\}%`/)
  assert.match(source, /facingRotationDegrees\(visit\.guest\.facing \?\? 'north'\)/)
  assert.match(source, /visit-guest-damage/)
  assert.match(source, /visit-guest-equipment/)
  assert.match(source, /visit-trap-triggered/)
})

test('Dark Neon Adventure effects are scoped, responsive, non-interactive, and respect reduced motion', () => {
  for (const color of ['#172435', '#19c7c2', '#78d957', '#ff7048', '#a78bfa', '#f5c451']) assert.ok(styles.includes(color))
  assert.match(styles, /\.visit-guest-layer\{[^}]*pointer-events:none/)
  assert.match(styles, /\.visit-guest\{[^}]*transition:left \.22s[^}]*top \.22s/)
  assert.match(styles, /@keyframes guest-breathe/)
  assert.match(styles, /@keyframes trap-activated/)
  assert.match(styles, /@keyframes gas-drift/)
  assert.match(styles, /@keyframes hud-damage/)
  assert.match(styles, /@keyframes dialog-enter/)
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.visit-guest\{transition:none\}/)
  assert.match(styles, /@media\(max-width:760px\)/)
  assert.match(styles, /@media\(max-width:380px\)/)
  assert.match(styles, /@media\(max-width:760px\) and \(orientation:landscape\)/)
})
