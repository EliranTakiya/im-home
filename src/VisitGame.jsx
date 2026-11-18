import { useEffect, useMemo, useRef, useState } from 'react'
import { MAP_COLS, MAP_ROWS } from './compound.js'
import { advanceVisit, calculateVisitScore, clearActiveVisit, resolvePendingTrap, saveActiveVisit, saveVisitResult } from './visitEngine.js'
import { activatePerk, canRevealHiddenTraps, loadPerkStore, savePerkStore } from './perks.js'
import { TRAP_TYPES } from './traps.js'
import { EQUIPMENT_CATALOG, equipmentDetectsTrap, toolsForTrapEncounter } from './equipment.js'
import { facingRotationDegrees } from './navigation.js'
import './VisitGame.css'

const trapColors = { electric: '⚡', floor: '⌄', gas: '◉', door: '▣' }

function VisitMap({ compound, visit }) {
  const traps = useMemo(() => compound.items.filter((item) => item.type === 'trap'), [compound])
  const rooms = compound.map.rooms
  const damageCount = visit.events.filter((event) => event.type === 'damage').length
  const equipmentCount = visit.events.filter((event) => event.type === 'equipment').length
  return <div className="visit-map-wrap" aria-label="מפת הביקור">
    <div className="visit-map" style={{ '--map-cols': MAP_COLS, '--map-rows': MAP_ROWS }}>
      {Array.from({ length: MAP_ROWS * MAP_COLS }, (_, index) => {
        const x = index % MAP_COLS
        const y = Math.floor(index / MAP_COLS)
        const room = rooms.find((item) => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h)
        const passage = compound.map.passages.some((item) => x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height)
        const entrance = compound.map.entrances.some((point) => point.x === x && point.y === y)
        const exit = compound.map.exits.some((point) => point.x === x && point.y === y)
        const wall = !room && !passage && !entrance && !exit
        const targetHere = visit.stage === 'outbound' && visit.target.x === x && visit.target.y === y
        const trap = traps.find((item) => item.x === x && item.y === y)
        const discovered = trap && (trap.visibility !== 'hidden' || canRevealHiddenTraps(visit, 'owner') || equipmentDetectsTrap(visit.equipment, trap, visit.guest.position))
        const gas = traps.find((item) => item.trapType === 'gas' && (visit.trapStates[item.id]?.triggered && visit.trapStates[item.id]?.gasTurnsRemaining > 0 || equipmentDetectsTrap(visit.equipment, item, visit.guest.position)) && Math.max(Math.abs(item.x - x), Math.abs(item.y - y)) <= (item.effect?.radius ?? 1))
        const triggered = trap && visit.trapStates[trap.id]?.triggered
        return <div key={`${x}-${y}`} className={`visit-tile ${wall ? 'tile-wall' : ''} ${room ? 'tile-room' : ''} ${passage ? 'tile-passage' : ''} ${entrance ? 'tile-entrance' : ''} ${gas ? 'tile-gas' : ''} ${gas && trap?.trapType === 'gas' && triggered ? 'tile-gas-active' : ''}`}>
          {room && x === room.x && y === room.y && <span className="visit-room-label">{room.label}</span>}
          {entrance && <span className="visit-entrance-label">כניסה</span>}
          {targetHere && <span className="visit-target-label">יעד</span>}
          {discovered && <span className={`visit-trap visit-trap-${trap.trapType} ${triggered ? 'visit-trap-triggered' : ''}`} title={TRAP_TYPES[trap.trapType]?.name}>{trapColors[trap.trapType]}</span>}
        </div>
      })}
      <div className="visit-guest-layer" aria-hidden="true">
        <span className="visit-guest" style={{ left: `${((visit.guest.position.x + 0.5) / MAP_COLS) * 100}%`, top: `${((visit.guest.position.y + 0.5) / MAP_ROWS) * 100}%`, '--facing-rotation': `${facingRotationDegrees(visit.guest.facing ?? 'north')}deg` }} aria-label={`מיקום האורח, פונה ${visit.guest.facing ?? 'north'}`}>
          <i />
          {damageCount > 0 && <b key={`damage-${damageCount}`} className="visit-guest-reaction visit-guest-damage" />}
          {equipmentCount > 0 && <b key={`equipment-${equipmentCount}`} className="visit-guest-reaction visit-guest-equipment" />}
        </span>
      </div>
    </div>
  </div>
}

function DirectionPad({ disabled, facing, onMove }) {
  const facingLabels = { north: 'צפון', south: 'דרום', east: 'מזרח', west: 'מערב' }
  return <div className="visit-floating-controls">
    <div className="visit-control-heading"><span>תנועה</span><b>מבט {facingLabels[facing] ?? 'צפון'}</b></div>
    <div className="visit-direction-pad" role="group" aria-label="תנועת האורח">
      <button disabled={disabled} onClick={() => onMove('forward')} aria-label="קדימה">↑<small>קדימה</small></button>
      <button disabled={disabled} onClick={() => onMove('left')} aria-label="שמאלה">←<small>שמאלה</small></button>
      <button disabled={disabled} onClick={() => onMove('backward')} aria-label="אחורה">↓<small>אחורה</small></button>
      <button disabled={disabled} onClick={() => onMove('right')} aria-label="ימינה">→<small>ימינה</small></button>
    </div>
    <small className="visit-compass-hint">במפה: ↑ צפון · → מזרח · ↓ דרום · ← מערב</small>
    <small className="visit-control-hint">חצים / WASD · כל תנועה ידנית עוצרת את ההליכה האוטומטית</small>
  </div>
}

const toolIcons = { 'insulated-gloves': '⚡', 'gas-mask': '◉', 'floor-kit': '▱', 'door-kit': '🔧' }

function describeToolImpact(tool) {
  const impact = tool.impact ?? {}
  if (impact.kind === 'reduce-next-damage') return `הפחתת ${impact.amount} נקודות מהנזק בפגיעה הקרובה.`
  if (impact.kind === 'reduce-damage-per-turn') return `הפחתת ${impact.amount} נקודות נזק בכל תור חשיפה לאירוע הגז.`
  if (impact.kind === 'prevent-restart') return 'מניעת החזרה לכניסה; האורח עדיין ייעצר.'
  if (impact.kind === 'shorten-timed-lock') return `קיצור הנעילה ב־${impact.turns} תורות.`
  return 'הכלי יסייע בהתמודדות עם המלכודת לפי ההשפעה שלו.'
}

function TrapDecisionDialog({ trap, tools, actionKind, disabled, onResolve }) {
  if (!trap) return null
  const tool = tools[0] ?? null
  const isAutomatic = actionKind === 'auto-trap'
  const trapGlyph = TRAP_TYPES[trap.trapType]?.glyph ?? '⚠'
  return <div className="trap-decision-backdrop" role="presentation">
    <section className="trap-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="trap-decision-title" aria-describedby="trap-decision-description">
      <div className="trap-decision-eyebrow">{isAutomatic ? 'המלכודת עומדת לפעול' : 'המלכודת ממתינה להפעלה'}</div>
      <div className="trap-decision-title-row"><span className={`decision-trap-icon trap-kind-${trap.trapType}`} aria-hidden="true">{trapGlyph}</span><div><h2 id="trap-decision-title">{trap.name}</h2><span>{TRAP_TYPES[trap.trapType]?.name ?? 'מלכודת'}</span></div></div>
      <div className="trap-decision-content"><p id="trap-decision-description" className="trap-decision-description">{trap.description || 'האורח נתקל במלכודת במתחם.'}</p>
      {tool && <div className="decision-tool-card"><span className="decision-tool-icon" aria-hidden="true">{toolIcons[tool.id] ?? '🔧'}</span><div className="decision-tool-copy"><b>{EQUIPMENT_CATALOG[tool.id]?.name ?? tool.id}</b><span>{tool.usesRemaining} שימושים נותרו בביקור</span><small>{describeToolImpact(tool)}</small></div></div>}</div>
      <div className="trap-decision-actions">
        {tool && <button className="decision-use-tool" autoFocus disabled={disabled} onClick={() => onResolve(true, tool.id)}><span>{toolIcons[tool.id] ?? '🔧'}</span>השתמש בכלי</button>}
        <button className="decision-continue" autoFocus={!tool} disabled={disabled} onClick={() => onResolve(true)}>{tool ? 'המשך ללא כלי' : 'הפעל מלכודת'}</button>
        {!isAutomatic && <button className="decision-skip" disabled={disabled} onClick={() => onResolve(false)}>דלג על ההפעלה</button>}
      </div>
      {disabled && <small className="decision-processing" role="status">ההחלטה מתבצעת…</small>}
    </section>
  </div>
}
export default function VisitGame({ compound, initialVisit, onHome, onRestart, isActive = true }) {
  const [visit, setVisit] = useState(initialVisit)
  const [auto, setAuto] = useState(false)
  const [decisionSubmittedFor, setDecisionSubmittedFor] = useState(null)
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [perkStore, setPerkStore] = useState(() => loadPerkStore())
  const [perkNotice, setPerkNotice] = useState('')
  const visitRef = useRef(visit)
  const autoTimerRef = useRef(null)
  const decisionLockRef = useRef(null)
  const terminal = visit.outcome !== 'active'

  function stopAutoMovement() {
    if (autoTimerRef.current !== null) window.clearInterval(autoTimerRef.current)
    autoTimerRef.current = null
    setAuto(false)
  }

  useEffect(() => { visitRef.current = visit }, [visit])

  useEffect(() => {
    if (!visit.pendingAction) decisionLockRef.current = null
  }, [visit.pendingAction])

  useEffect(() => {
    if (!visit.pendingAction || !isActive) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [isActive, visit.pendingAction])

  useEffect(() => {
    if (!isActive) return undefined
    const keyCommands = { ArrowUp: 'forward', w: 'forward', W: 'forward', ArrowDown: 'backward', s: 'backward', S: 'backward', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }
    const onKeyDown = (event) => {
      const command = keyCommands[event.key]
      if (!command || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return
      if (visitRef.current.pendingAction) return
      event.preventDefault()
      stopAutoMovement()
      setVisit((current) => advanceVisit(compound, current, command))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [compound, isActive])

  useEffect(() => {
    if (!auto || !isActive || terminal || visit.pendingAction) return undefined
    const timer = window.setInterval(() => setVisit((current) => advanceVisit(compound, current)), 650)
    autoTimerRef.current = timer
    return () => {
      window.clearInterval(timer)
      if (autoTimerRef.current === timer) autoTimerRef.current = null
    }
  }, [auto, compound, isActive, terminal, visit.pendingAction])

  useEffect(() => {
    if (terminal) {
      saveVisitResult(visit)
      clearActiveVisit(globalThis.localStorage, visit.id)
    } else saveActiveVisit(compound, visit)
  }, [compound, terminal, visit])

  useEffect(() => {
    const saveBeforePageExit = () => {
      const latestVisit = visitRef.current
      if (latestVisit.outcome === 'active') saveActiveVisit(compound, latestVisit)
      else {
        saveVisitResult(latestVisit)
        clearActiveVisit(globalThis.localStorage, latestVisit.id)
      }
    }
    window.addEventListener('pagehide', saveBeforePageExit)
    return () => window.removeEventListener('pagehide', saveBeforePageExit)
  }, [compound])

  const guest = visit.guest
  const trapsFound = Object.values(visit.trapStates).filter((state) => state.triggered).length
  const availableToolCount = Object.values(visit.equipment?.tools ?? {}).filter((tool) => tool.usesRemaining > 0).length
  const totalToolCount = Object.keys(visit.equipment?.tools ?? {}).length
  const latestDamage = [...visit.events].reverse().find((entry) => entry.type === 'damage' && entry.turn === guest.turns)
  const ownerMapSelected = visit.perks?.selections?.owner?.includes('trap-map') === true
  const ownerMapActive = canRevealHiddenTraps(visit, 'owner')
  const score = calculateVisitScore(visit)
  const pendingTrap = visit.pendingAction ? compound.items.find((item) => item.id === visit.pendingAction.trapId) : null
  const pendingTools = pendingTrap ? toolsForTrapEncounter(visit.equipment, pendingTrap) : []
  const pendingDecisionKey = visit.pendingAction ? `${visit.id}:${visit.pendingAction.trapId}:${visit.pendingAction.kind}` : null
  const decisionSubmitting = decisionSubmittedFor === pendingDecisionKey
  const detectedTraps = compound.items.filter((item) => item.type === 'trap' && equipmentDetectsTrap(visit.equipment, item, guest.position))
  const detectionDescription = (trap) => trap.trapType === 'door'
    ? trap.effect?.openMode === 'key' ? 'דלת זו דורשת מפתח; ערכת הדלתות אינה פותחת אותה.' : `נעילה מתוזמנת: ${trap.effect?.lockDuration ?? 1} תורות.`
    : trap.trapType === 'gas' ? `אזור גז ברדיוס ${trap.effect?.radius ?? 1}.`
      : trap.trapType === 'floor' ? 'זוהתה רצפה נופלת.' : 'זוהתה מלכודת חשמלית.'
  const status = { active: visit.stage === 'outbound' ? 'בדרך ליעד' : 'בדרך ליציאה', completed: 'הביקור הושלם', dead: 'האורח הובס', stalled: 'המסלול נחסם' }[visit.outcome]

  function leaveVisit() {
    stopAutoMovement()
    setEquipmentOpen(false)
    if (visit.outcome === 'active') saveActiveVisit(compound, visit)
    else saveVisitResult(visit)
    onHome(visit)
  }

  function moveGuest(command) {
    stopAutoMovement()
    setVisit((current) => advanceVisit(compound, current, command))
  }

  function resolveTrapDecision(activate, toolId = null) {
    const pendingAction = visitRef.current.pendingAction
    if (!pendingAction) return
    const decisionKey = `${visitRef.current.id}:${pendingAction.trapId}:${pendingAction.kind}`
    if (decisionLockRef.current === decisionKey) return
    decisionLockRef.current = decisionKey
    setDecisionSubmittedFor(decisionKey)
    stopAutoMovement()
    setVisit((current) => resolvePendingTrap(compound, current, activate, toolId))
  }

  function toggleAutoMovement() {
    if (auto) stopAutoMovement()
    else setAuto(true)
  }

  function activateTrapMap() {
    const activationId = `${visit.id}:owner:trap-map:1`
    const result = activatePerk(perkStore, visit.perks, { visitId: visit.id, profileId: 'local-owner', role: 'owner', actorRole: 'owner', perkId: 'trap-map', activationId })
    if (!result.ok) { setPerkNotice('היכולת אינה זמינה: היא לא נבחרה, ננעלה או נוצלה.'); return }
    if (!savePerkStore(result.store)) { setPerkNotice('לא ניתן לשמור את השימוש ביכולת במכשיר הזה.'); return }
    setPerkStore(result.store)
    const nextVisit = { ...visit, perks: result.visitPerks }
    if (!saveActiveVisit(compound, nextVisit)) { setPerkNotice('לא ניתן לשמור את הביקור הפעיל; מפת המלכודות לא הופעלה.'); return }
    setPerkNotice('מפת המלכודות פעילה לבעל המתחם עד סוף הביקור.')
    setVisit(nextVisit)
  }

  return <main className="visit-shell" dir="rtl">
    <header className="visit-header"><button className="visit-back" onClick={leaveVisit}>← למסך הבית</button><div><span className="visit-kicker">מצב משחק · ביקור חי</span><h1>הגנת המתחם</h1></div><div className="visit-seed">מפה v{visit.compoundVersion} <i /> ללא שינוי</div></header>
    <section className={`visit-layout ${visit.status === 'completed' ? 'visit-success' : ''}`}>
      <div className="visit-world-panel">
        <div className="visit-panel-heading"><div><span>אורח #{visit.id.slice(-5)}</span><h2>מבט על המתחם</h2></div><span className={`visit-live ${terminal ? 'visit-ended' : ''}`}><i /> {status}</span></div>
        <div className="visit-hud" aria-label="מצב משחק">
          <div className={`visit-hud-item visit-hud-health ${latestDamage ? 'visit-hud-damaged' : ''}`}><span>חיים</span><b key={`health-${guest.health}-${guest.turns}`}>{guest.health}</b></div>
          <div className="visit-hud-item visit-hud-steps"><span>צעדים נותרו</span><b>{Math.max(0, visit.stepBudget - guest.stepsTaken)}</b></div>
          <button className="visit-hud-item visit-hud-bag" aria-expanded={equipmentOpen} onClick={() => setEquipmentOpen((open) => !open)}><span>תיק</span><b>{availableToolCount}/{totalToolCount}</b></button>
          <div className="visit-hud-item"><span>מבט</span><b>{({ north: 'צפון', east: 'מזרח', south: 'דרום', west: 'מערב' })[guest.facing ?? 'north']}</b></div>
          <div className="visit-hud-item visit-hud-auto"><span>צעידה</span><b>{auto ? 'אוטומטית' : 'ידנית'}</b></div>
          <div className="visit-hud-item visit-hud-score"><span>ניקוד</span><b key={score.total}>{score.total}</b></div>
        </div>
        {equipmentOpen && <div className="visit-hud-equipment-popover" role="region" aria-label="תיק הכלים">
          <div className="visit-popover-heading"><b>תיק הכלים</b><button onClick={() => setEquipmentOpen(false)} aria-label="סגירת התיק">סגור</button></div>
          {totalToolCount ? Object.values(visit.equipment.tools).map((tool) => <div className="visit-popover-tool" key={tool.id}><span>{({ 'insulated-gloves': '⚡', 'gas-mask': '◉', 'floor-kit': '▱', 'door-kit': '🔧' })[tool.id] ?? '🔧'} {EQUIPMENT_CATALOG[tool.id]?.name ?? tool.id}</span><b>{tool.usesRemaining} שימושים</b></div>) : <small>אין כלים בתיק הביקור.</small>}
        </div>}
        <div className="visit-hud-actions">
          {terminal
            ? <button className="visit-hud-step" onClick={() => { stopAutoMovement(); onRestart() }}>התחילו ביקור חדש</button>
            : <><button className="visit-hud-step" disabled={Boolean(visit.pendingAction)} onClick={() => setVisit((current) => advanceVisit(compound, current))}>התקדם צעד</button><button className="visit-hud-auto-button" disabled={Boolean(visit.pendingAction)} aria-pressed={auto} onClick={toggleAutoMovement}>{auto ? 'עצור הליכה אוטומטית' : 'הליכה אוטומטית'}</button></>}
        </div>
        <div className="visit-map-stage">
          <VisitMap compound={compound} visit={visit} />
          <DirectionPad disabled={terminal || Boolean(visit.pendingAction)} facing={guest.facing ?? 'north'} onMove={moveGuest} />
        </div>
        <div className="visit-legend"><span><i className="legend-guest" /> אורח</span><span><i className="legend-trap" /> מלכודת ידועה</span><span><i className="legend-gas" /> אזור גז</span></div>
      </div>
      <aside className="visit-side-panel">
        <details className="visit-details"><summary>מצב והתקדמות</summary><section className="guest-card"><span className="visit-kicker">מצב האורח</span><h2>{guest.name}</h2><div className="guest-health"><span>נקודות חיים</span><b>{guest.health} / 100 {latestDamage && <em className="damage-pop">−{latestDamage.amount}</em>}</b></div><div className="health-track"><i style={{ width: `${guest.health}%` }} /></div>{guest.gasExposure?.length > 0 && <div className="gas-exposure">חשוף לגז · נותרו {guest.gasTurnsRemaining} תורות</div>}<div className="guest-state"><span>{guest.status || status}</span><b>תור {guest.turns}</b></div><div className="progress-copy"><span>התקדמות</span><b>{guest.progress}%</b></div><div className="visit-progress"><i style={{ width: `${guest.progress}%` }} /></div><div className="step-budget-copy"><span>מסלול מינימלי {visit.minimumSteps} · נוצלו {guest.stepsTaken}</span><b>נותרו {Math.max(0, visit.stepBudget - guest.stepsTaken)} צעדים</b></div></section></details>
        {ownerMapSelected && <section className="visit-controls"><div className="visit-perk-control"><b>מפת המלכודות</b>{ownerMapActive ? <span>פעילה לבעל המתחם עד סוף הביקור</span> : <><span>שימוש אחד · עד סוף הביקור</span><button disabled={terminal || Boolean(visit.pendingAction)} onClick={activateTrapMap}>הפעילו מפת מלכודות</button></>}{perkNotice && <small role="status">{perkNotice}</small>}</div></section>}
        
        
        {detectedTraps.length > 0 && <details className="visit-details"><summary>סכנות שזוהו ({detectedTraps.length})</summary><div className="equipment-detections">{detectedTraps.map((trap) => <span key={trap.id}>{EQUIPMENT_CATALOG[Object.values(visit.equipment?.tools ?? {}).find((tool) => EQUIPMENT_CATALOG[tool.id]?.compatibleTrapTypes.includes(trap.trapType))?.id]?.name}: {detectionDescription(trap)}</span>)}</div></details>}<details className="visit-details"><summary>יומן ותוצאות</summary>
          <section className="visit-summary"><span className="visit-kicker">תוצאות בזמן אמת</span><div><span>צעדים</span><b>{guest.stepsTaken}</b></div><div><span>מלכודות שהופעלו</span><b>{trapsFound}</b></div><div><span>נזק מצטבר</span><b>{guest.damageTaken}</b></div><div><span>חיפושי מסלול מחדש</span><b>{visit.reroutes}</b></div></section>
          <section className="visit-log"><span className="visit-kicker">יומן ביקור</span>{visit.events.length ? <ol>{[...visit.events].reverse().slice(0, 5).map((entry, index) => <li key={`${entry.turn}-${entry.type}-${index}`}><i />{entry.message}</li>)}</ol> : <p>הביקור התחיל. האורח ממתין לפקודה.</p>}</section>
          {terminal && <section className="visit-score-panel"><span className="visit-kicker">ניקוד ביקור</span><b>{score.total}</b><small>יעילות {score.efficiency} · חיים {score.survival} · התמודדות {score.handledTraps} · ציוד {score.equipment} · השלמה {score.completion}</small></section>}
        </details>
      </aside></section>
    {isActive && visit.pendingAction && <TrapDecisionDialog trap={pendingTrap} tools={pendingTools} actionKind={visit.pendingAction.kind} disabled={decisionSubmitting} onResolve={resolveTrapDecision} />}
  </main>
}
