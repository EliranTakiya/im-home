import { useEffect, useMemo, useState } from 'react'
import { BUILD_BUDGET, MAP_COLS, MAP_ROWS, ROOM_COST, changeTrapType, loadSavedItems, moveItem, placeRoom, placeTrap, removeItem, saveCompound as saveCompoundData, spentBudget, toggleTrapVisibility as toggleTrapVisibilityInItems, updateTrapSettings } from './compound.js'
import { calculateTrapPrice, DEFAULT_TRAP_TYPE, TRAP_TYPES, TRAP_TYPE_LIST } from './traps.js'
import './Builder.css'

function MapLegend() {
  return <div className="map-legend" aria-label="מקרא"><span><i className="legend-room" /> חדר</span><span><i className="legend-corridor" /> מסדרון</span><span><i className="legend-wall" /> קיר</span><span><i className="legend-trap" /> מלכודת</span></div>
}

function CompoundMap({ items, tool, moveId, onCellClick, onItemClick }) {
  const cells = useMemo(() => Array.from({ length: MAP_ROWS * MAP_COLS }, (_, index) => {
    const x = index % MAP_COLS
    const y = Math.floor(index / MAP_COLS)
    const item = items.find((entry) => x >= entry.x && x < entry.x + entry.w && y >= entry.y && y < entry.y + entry.h)
    const entrance = x === 5 && y === MAP_ROWS - 1
    const corridor = !item && (y === 4 || (x === 5 && y >= 5))
    const gasZone = !item && items.some((entry) => entry.type === 'trap' && entry.trapType === 'gas' && Math.max(Math.abs(x - entry.x), Math.abs(y - entry.y)) <= entry.effect.radius)
    return { x, y, item, entrance, corridor, gasZone }
  }), [items])

  return <div className={`map-frame ${tool ? `tool-${tool}` : ''} ${moveId ? 'move-mode' : ''}`}>
    <div className="map-coordinates map-coordinates-top">{Array.from({ length: MAP_COLS }, (_, i) => <span key={i}>{String.fromCharCode(65 + i)}</span>)}</div>
    <div className="map-with-rows"><div className="map-coordinates map-coordinates-side">{Array.from({ length: MAP_ROWS }, (_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div>
      <div className="compound-grid" style={{ '--cols': MAP_COLS, '--rows': MAP_ROWS }}>
        {cells.map(({ x, y, item, entrance, corridor, gasZone }) => <button
          key={`${x}-${y}`}
          className={`map-cell ${item ? `cell-${item.type}` : ''} ${item?.type === 'trap' ? `trap-kind-${item.trapType}` : ''} ${item?.type === 'trap' && item.visibility === 'hidden' ? 'cell-trap-hidden' : ''} ${gasZone ? 'cell-gas-zone' : ''} ${corridor ? 'cell-corridor' : ''} ${entrance ? 'cell-entrance' : ''} ${moveId && item?.id === moveId ? 'cell-selected' : ''} ${!item && !corridor && !entrance && !gasZone ? 'cell-open' : ''}`}
          aria-label={item ? `${item.name || item.label || 'מלכודת'}${item.type === 'trap' ? item.visibility === 'hidden' ? ', נסתרת' : ', גלויה' : ''}, ${String.fromCharCode(65 + x)}${y + 1}` : gasZone ? 'אזור השפעה של מלכודת גז' : entrance ? 'כניסה ראשית' : corridor ? 'מסדרון, משבצת פנויה' : 'שטח פנוי לבנייה'}
          onClick={() => item ? onItemClick(item) : onCellClick(x, y)}
          type="button"
        >{item?.type === 'room' && x === item.x && y === item.y && <span className="room-name">{item.label}</span>}
          {item?.type === 'trap' && <><span className="trap-mark" aria-hidden="true">{TRAP_TYPES[item.trapType]?.glyph || '⌁'}</span>{item.visibility === 'hidden' && <span className="trap-hidden-tag">נסתרת</span>}</>}
          {entrance && <span className="entrance-mark">כניסה</span>}
          {corridor && !item && x === 0 && <span className="corridor-mark">מסדרון</span>}
        </button>)}
      </div>
    </div>
    <div className="entrance-note"><span className="entrance-arrow">↑</span> כניסה ראשית · מעבר פתוח</div>
  </div>
}

function BuilderToolbar({ tool, setTool, moveId, setMoveId, selectedItem, selectedTrapType, onSelectTrapType, onChangeTrapType, onUpdateTrapSettings, onToggleTrapVisibility, onRemove, onSave, savedMessage }) {
  const selectedDefinition = TRAP_TYPES[selectedTrapType]
  const selectedTrapDefinition = selectedItem?.type === 'trap' ? TRAP_TYPES[selectedItem.trapType] : null

  return <aside className="builder-toolbar">
    <div className="toolbar-heading"><span className="toolbar-kicker">ערכת בנייה</span><h2>מה נבנה?</h2></div>
    <button className={`build-option ${tool === 'room' ? 'option-active' : ''}`} onClick={() => { setTool(tool === 'room' ? null : 'room'); setMoveId(null) }}>
      <span className="option-icon room-option-icon">⌂</span><span className="option-copy"><b>חדר חדש</b><small>חדר קטן · 2×2 משבצות</small></span><strong>{ROOM_COST}<small> מטבעות</small></strong>
    </button>
    <button className={`build-option ${tool === 'trap' ? 'option-active' : ''}`} onClick={() => { setTool(tool === 'trap' ? null : 'trap'); setMoveId(null) }}>
      <span className={`option-icon trap-option-icon trap-kind-${selectedDefinition.id}`}>{selectedDefinition.glyph}</span><span className="option-copy"><b>הוספת מלכודת</b><small>{selectedDefinition.name}</small></span><strong>{calculateTrapPrice({ trapType: selectedDefinition.id, effect: selectedDefinition.defaultEffect })}<small> מטבעות</small></strong>
    </button>
    {tool === 'trap' && <div className="trap-type-picker" aria-label="בחירת סוג מלכודת">{TRAP_TYPE_LIST.map((definition) => <button key={definition.id} className={`trap-type-choice ${selectedTrapType === definition.id ? 'type-choice-active' : ''}`} onClick={() => onSelectTrapType(definition.id)}><span className={`trap-kind-${definition.id}`}>{definition.glyph}</span><b>{definition.name}</b><small>{calculateTrapPrice({ trapType: definition.id, effect: definition.defaultEffect })} מטבעות</small></button>)}</div>}
    <div className="tool-divider" />
    <button className={`edit-option ${moveId ? 'edit-active' : ''}`} onClick={() => { setMoveId(moveId ? null : 'choose'); setTool(null) }}><span>✥</span> הזזת פריט</button>
    <button className="edit-option remove-option" onClick={onRemove}><span>⌫</span> הסרת פריט נבחר</button>
    {selectedItem && <div className="selected-item-card"><span>פריט נבחר</span><b>{selectedItem.type === 'trap' ? selectedItem.name : selectedItem.label}</b>{selectedItem.type === 'trap' ? <>
      <p>{selectedItem.description}</p><p>מחיר: <strong>{selectedItem.price}</strong> מטבעות · גילוי: <strong>{selectedItem.visibility === 'hidden' ? 'נסתרת' : 'גלויה'}</strong></p>
      <label className="trap-setting">שם המלכודת<input value={selectedItem.name} maxLength={32} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { name: event.target.value })} /></label>
      <label className="trap-setting trap-description-setting">תיאור<textarea value={selectedItem.description} maxLength={160} rows={2} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { description: event.target.value })} /></label>
      <label className="trap-setting">סוג המלכודת<select value={selectedItem.trapType} onChange={(event) => onChangeTrapType(selectedItem.id, event.target.value)}>{TRAP_TYPE_LIST.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label>
      <label className="trap-setting">מצב גילוי<select value={selectedItem.visibility} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { visibility: event.target.value })}><option value="visible">גלויה</option><option value="hidden">נסתרת</option></select></label>
      {selectedTrapDefinition.effectOptions && <label className="trap-setting">השפעה<select value={selectedItem.effect.kind} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { kind: event.target.value } })}>{selectedTrapDefinition.effectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
      {selectedItem.trapType === 'electric' && <><label className="trap-setting">עוצמת פגיעה<select value={selectedItem.effect.strength} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { strength: Number(event.target.value) } })}>{selectedTrapDefinition.strengthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="trap-setting">משך עצירה<select value={selectedItem.effect.durationTurns} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { durationTurns: Number(event.target.value) } })}>{selectedTrapDefinition.durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></>}
      {selectedItem.trapType === 'gas' && <><label className="trap-setting">עוצמת הגז<select value={selectedItem.effect.strength} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { strength: Number(event.target.value) } })}>{selectedTrapDefinition.strengthOptions.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.value * 10} נזק לתור</option>)}</select></label><label className="trap-setting">רדיוס האזור<select value={selectedItem.effect.radius} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { radius: Number(event.target.value) } })}>{selectedTrapDefinition.radiusOptions.map((radius) => <option key={radius} value={radius}>{radius} משבצות</option>)}</select></label><label className="trap-setting">משך השפעה<select value={selectedItem.effect.durationTurns} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { durationTurns: Number(event.target.value) } })}>{selectedTrapDefinition.durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></>}
      {selectedItem.trapType === 'door' && <><label className="trap-setting">משך נעילה<select disabled={selectedItem.effect.openMode === 'key'} value={selectedItem.effect.lockDuration} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { lockDuration: Number(event.target.value) } })}>{selectedTrapDefinition.durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="trap-setting">פתיחת הדלת<select value={selectedItem.effect.openMode} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { effect: { openMode: event.target.value } })}>{selectedTrapDefinition.openModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></>}
      <label className="trap-setting">תנאי הפעלה<select value={selectedItem.activation.event} onChange={(event) => onUpdateTrapSettings(selectedItem.id, { activation: { event: event.target.value } })}>{selectedTrapDefinition.activationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <button className="visibility-toggle" onClick={onToggleTrapVisibility}>הפכי ל{selectedItem.visibility === 'hidden' ? 'גלויה' : 'נסתרת'}</button>
      <p className="prototype-note">המחיר מתעדכן לפי ההגדרות. הנתונים נשמרים למערכת משחק עתידית; אין כאן עדיין הפעלה של אורחים.</p>
    </> : <p>אפשר להזיז את החדר או להסיר אותו.</p>}</div>}
    <div className="toolbar-hint"><span>ⓘ</span><p>חדרים ומלכודות אפשר להזיז או להסיר. מלכודות אפשר להציב במסדרון ובשטח פנוי.</p></div>
    <button className="save-button" onClick={onSave}><span>{savedMessage ? '✓ נשמר' : 'שמירת המתחם'}</span><span>⌑</span></button>
  </aside>
}

export default function Builder({ onHome }) {
  const [items, setItems] = useState(() => loadSavedItems())
  const [tool, setTool] = useState(null)
  const [moveId, setMoveId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedTrapType, setSelectedTrapType] = useState(DEFAULT_TRAP_TYPE)
  const [savedMessage, setSavedMessage] = useState(false)
  const [notice, setNotice] = useState('')
  const selectedItem = items.find((item) => item.id === selectedId)
  const spent = spentBudget(items)
  const remaining = BUILD_BUDGET - spent

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function handleCellClick(x, y) {
    if (moveId && moveId !== 'choose') {
      const result = moveItem(items, moveId, x, y)
      if (result.error) { setNotice(result.error === 'route' ? 'ההזזה חוסמת את הדרך לכניסה. בחרו מקום אחר.' : 'אי אפשר להעביר פריט למקום תפוס או מחוץ למפה.'); return }
      setItems(result.items)
      setSelectedId(moveId); setMoveId(null); setNotice('הפריט הוזז.')
      return
    }
    if (tool === 'room') {
      if (remaining < ROOM_COST) { setNotice('אין מספיק תקציב לחדר נוסף.'); return }
      const newId = `room-${Date.now()}`
      const result = placeRoom(items, x, y, newId)
      if (result.error) { setNotice('בחרו שטח פנוי מחוץ למסלול הכניסה.'); return }
      setItems(result.items); setSelectedId(result.item.id); setTool(null); setNotice('נוסף חדר חדש.')
      return
    }
    if (tool === 'trap') {
      if (remaining < TRAP_TYPES[selectedTrapType].price) { setNotice('אין מספיק תקציב למלכודת נוספת.'); return }
      const result = placeTrap(items, x, y, `trap-${Date.now()}`, selectedTrapType)
      if (result.error) { setNotice(result.error === 'route' ? 'הצבה זו מונעת מעבר עוקף לכניסה. בחרו מקום אחר.' : 'בחרו מסדרון או שטח פנוי, והשאירו את הכניסה פתוחה.') ; return }
      setItems(result.items); setSelectedId(result.item.id); setTool(null); setNotice('נוספה מלכודת. אפשר לזהות אותה ולעקוף אותה.')
    }
  }

  function handleItemClick(item) {
    if (moveId === 'choose') { setMoveId(item.id); setSelectedId(item.id); if (item.type === 'trap') setSelectedTrapType(item.trapType); setNotice('בחרו משבצת פנויה להזזת הפריט.'); return }
    setSelectedId(item.id)
    if (item.type === 'trap') setSelectedTrapType(item.trapType)
    if (moveId) { setMoveId(null); setNotice('בחירת ההזזה בוטלה.'); return }
    if (tool === 'trap') { setNotice('מלכודות מוצבות במסדרון או בשטח פנוי, לא בתוך חדר.'); return }
    if (tool === 'room') { setNotice('כדי להוסיף חדר, בחרו שטח פנוי במפה.'); return }
  }

  function removeSelected() {
    if (!selectedId) { setNotice('בחרו קודם חדר או מלכודת להסרה.'); return }
    setItems((current) => removeItem(current, selectedId))
    setSelectedId(null); setMoveId(null); setNotice('הפריט הוסר והתקציב הוחזר.')
  }

  function toggleTrapVisibility() {
    if (!selectedItem || selectedItem.type !== 'trap') return
    const nextVisibility = selectedItem.visibility === 'hidden' ? 'visible' : 'hidden'
    setItems((current) => toggleTrapVisibilityInItems(current, selectedId))
    setNotice(nextVisibility === 'hidden' ? 'המלכודת הוגדרה כנסתרת.' : 'המלכודת הוגדרה כגלויה.')
  }

  function updateSelectedTrapSettings(id, patch) {
    const updatedItems = updateTrapSettings(items, id, patch)
    if (spentBudget(updatedItems) > BUILD_BUDGET) { setNotice('ההגדרה חורגת מהתקציב הפנוי. הסירו פריט או בחרו השפעה זולה יותר.'); return }
    setItems(updatedItems)
  }

  function updateSelectedTrapType(id, trapType) {
    const updatedItems = changeTrapType(items, id, trapType)
    if (spentBudget(updatedItems) > BUILD_BUDGET) { setNotice('אין מספיק תקציב לסוג המלכודת הזה.'); return }
    setItems(updatedItems)
    setSelectedTrapType(trapType)
    setNotice('סוג המלכודת והמחיר עודכנו.')
  }

  function saveCompound() {
    try { saveCompoundData(items); setSavedMessage(true); setNotice('המתחם נשמר בדפדפן הזה.') }
    catch { setNotice('שמירה נכשלה. בדקו שהדפדפן מאפשר אחסון מקומי.') }
    window.setTimeout(() => setSavedMessage(false), 2200)
  }

  return <main className="builder-screen" dir="rtl">
    <header className="builder-topbar"><div className="builder-brand"><span className="builder-logo">⌂</span><span>I’M <b>HOME</b></span><i /> <span className="builder-location">עורך המתחם</span></div><div className="prototype-tag"><i /> סביבת בנייה · אבטיפוס</div><button className="home-button" onClick={onHome}><span>←</span> חזרה למסך הבית</button></header>
    <section className="builder-heading"><div><span className="builder-kicker">המתחם שלך / עריכה</span><h1>בונים את <em>הבית.</em></h1><p>תכננו את המרחב, השאירו מעבר פתוח, והגנו על מה שחשוב.</p></div><div className="budget-card"><span>תקציב בנייה</span><b>{remaining}<small> / {BUILD_BUDGET}</small></b><div className="budget-track"><i style={{ width: `${Math.max(0, remaining / BUILD_BUDGET * 100)}%` }} /></div><small className="budget-note">{spent} מטבעות נוצלו · תקציב אבטיפוס</small></div></section>
    <section className="builder-layout">
      <div className="map-panel"><div className="map-panel-head"><div><span className="map-kicker">מבט על · אזור מגורים</span><h2>מתחם 01 <i /> <small>הגבעה הצפונית</small></h2></div><span className="map-scale">12 × 8</span></div>
        <div className="map-instruction">{moveId && moveId !== 'choose' ? 'בחרו משבצת פנויה להעברת הפריט' : tool === 'room' ? 'בחרו את הפינה השמאלית העליונה של החדר' : tool === 'trap' ? 'בחרו משבצת במסדרון או בשטח פנוי' : moveId === 'choose' ? 'בחרו פריט במפה כדי להזיז אותו' : 'בחרו כלי בנייה או פריט במפה לעריכה'}</div>
        <CompoundMap items={items} tool={tool} moveId={moveId && moveId !== 'choose' ? moveId : null} onCellClick={handleCellClick} onItemClick={handleItemClick} />
        <div className="map-panel-foot"><MapLegend /><span>כניסה אחת נשארת פתוחה בכל עת</span></div>
      </div>
      <BuilderToolbar tool={tool} setTool={setTool} moveId={moveId} setMoveId={setMoveId} selectedItem={selectedItem} selectedTrapType={selectedTrapType} onSelectTrapType={setSelectedTrapType} onChangeTrapType={updateSelectedTrapType} onUpdateTrapSettings={updateSelectedTrapSettings} onToggleTrapVisibility={toggleTrapVisibility} onRemove={removeSelected} onSave={saveCompound} savedMessage={savedMessage} />
    </section>
    <div className="builder-footer"><span>המפה נשמרת מקומית בדפדפן</span><span>לכל הגנה יש דרך להתמודד איתה <i /></span><span>אב טיפוס 0.2</span></div>
    {notice && <div className="builder-notice" role="status">{notice}</div>}
  </main>
}
