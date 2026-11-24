import { useMemo, useState } from 'react'
import { EQUIPMENT_CATALOG, loadEquipmentStore, saveEquipmentStore, selectTools, validateToolSelection } from './equipment.js'
import { ActionFooter, GameShell, MessageLayer } from './GameShell.jsx'
import './EquipmentSelection.css'
import './PreparationUI.css'

export default function EquipmentSelection({ onStart, onCancel, stepLabel = 'שלב שני', continueLabel = 'שמירת התיק וכניסה לבית', startError = '' }) {
  const [store, setStore] = useState(() => loadEquipmentStore())
  const [selected, setSelected] = useState(store.selectedToolIds)
  const [notice, setNotice] = useState('')
  const tools = useMemo(() => Object.values(EQUIPMENT_CATALOG), [])
  const equipmentFamilyNames = { electric: 'חשמל', gas: 'גז', floor: 'רצפה נופלת', door: 'דלתות' }
  const usedSpace = validateToolSelection(store, selected).usedSpace ?? 0
  function effectLabel(tool, level) {
    if (tool.impact.kind === 'reduce-next-damage') return `הפחתת ${tool.impact.amount + level * 5} נזק בהפעלה אחת`
    if (tool.impact.kind === 'reduce-damage-per-turn') return `הפחתת ${tool.impact.amount + level * 5} נזק בכל תור חשיפה`
    if (tool.impact.kind === 'prevent-restart') return 'מונע חזרה לכניסה; העצירה נשארת'
    return `קיצור נעילה מתוזמנת ב־${tool.impact.turns + level} תורות`
  }

  function toggle(id) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
    const result = selectTools(store, next)
    if (!result.ok) { setNotice('הציוד חורג מקיבולת התיק. הסירו כלי או שדרגו את התיק.'); return }
    setSelected(result.store.selectedToolIds)
    setNotice('')
  }

  function start() {
    const result = selectTools(store, selected)
    if (!result.ok || !saveEquipmentStore(result.store)) { setNotice('לא ניתן לשמור את בחירת הציוד במכשיר.'); return }
    setStore(result.store)
    onStart(selected)
  }

  return <GameShell className="preparation-game-shell equipment-game-shell"><main className="equipment-selection" dir="rtl">
    <header><button onClick={onCancel}>← חזרה</button><div><span>הכנות לביקור · {stepLabel}</span><h1>תיק הכלים של האורח</h1></div><b>{usedSpace} / {store.backpackCapacity} מקום</b></header>
    <p className="equipment-intro">בחרו ציוד לפני הכניסה. הכלים והשימושים שלהם יישמרו בתוך הביקור, וניתן יהיה להפעיל אותם ידנית במפגש מתאים.</p>
    <div className="equipment-families" aria-label="ארבע משפחות הציוד">{tools.map((tool) => <span key={tool.id}><i>{({ electric: '⚡', gas: '◉', floor: '▱', door: '▣' })[tool.compatibleTrapTypes[0]]}</i>{equipmentFamilyNames[tool.compatibleTrapTypes[0]]}</span>)}</div>
    <section className="equipment-grid">{tools.map((tool) => {
      const chosen = selected.includes(tool.id)
      const level = store.upgrades[tool.id] ?? tool.upgradeLevel
      return <article key={tool.id} className={chosen ? 'equipment-card chosen' : 'equipment-card'}>
        <div className="equipment-card-top"><span>{tool.type === 'protection' ? 'ציוד הגנה' : 'כלי'}</span><b>{tool.space} מקום</b></div>
        <h2>{tool.name}</h2><p>{tool.description}</p>
        <dl><div><dt>מתאים למלכודת</dt><dd>{tool.compatibleTrapTypes.map((type) => ({ electric: 'חשמלית', gas: 'גז', floor: 'רצפה נופלת', door: 'דלת ננעלת' })[type]).join(', ')}</dd></div><div><dt>שימושים לביקור</dt><dd>{tool.usesPerVisit + level}</dd></div><div><dt>שדרוג {level}</dt><dd>{effectLabel(tool, level)}</dd></div><div><dt>זיהוי</dt><dd>{level >= tool.detection.minUpgradeLevel ? `סכנה סמוכה · טווח ${tool.detection.radius + Math.max(0, level - tool.detection.minUpgradeLevel)}` : `נפתח בדרגה ${tool.detection.minUpgradeLevel}`}</dd></div></dl>
        <button onClick={() => toggle(tool.id)}>{chosen ? 'הסרה מהתיק' : 'הוספה לתיק'}</button>
      </article>
    })}</section>
    <MessageLayer messages={[...(notice ? [{ id: 'equipment-notice', text: notice, type: 'status' }] : []), ...(startError ? [{ id: 'equipment-error', text: startError, type: 'error' }] : [])]} className="preparation-inline-message" />
    <ActionFooter className="equipment-selection-footer"><span>המלכודות יופעלו לפי חוקי הביקור הקיימים; הכלי אינו מנטרל אותן אוטומטית.</span><button onClick={start}>{continueLabel} ←</button></ActionFooter>
  </main></GameShell>
}
