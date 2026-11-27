import { useEffect, useMemo, useRef, useState } from 'react'
import { ROOM_COST, calculateBuildBudget, changeTrapType, createCompoundData, loadCompound, loadSavedItems, moveItem, placePassageTile, placeRoom, placeTrap, removeItem, removePassageTile, saveCompound as saveCompoundData, spentBudget, toggleTrapVisibility as toggleTrapVisibilityInItems, updateTrapSettings } from './compound.js'
import { calculateTrapPrice, DEFAULT_TRAP_TYPE, TRAP_TYPES, TRAP_TYPE_LIST } from './traps.js'
import { analyzeCompoundPaths } from './navigation.js'
import { BUILDER_MAP_METRICS, LANDSCAPE_BUILDER_MAP_METRICS, calculateBuilderMapGeometry } from './builderMapSizing.js'
import { ActionFooter, FloatingInspector, MapFirstLayout, MessageLayer, WorkspaceFrame } from './GameShell.jsx'
import './Builder.css'
import './BuilderWorkspace.css'

function MapLegend({ className = '' }) {
  return <div className={`map-legend ${className}`} aria-label="מקרא"><span><i className="legend-room" /> חדר</span><span><i className="legend-corridor" /> מסדרון</span><span><i className="legend-wall" /> קיר</span><span><i className="legend-trap" /> מלכודת</span></div>
}

function BuilderBudget({ budget, remaining, spent, compact = false }) {
  return <div className={`budget-card ${compact ? 'builder-landscape-budget' : ''}`} aria-label={`תקציב בנייה: ${remaining} זמינים מתוך ${budget}; ${spent} נוצלו`}>
    <span>תקציב בנייה · דינמי</span><b>{remaining}<small> / {budget}</small></b>
    <div className="budget-track"><i style={{ width: `${Math.max(0, remaining / budget * 100)}%` }} /></div>
    <small className="budget-note">{compact ? `${spent} מטבעות נוצלו` : `${spent} מטבעות נוצלו · התקציב גדל עם השטח הפעיל`}</small>
  </div>
}

function CompoundMap({ items, passages, map, tool, moveId, onCellClick, onItemClick, entranceLabelLeft }) {
  const columns = map.width
  const rows = map.height
  const cells = useMemo(() => Array.from({ length: rows * columns }, (_, index) => {
    const x = index % columns
    const y = Math.floor(index / columns)
    const item = items.find((entry) => x >= entry.x && x < entry.x + entry.w && y >= entry.y && y < entry.y + entry.h)
    const entrance = map.entrances.some((point) => point.x === x && point.y === y)
    const corridor = !item && passages.some((passage) => x >= passage.x && x < passage.x + passage.width && y >= passage.y && y < passage.y + passage.height)
    const gasZone = !item && items.some((entry) => entry.type === 'trap' && entry.trapType === 'gas' && Math.max(Math.abs(x - entry.x), Math.abs(y - entry.y)) <= entry.effect.radius)
    return { x, y, item, entrance, corridor, gasZone }
  }), [items, passages, columns, rows, map.entrances])

  return <div className={`map-frame ${tool ? `tool-${tool}` : ''} ${moveId ? 'move-mode' : ''}`} style={{ '--cols': columns, '--rows': rows, '--entrance-label-left': `${entranceLabelLeft}px` }}>
    <div className="map-coordinates map-coordinates-top">{Array.from({ length: columns }, (_, i) => <span key={i}>{String.fromCharCode(65 + i)}</span>)}</div>
    <div className="map-with-rows"><div className="map-coordinates map-coordinates-side">{Array.from({ length: rows }, (_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div>
      <div className="compound-grid" style={{ '--cols': columns, '--rows': rows }}>
        {cells.map(({ x, y, item, entrance, corridor, gasZone }) => <button
          key={`${x}-${y}`}
          className={`map-cell ${item ? `cell-${item.type}` : ''} ${item?.type === 'trap' ? `trap-kind-${item.trapType}` : ''} ${item?.type === 'trap' && item.visibility === 'hidden' ? 'cell-trap-hidden' : ''} ${gasZone ? 'cell-gas-zone' : ''} ${corridor ? 'cell-corridor' : ''} ${entrance ? 'cell-entrance' : ''} ${moveId && item?.id === moveId ? 'cell-selected' : ''} ${!item && !corridor && !entrance && !gasZone ? 'cell-wall' : ''}`}
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

function BuilderToolbar({ tool, setTool, moveId, setMoveId, selectedItem, selectedTrapType, onSelectTrapType, onChangeTrapType, onUpdateTrapSettings, onToggleTrapVisibility, onRemove, onSave, savedMessage, saveDisabled, open = false, onClose, floating = false }) {
  const selectedDefinition = TRAP_TYPES[selectedTrapType]
  const selectedTrapDefinition = selectedItem?.type === 'trap' ? TRAP_TYPES[selectedItem.trapType] : null

  return <aside id="builder-tools" className={`builder-toolbar ${floating ? 'builder-toolbar-floating' : ''} ${open ? 'toolbar-open' : ''}`}>
    <div className="toolbar-heading"><div><span className="toolbar-kicker">ערכת בנייה</span><h2>מה נבנה?</h2></div>{!floating && <button type="button" className="toolbar-close" onClick={onClose} aria-label="סגירת כלי הבנייה">×</button>}</div>
    <button className={`build-option ${tool === 'room' ? 'option-active' : ''}`} onClick={() => { setTool(tool === 'room' ? null : 'room'); setMoveId(null) }}>
      <span className="option-icon room-option-icon">⌂</span><span className="option-copy"><b>חדר חדש</b><small>חדר קטן · 2×2 משבצות</small></span><strong>{ROOM_COST}<small> מטבעות</small></strong>
    </button>
    <button className={`build-option ${tool === 'passage' ? 'option-active' : ''}`} onClick={() => { setTool(tool === 'passage' ? null : 'passage'); setMoveId(null) }}>
      <span className="option-icon">┄</span><span className="option-copy"><b>הוספת מסדרון</b><small>הוסיפו משבצות וחברו בין אזורים</small></span><strong>נתיב</strong>
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
    <button className="save-button" onClick={onSave} disabled={saveDisabled}><span>{savedMessage ? '✓ נשמר' : 'שמירת המתחם'}</span><span>⌑</span></button>
  </aside>
}

function RouteAnalysis({ analysis, onClose, className = '' }) {
  const coord = (point) => `${String.fromCharCode(65 + point.x)}${point.y + 1}`
  return <section className={`route-analysis ${className} ${analysis.reachable ? '' : 'route-analysis-invalid'}`} aria-live="polite">
    <div><span className="map-kicker">ניתוח מסלולים</span><b>{analysis.reachable ? 'היעד נגיש' : 'אין מסלול חוקי ליעד'}</b>{onClose && <button type="button" className="route-analysis-close" onClick={onClose}>חזרה למפה</button>}</div>
    <div className="route-analysis-stats">
      <span><b>{analysis.shortestRisk ?? '—'}</b> סיכון במסלול הקצר</span>
      <span><b>{analysis.safestRisk ?? '—'}</b> סיכון במסלול הבטוח ביותר ({analysis.safestLength ?? 0} צעדים)</span>
      <span><b>{analysis.routeCountCapped ? `${analysis.routeCount}+` : analysis.routeCount}</b> מסלולים חוקיים</span>
      <span><b>{analysis.minimumSteps ?? '—'}</b> צעדים מינימליים לביקור</span>
      <span><b>{analysis.stepBudget}</b> תקציב צעדים לאורח</span>
      <span><b>{analysis.junctions.length}</b> צמתים</span>
      <span><b>{analysis.trapsOnShortest ?? 0}/{analysis.trapCount}</b> מלכודות במסלול הקצר</span>
      <span><b>{analysis.unreachableRooms ?? 0}</b> חדרים מנותקים</span>
    </div>
    {analysis.junctions.length > 0 && <p>צמתים: {analysis.junctions.slice(0, 8).map(coord).join(' · ')}{analysis.junctions.length > 8 ? ' …' : ''}</p>}
    {analysis.easyBypass && <p className="route-analysis-warning">נמצאה דרך קלה שעוקפת את רוב המלכודות. כדאי לבדוק את המסלול הבטוח ביותר ואת פיזור המלכודות.</p>}
    {!analysis.reachable && <p className="route-analysis-warning">המתחם לא יישמר עד שתיפתח דרך חוקית מהכניסה ליעד.</p>}
  </section>
}

export default function Builder({ onHome }) {
  const mapViewportRef = useRef(null)
  const [mapViewport, setMapViewport] = useState({ width: 0, height: 0, landscape: false })
  const [items, setItems] = useState(() => loadSavedItems())
  const [mapTemplate] = useState(() => loadCompound().map)
  const [passages, setPassages] = useState(() => mapTemplate.passages)
  const [tool, setTool] = useState(null)
  const [moveId, setMoveId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedTrapType, setSelectedTrapType] = useState(DEFAULT_TRAP_TYPE)
  const [savedMessage, setSavedMessage] = useState(false)
  const [notice, setNotice] = useState('')
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const selectedItem = items.find((item) => item.id === selectedId)
  const compound = useMemo(() => createCompoundData(items, { ...mapTemplate, passages }), [items, mapTemplate, passages])
  const routeAnalysis = useMemo(() => analyzeCompoundPaths(compound), [compound])
  const spent = spentBudget(items)
  const budget = calculateBuildBudget(items, passages)
  const remaining = budget - spent

  useEffect(() => {
    const viewport = mapViewportRef.current
    if (!viewport) return undefined
    const measure = () => {
      const { width, height } = viewport.getBoundingClientRect()
      const landscape = window.matchMedia('(orientation: landscape) and (pointer: coarse) and (hover: none)').matches
      setMapViewport((current) => Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 && current.landscape === landscape ? current : { width, height, landscape })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(viewport)
    window.addEventListener('resize', measure, { passive: true })
    window.addEventListener('orientationchange', measure, { passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  const landscapeMap = mapViewport.landscape
  const mapMetrics = landscapeMap ? LANDSCAPE_BUILDER_MAP_METRICS : BUILDER_MAP_METRICS
  const mapGeometry = calculateBuilderMapGeometry(mapViewport.width, mapViewport.height, mapTemplate.width, mapTemplate.height, mapMetrics)
  const mapFitStyle = {
    '--map-fit-width': `${mapGeometry.contentWidth}px`,
    '--map-fit-height': `${mapGeometry.contentHeight}px`,
    '--map-grid-outer-width': `${mapGeometry.contentWidth + 2 * (mapMetrics.gridPadding + mapMetrics.gridBorder)}px`,
    '--map-grid-outer-height': `${mapGeometry.contentHeight + 2 * (mapMetrics.gridPadding + mapMetrics.gridBorder)}px`,
    '--map-grid-track-width': `${mapGeometry.trackWidth}px`,
    '--map-grid-track-height': `${mapGeometry.trackHeight}px`,
    '--map-cell-size': `${mapGeometry.cellSize}px`,
    '--map-cell-width': `${mapGeometry.cellWidth}px`,
    '--map-cell-height': `${mapGeometry.cellHeight}px`,
    '--map-cell-gap': `${mapMetrics.cellGap}px`,
    '--map-grid-padding': `${mapMetrics.gridPadding}px`,
    '--map-grid-border': `${mapMetrics.gridBorder}px`,
    '--map-row-axis-width': `${mapMetrics.rowAxisWidth}px`,
    '--map-row-axis-gap': `${mapMetrics.rowAxisGap}px`,
    '--map-row-axis-offset': `${(mapMetrics.rowAxisWidth + mapMetrics.rowAxisGap) / 2}px`,
    '--map-column-axis-band': `${mapMetrics.columnAxisBand}px`,
    '--map-column-axis-height': `${mapMetrics.columnAxisHeight}px`,
    '--map-entrance-band-height': `${mapMetrics.entranceBandHeight}px`,
    '--map-axis-total': `${mapMetrics.columnAxisBand + mapMetrics.columnAxisHeight + mapMetrics.entranceBandHeight}px`,
  }

  function handleCellClick(x, y) {
    if (moveId && moveId !== 'choose') {
      const result = moveItem(items, moveId, x, y, compound.map)
      if (result.error) { setNotice(result.error === 'route' ? 'ההזזה חוסמת את הדרך לכניסה. בחרו מקום אחר.' : 'אי אפשר להעביר פריט למקום תפוס או מחוץ למפה.'); return }
      setItems(result.items)
      setSelectedId(moveId); setMoveId(null); setNotice('הפריט הוזז.')
      return
    }
    if (tool === 'room') {
      if (remaining < ROOM_COST) { setNotice('אין מספיק תקציב לחדר נוסף.'); return }
      const newId = `room-${Date.now()}`
      const result = placeRoom(items, x, y, newId, compound.map)
      if (result.error) { setNotice('בחרו שטח פנוי מחוץ למסלול הכניסה.'); return }
      setItems(result.items); setSelectedId(result.item.id); setTool(null); setNotice('נוסף חדר חדש.')
      return
    }
    if (tool === 'trap') {
      const mapTile = compound.map.rooms.some((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) || passages.some((passage) => x >= passage.x && x < passage.x + passage.width && y >= passage.y && y < passage.y + passage.height)
      if (!mapTile) { setNotice('אפשר להציב מלכודת בחדר או במסדרון בלבד. בנו מעבר תחילה.'); return }
      if (remaining < TRAP_TYPES[selectedTrapType].price) { setNotice('אין מספיק תקציב למלכודת נוספת.'); return }
      const result = placeTrap(items, x, y, `trap-${Date.now()}`, selectedTrapType, compound.map)
      if (result.error) { setNotice(result.error === 'route' ? 'הצבה זו מונעת מעבר עוקף לכניסה. בחרו מקום אחר.' : 'בחרו מסדרון או שטח פנוי, והשאירו את הכניסה פתוחה.') ; return }
      setItems(result.items); setSelectedId(result.item.id); setTool(null); setNotice('נוספה מלכודת. אפשר לזהות אותה ולעקוף אותה.')
      return
    }
    if (tool === 'passage') {
      const existingPassage = compound.map.passages.find((passage) => x >= passage.x && x < passage.x + passage.width && y >= passage.y && y < passage.y + passage.height)
      if (existingPassage) {
        const removal = removePassageTile(compound.map.passages, x, y)
        if (removal.passages) {
          setPassages(removal.passages)
          setNotice('מקטע המסדרון הוסר. בדקו שהחדרים עדיין מחוברים לכניסה.')
        } else setNotice('זהו מעבר בסיסי ונדרש במתחם. אפשר לערוך את המקטעים הנוספים.')
        return
      }
      if (compound.map.rooms.some((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h)) { setNotice('המשבצת כבר נמצאת בתוך חדר.'); return }
      const result = placePassageTile(compound.map.passages, x, y, compound.map)
      if (result.error) { setNotice('אי אפשר להוסיף מסדרון במשבצת הזו.'); return }
      setPassages(result.passages)
      setNotice('נוספה משבצת מסדרון. המשיכו לחבר אותה לרשת המעברים.')
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
    if (spentBudget(updatedItems) > calculateBuildBudget(updatedItems, passages)) { setNotice('ההגדרה חורגת מהתקציב הפנוי. הסירו פריט או בחרו השפעה זולה יותר.'); return }
    setItems(updatedItems)
  }

  function updateSelectedTrapType(id, trapType) {
    const updatedItems = changeTrapType(items, id, trapType)
    if (spentBudget(updatedItems) > calculateBuildBudget(updatedItems, passages)) { setNotice('אין מספיק תקציב לסוג המלכודת הזה.'); return }
    setItems(updatedItems)
    setSelectedTrapType(trapType)
    setNotice('סוג המלכודת והמחיר עודכנו.')
  }

  function saveCompound() {
    if (!routeAnalysis.reachable) { setNotice('אי אפשר לשמור מתחם ללא מסלול חוקי ליעד.'); return }
    try { saveCompoundData(compound); setSavedMessage(true); setNotice('המתחם נשמר בדפדפן הזה.') }
    catch { setNotice('שמירה נכשלה. בדקו שהדפדפן מאפשר אחסון מקומי.') }
    window.setTimeout(() => setSavedMessage(false), 2200)
  }

  function closeInspector() {
    setSelectedId(null)
    setMoveId(null)
  }

  const toolbar = <BuilderToolbar tool={tool} setTool={setTool} moveId={moveId} setMoveId={setMoveId} selectedItem={selectedItem} selectedTrapType={selectedTrapType} onSelectTrapType={setSelectedTrapType} onChangeTrapType={updateSelectedTrapType} onUpdateTrapSettings={updateSelectedTrapSettings} onToggleTrapVisibility={toggleTrapVisibility} onRemove={removeSelected} onSave={saveCompound} savedMessage={savedMessage} saveDisabled={!routeAnalysis.reachable} open={toolbarOpen} onClose={() => setToolbarOpen(false)} floating={Boolean(selectedItem)} />
  const utilityRail = <div className="builder-utility-rail"><MapLegend /><button type="button" className="map-analysis-toggle" aria-expanded={analysisOpen} onClick={() => setAnalysisOpen((current) => !current)}>{analysisOpen ? 'סגירת ניתוח מסלולים' : 'ניתוח מסלולים'}</button>{analysisOpen && <RouteAnalysis analysis={routeAnalysis} onClose={() => setAnalysisOpen(false)} />}</div>
  const inspector = selectedItem && <FloatingInspector
    title={selectedItem.type === 'trap' ? selectedItem.name : selectedItem.label}
    eyebrow={selectedItem.type === 'trap' ? 'הגדרות מלכודת' : 'פרטי חדר'}
    onClose={closeInspector}
    className="builder-item-inspector"
    footer={<ActionFooter className="builder-inspector-actions"><button type="button" className="builder-inspector-close" onClick={closeInspector}>סגירה</button><button type="button" className="remove-option builder-inspector-delete" onClick={removeSelected}>מחיקת פריט</button><button type="button" className="save-button builder-inspector-save" onClick={saveCompound} disabled={!routeAnalysis.reachable}>{savedMessage ? 'נשמר' : 'שמירת המתחם'}</button></ActionFooter>}
  >{toolbar}</FloatingInspector>

  return <main className="builder-screen" dir="rtl">
    <header className="builder-topbar"><div className="builder-brand"><span className="builder-logo">⌂</span><span>I’M <b>HOME</b></span><i /> <span className="builder-location">עורך המתחם</span></div><div className="prototype-tag"><i /> סביבת בנייה · אבטיפוס</div><div className="builder-header-actions"><BuilderBudget budget={budget} remaining={remaining} spent={spent} compact /><button type="button" className="builder-tools-toggle" aria-expanded={toolbarOpen} aria-controls="builder-tools" onClick={() => setToolbarOpen((current) => !current)}>כלי בנייה</button><button className="home-button" onClick={onHome}><span>←</span> חזרה למסך הבית</button></div></header>
    <section className="builder-heading"><div><span className="builder-kicker">המתחם שלך / עריכה</span><h1>בונים את <em>הבית.</em></h1><p>תכננו את המרחב, השאירו מעבר פתוח, והגנו על מה שחשוב.</p></div><BuilderBudget budget={budget} remaining={remaining} spent={spent} /></section>
    <WorkspaceFrame className="builder-workspace" inspector={inspector}>
      <MapFirstLayout className={`builder-layout ${toolbarOpen && !selectedItem ? 'tools-open' : ''}`} startRail={utilityRail} endRail={toolbarOpen ? selectedItem ? <div className="builder-tool-rail-placeholder" aria-label="הגדרות הפריט נפתחו בחלונית" /> : toolbar : null} map={<div className="builder-map-stack"><div className="map-panel"><div className="map-panel-head"><div><span className="map-kicker">מבט על · אזור מגורים</span><h2>מתחם 01 <i /> <small>הגבעה הצפונית</small></h2></div><MapLegend className="map-heading-legend" /><span className="map-scale">{mapTemplate.width} × {mapTemplate.height}</span></div>
          <div className="map-instruction">{moveId && moveId !== 'choose' ? 'בחרו משבצת פנויה להעברת הפריט' : tool === 'room' ? 'בחרו את הפינה השמאלית העליונה של החדר' : tool === 'passage' ? 'בחרו משבצת קיר כדי להוסיף מקטע מסדרון' : tool === 'trap' ? 'בחרו משבצת בחדר או במסדרון' : moveId === 'choose' ? 'בחרו פריט במפה כדי להזיז אותו' : 'בחרו כלי בנייה או פריט במפה לעריכה'}</div>
          <div className="map-fit-viewport" ref={mapViewportRef} style={mapFitStyle}><CompoundMap items={items} passages={passages} map={compound.map} tool={tool} moveId={moveId && moveId !== 'choose' ? moveId : null} onCellClick={handleCellClick} onItemClick={handleItemClick} entranceLabelLeft={mapMetrics.gridPadding + mapMetrics.gridBorder + compound.map.entrances[0].x * (mapGeometry.cellWidth + mapMetrics.cellGap) + mapGeometry.cellWidth / 2} /></div>
          <div className="map-panel-foot"><span>כניסה אחת נשארת פתוחה בכל עת</span></div>
        </div><RouteAnalysis analysis={routeAnalysis} className="route-analysis-phone-landscape" /></div>} />
    </WorkspaceFrame>
    <div className="builder-footer"><span>המפה נשמרת מקומית בדפדפן</span><span>לכל הגנה יש דרך להתמודד איתה <i /></span><span>אב טיפוס 0.2</span></div>
    <MessageLayer messages={notice ? [{ id: 'builder-notice', text: notice, type: 'status' }] : []} className="builder-message-layer">{notice && <button type="button" className="builder-message-dismiss" onClick={() => setNotice('')} aria-label="סגירת הודעה">×</button>}</MessageLayer>
  </main>
}
