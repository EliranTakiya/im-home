import { useEffect, useMemo, useRef, useState } from 'react'
import { MAP_COLS, MAP_ROWS } from './compound.js'
import { advanceVisit, clearActiveVisit, resolvePendingTrap, saveActiveVisit, saveVisitResult } from './visitEngine.js'
import { activatePerk, canRevealHiddenTraps, loadPerkStore, savePerkStore } from './perks.js'
import { TRAP_TYPES } from './traps.js'
import { EQUIPMENT_CATALOG, equipmentDetectsTrap, toolsForTrapEncounter } from './equipment.js'
import './VisitGame.css'

const trapColors = { electric: '⚡', floor: '⌄', gas: '◉', door: '▣' }

function VisitMap({ compound, visit }) {
  const traps = useMemo(() => compound.items.filter((item) => item.type === 'trap'), [compound])
  const rooms = compound.map.rooms
  return <div className="visit-map-wrap" aria-label="מפת הביקור">
    <div className="visit-map" style={{ '--map-cols': MAP_COLS, '--map-rows': MAP_ROWS }}>
      {Array.from({ length: MAP_ROWS * MAP_COLS }, (_, index) => {
        const x = index % MAP_COLS
        const y = Math.floor(index / MAP_COLS)
        const room = rooms.find((item) => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h)
        const passage = compound.map.passages.some((item) => x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height)
        const entrance = compound.map.entrances.some((point) => point.x === x && point.y === y)
        const guestHere = visit.guest.position.x === x && visit.guest.position.y === y
        const trap = traps.find((item) => item.x === x && item.y === y)
        const discovered = trap && (trap.visibility !== 'hidden' || canRevealHiddenTraps(visit, 'owner') || equipmentDetectsTrap(visit.equipment, trap, visit.guest.position))
        const gas = traps.find((item) => item.trapType === 'gas' && (visit.trapStates[item.id]?.triggered && visit.trapStates[item.id]?.gasTurnsRemaining > 0 || equipmentDetectsTrap(visit.equipment, item, visit.guest.position)) && Math.max(Math.abs(item.x - x), Math.abs(item.y - y)) <= (item.effect?.radius ?? 1))
        return <div key={`${x}-${y}`} className={`visit-tile ${room ? 'tile-room' : ''} ${passage ? 'tile-passage' : ''} ${entrance ? 'tile-entrance' : ''} ${gas ? 'tile-gas' : ''}`}>
          {room && x === room.x && y === room.y && <span className="visit-room-label">{room.label}</span>}
          {entrance && <span className="visit-entrance-label">כניסה</span>}
          {discovered && <span className={`visit-trap visit-trap-${trap.trapType}`} title={TRAP_TYPES[trap.trapType]?.name}>{trapColors[trap.trapType]}</span>}
          {guestHere && <span className="visit-guest" aria-label="מיקום האורח"><i /></span>}
        </div>
      })}
    </div>
  </div>
}

export default function VisitGame({ compound, initialVisit, onHome, onRestart }) {
  const [visit, setVisit] = useState(initialVisit)
  const [auto, setAuto] = useState(false)
  const [perkStore, setPerkStore] = useState(() => loadPerkStore())
  const [perkNotice, setPerkNotice] = useState('')
  const visitRef = useRef(visit)
  const terminal = visit.outcome !== 'active'

  useEffect(() => { visitRef.current = visit }, [visit])

  useEffect(() => {
    if (!auto || terminal || visit.pendingAction) return undefined
    const timer = window.setInterval(() => setVisit((current) => advanceVisit(compound, current)), 650)
    return () => window.clearInterval(timer)
  }, [auto, compound, terminal, visit.pendingAction])

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
  const latestDamage = [...visit.events].reverse().find((entry) => entry.type === 'damage' && entry.turn === guest.turns)
  const ownerMapSelected = visit.perks?.selections?.owner?.includes('trap-map') === true
  const ownerMapActive = canRevealHiddenTraps(visit, 'owner')
  const detectedTraps = compound.items.filter((item) => item.type === 'trap' && equipmentDetectsTrap(visit.equipment, item, guest.position))
  const pendingTrap = visit.pendingAction ? compound.items.find((item) => item.id === visit.pendingAction.trapId) : null
  const pendingTools = pendingTrap ? toolsForTrapEncounter(visit.equipment, pendingTrap) : []
  const detectionDescription = (trap) => trap.trapType === 'door'
    ? trap.effect?.openMode === 'key' ? 'דלת זו דורשת מפתח; ערכת הדלתות אינה פותחת אותה.' : `נעילה מתוזמנת: ${trap.effect?.lockDuration ?? 1} תורות.`
    : trap.trapType === 'gas' ? `אזור גז ברדיוס ${trap.effect?.radius ?? 1}.`
      : trap.trapType === 'floor' ? 'זוהתה רצפה נופלת.' : 'זוהתה מלכודת חשמלית.'
  const status = { active: visit.stage === 'outbound' ? 'בדרך ליעד' : 'בדרך ליציאה', completed: 'הביקור הושלם', dead: 'האורח הובס', stalled: 'המסלול נחסם' }[visit.outcome]

  function leaveVisit() {
    setAuto(false)
    if (visit.outcome === 'active') saveActiveVisit(compound, visit)
    else saveVisitResult(visit)
    onHome(visit)
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
    <section className="visit-layout">
      <div className="visit-world-panel">
        <div className="visit-panel-heading"><div><span>אורח #{visit.id.slice(-5)}</span><h2>מבט על המתחם</h2></div><span className={`visit-live ${terminal ? 'visit-ended' : ''}`}><i /> {status}</span></div>
        <VisitMap compound={compound} visit={visit} />
        <div className="visit-legend"><span><i className="legend-guest" /> אורח</span><span><i className="legend-trap" /> מלכודת ידועה</span><span><i className="legend-gas" /> אזור גז</span></div>
      </div>
      <aside className="visit-side-panel">
        <section className="guest-card"><span className="visit-kicker">מצב האורח</span><h2>{guest.name}</h2><div className="guest-health"><span>נקודות חיים</span><b>{guest.health} / 100 {latestDamage && <em className="damage-pop">−{latestDamage.amount}</em>}</b></div><div className="health-track"><i style={{ width: `${guest.health}%` }} /></div>{guest.gasExposure?.length > 0 && <div className="gas-exposure">חשוף לגז · נותרו {guest.gasTurnsRemaining} תורות</div>}<div className="guest-state"><span>{guest.status || status}</span><b>תור {guest.turns}</b></div><div className="progress-copy"><span>התקדמות</span><b>{guest.progress}%</b></div><div className="visit-progress"><i style={{ width: `${guest.progress}%` }} /></div></section>
        <section className="visit-controls"><span className="visit-kicker">שליטה בביקור</span>{ownerMapSelected && <div className="visit-perk-control"><b>מפת המלכודות</b>{ownerMapActive ? <span>פעילה לבעל המתחם עד סוף הביקור</span> : <><span>שימוש אחד · עד סוף הביקור</span><button disabled={terminal} onClick={activateTrapMap}>הפעילו מפת מלכודות</button></>}{perkNotice && <small role="status">{perkNotice}</small>}</div>}{detectedTraps.length > 0 && <div className="equipment-detections" aria-live="polite"><b>סכנות שזוהו בקרבת מקום</b>{detectedTraps.map((trap) => <span key={trap.id}>{EQUIPMENT_CATALOG[Object.values(visit.equipment?.tools ?? {}).find((tool) => EQUIPMENT_CATALOG[tool.id]?.compatibleTrapTypes.includes(trap.trapType))?.id]?.name}: {detectionDescription(trap)}</span>)}</div>}<button className="visit-step" disabled={terminal || visit.pendingAction} onClick={() => setVisit((current) => advanceVisit(compound, current))}>התקדם תור אחד <b>←</b></button><button className="visit-auto" disabled={terminal || visit.pendingAction} onClick={() => setAuto((value) => !value)}>{auto ? 'השהה תנועה' : 'הפעל תנועה אוטומטית'}</button>{visit.pendingAction && pendingTrap && <div className="pending-trap"><b>{visit.pendingAction.kind === 'auto-trap' ? 'המלכודת עומדת לפעול' : 'המלכודת ממתינה להחלטה'}</b><p>{pendingTrap.name}</p>{pendingTrap.trapType === 'door' && <small>{detectionDescription(pendingTrap)}</small>}{pendingTools.map((tool) => <button key={tool.id} onClick={() => setVisit((current) => resolvePendingTrap(compound, current, true, tool.id))}>השתמשו ב־{EQUIPMENT_CATALOG[tool.id].name} והפעילו ({tool.usesRemaining} שימושים)</button>)}<button onClick={() => setVisit((current) => resolvePendingTrap(compound, current, true))}>{visit.pendingAction.kind === 'auto-trap' ? 'הפעל והמשך בלי כלי' : 'הפעל בלי כלי'}</button>{visit.pendingAction.kind !== 'auto-trap' && <button onClick={() => setVisit((current) => resolvePendingTrap(compound, current, false))}>דלג</button>}</div>}{terminal && <button className="visit-restart" onClick={() => { setAuto(false); onRestart() }}>התחילו ביקור חדש</button>}</section>
        {Object.keys(visit.equipment?.tools ?? {}).length > 0 && <section className="visit-equipment-inventory"><span className="visit-kicker">תיק הכלים</span>{Object.values(visit.equipment.tools).map((tool) => <div key={tool.id}><span>{EQUIPMENT_CATALOG[tool.id]?.name ?? tool.id} · דרגה {tool.upgradeLevel}</span><b>{tool.usesRemaining} שימושים</b></div>)}</section>}
        <section className="visit-summary"><span className="visit-kicker">תוצאות בזמן אמת</span><div><span>צעדים</span><b>{guest.stepsTaken}</b></div><div><span>מלכודות שהופעלו</span><b>{trapsFound}</b></div><div><span>נזק מצטבר</span><b>{guest.damageTaken}</b></div><div><span>חיפושי מסלול מחדש</span><b>{visit.reroutes}</b></div></section>
        <section className="visit-log"><span className="visit-kicker">יומן ביקור</span>{visit.events.length ? <ol>{[...visit.events].reverse().slice(0, 5).map((entry, index) => <li key={`${entry.turn}-${entry.type}-${index}`}><i />{entry.message}</li>)}</ol> : <p>הביקור התחיל. האורח ממתין לפקודה.</p>}</section>
      </aside>
    </section>
  </main>
}
