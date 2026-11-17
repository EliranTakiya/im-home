import { useMemo, useState } from 'react'
import { listPerksForRole, loadPerkStore, savePerkStore, saveVisitPerkSelection, validatePerkSelection } from './perks.js'
import './PerkSelection.css'

const PROFILE_IDS = { owner: 'local-owner', guest: 'local-guest' }
const MAX_SELECTED = 2

export default function PerkSelection({ visitId, onStart, onCancel }) {
  const [store, setStore] = useState(() => loadPerkStore())
  const [role, setRole] = useState('owner')
  const [confirmed, setConfirmed] = useState({ owner: false, guest: false })
  const [selections, setSelections] = useState({ owner: [], guest: [] })
  const [notice, setNotice] = useState('')
  const perks = useMemo(() => listPerksForRole(role), [role])
  const currentSelection = selections[role]

  function toggle(perkId) {
    const next = currentSelection.includes(perkId) ? currentSelection.filter((id) => id !== perkId) : [...currentSelection, perkId]
    const validation = validatePerkSelection(store, { profileId: PROFILE_IDS[role], role, selectedIds: next, maxSelected: MAX_SELECTED })
    if (!validation.ok) {
      setNotice(validation.error === 'selection-limit' ? `אפשר לבחור עד ${MAX_SELECTED} יכולות לביקור.` : 'היכולת נעולה או שאין לה שימושים זמינים.')
      return
    }
    setNotice('')
    setSelections((current) => ({ ...current, [role]: validation.selectedIds }))
  }

  function continueToGuest() {
    setConfirmed((current) => ({ ...current, owner: true }))
    setRole('guest')
    setNotice('')
  }

  function startVisit() {
    if (!confirmed.owner) { setNotice('יש לאשר תחילה את בחירת בעל המתחם.'); setRole('owner'); return }
    const result = saveVisitPerkSelection(store, { visitId, profiles: PROFILE_IDS, selections, maxSelected: MAX_SELECTED })
    if (!result.ok || !savePerkStore(result.store)) { setNotice('לא ניתן לשמור את בחירת היכולות במכשיר הזה.'); return }
    setStore(result.store)
    setConfirmed((current) => ({ ...current, guest: true }))
    onStart(result.selection)
  }

  const profile = store.profiles[`${role}:${PROFILE_IDS[role]}`]

  return <main className="perk-selection-shell" dir="rtl">
    <header className="perk-selection-header"><button className="perk-back" onClick={onCancel}>← חזרה</button><div><span>הכנות לביקור · בחירה נפרדת לכל צד</span><h1>בחרו Perks</h1></div><span className="perk-cap">מכסה: עד {MAX_SELECTED} יכולות לכל צד</span></header>
    <section className="perk-selection-layout">
      <div className="perk-role-tabs" role="tablist" aria-label="בחירת תפקיד">
        <button role="tab" aria-selected={role === 'owner'} className={role === 'owner' ? 'perk-tab-active' : ''} onClick={() => setRole('owner')}><span>01</span><b>בעל המתחם</b><small>הגנה ומידע על המתחם</small></button>
        <button role="tab" aria-selected={role === 'guest'} className={role === 'guest' ? 'perk-tab-active' : ''} onClick={() => setRole('guest')}><span>02</span><b>האורח</b><small>התקפה והישרדות</small></button>
      </div>
      <section className="perk-list-panel">
        <div className="perk-list-heading"><div><span>{role === 'owner' ? 'היכולות של בעל המתחם' : 'היכולות של האורח'}</span><h2>{role === 'owner' ? 'הגנה ומידע' : 'התמודדות והישרדות'}</h2></div><b>{currentSelection.length} / {MAX_SELECTED}</b></div>
        {perks.length ? <div className="perk-cards">{perks.map((perk) => {
          const inventory = profile?.inventory?.[perk.id]
          const available = inventory?.owned && (inventory.remainingUses === null || inventory.remainingUses > 0)
          const selected = currentSelection.includes(perk.id)
          return <article key={perk.id} className={`perk-card ${selected ? 'perk-card-selected' : ''} ${!available ? 'perk-card-locked' : ''}`}>
            <div className="perk-card-icon">{perk.effect === 'reveal-hidden-traps' ? '⌖' : '✦'}</div>
            <div className="perk-card-copy"><div className="perk-card-meta"><span>{perk.category === 'defense' ? 'הגנתי' : 'התקפי'}</span><span>{available ? inventory.limitKind === 'permanent' ? 'זמינה תמיד' : `נותרו ${inventory.remainingUses} שימושים` : 'נעולה'}</span></div><h3>{perk.name}</h3><p>{perk.description}</p>{!available && <small>תיפתח דרך הישג, אתגר או תגמול.</small>}</div>
            <button type="button" disabled={!available || perk.status !== 'implemented'} onClick={() => toggle(perk.id)}>{selected ? 'הוסרה מהבחירה' : available ? 'בחרו' : 'נעולה'}</button>
          </article>
        })}</div> : <div className="perk-empty"><span>✧</span><h3>עוד אין Perks זמינים לתפקיד הזה</h3><p>מלאי האורח נפרד ממלאי בעל המתחם. היכולות יוצגו כאן לאחר הגדרתן ומימושן.</p></div>}
        {notice && <p className="perk-notice" role="status">{notice}</p>}
        <div className="perk-selection-actions">{role === 'owner' ? <button className="perk-next" onClick={continueToGuest}>המשך לבחירת האורח <b>←</b></button> : <button className="perk-next" onClick={startVisit}>שמור בחירה והתחל ביקור <b>←</b></button>}</div>
      </section>
    </section>
    <p className="perk-selection-footnote">הבחירה נשמרת בנפרד מהמתחם. שימוש ביכולת מוגבלת נרשם לפני הפעלתה כדי למנוע שימוש חוזר ברענון.</p>
  </main>
}
