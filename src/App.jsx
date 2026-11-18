import { useState } from 'react'
import Builder from './Builder.jsx'
import VisitGame from './VisitGame.jsx'
import PerkSelection from './PerkSelection.jsx'
import EquipmentSelection from './EquipmentSelection.jsx'
import { loadCompound } from './compound.js'
import { createVisitEquipment, loadEquipmentStore } from './equipment.js'
import { clearActiveVisit, createVisit, loadActiveVisit, saveActiveVisit } from './visitEngine.js'
import './App.css'

function HomeMark() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M5 18.5 20 6l15 12.5v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15Z" stroke="currentColor" strokeWidth="2" />
      <path d="M15 35V22h10v13M3 19 20 5l17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M29 9V5h4v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function HouseScene() {
  return (
    <div className="scene" aria-label="בית מואר בלילה, מוקף חומות ומלכודות" role="img">
      <div className="scene-orbit orbit-one" />
      <div className="scene-orbit orbit-two" />
      <div className="moon" />
      <div className="scene-stars" />
      <div className="hill hill-back" />
      <div className="hill hill-front" />
      <div className="pathway" />
      <div className="fortress">
        <div className="fort-wall wall-left" />
        <div className="fort-wall wall-right" />
        <div className="house-roof" />
        <div className="house-body">
          <span className="window window-left" />
          <span className="window window-right" />
          <span className="door" />
        </div>
        <div className="chimney" />
        <div className="fort-base" />
      </div>
      <div className="tower tower-left"><i /></div>
      <div className="tower tower-right"><i /></div>
      <div className="trap trap-left"><i /></div>
      <div className="trap trap-right"><i /></div>
      <div className="scene-label"><span className="live-dot" /> המתחם שלך · אזור בטוח</div>
      <div className="scene-coordinate">34° 46′ N &nbsp; 32° 04′ E</div>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('home')
  const [visit, setVisit] = useState(() => loadActiveVisit())
  const [visitDraft, setVisitDraft] = useState(null)

  function createDraft() {
    return { id: globalThis.crypto?.randomUUID?.() ?? `visit-${Date.now()}`, compound: loadCompound() }
  }

  function startNewVisit() {
    const active = loadActiveVisit()
    if (active) clearActiveVisit(globalThis.localStorage, active.session.id)
    setVisit(null)
    setVisitDraft(createDraft())
    setScreen('perks')
  }

  function continueVisit() {
    const active = loadActiveVisit() ?? (visit?.session.outcome === 'active' ? visit : null)
    if (!active) { startNewVisit(); return }
    setVisit(active)
    setScreen('visit')
  }

  function returnHome(session) {
    setVisit((current) => current ? { ...current, session } : current)
    setScreen('home')
  }

  function restartVisit() {
    setVisit(null)
    setVisitDraft(createDraft())
    setScreen('perks')
  }

  function continueToEquipment(selection) {
    setVisitDraft((draft) => ({ ...draft, perkSelection: selection }))
    setScreen('equipment')
  }

  function startVisitWithEquipment(selectedToolIds) {
    const savedCompound = visitDraft?.compound ?? loadCompound()
    const session = createVisit(savedCompound, { id: visitDraft?.id, perkSelection: visitDraft?.perkSelection ?? {}, equipment: createVisitEquipment(loadEquipmentStore(), selectedToolIds) })
    saveActiveVisit(savedCompound, session)
    setVisit({ compound: savedCompound, session })
    setVisitDraft(null)
    setScreen('visit')
  }

  function cancelVisitDraft() {
    setVisitDraft(null)
    setScreen('home')
  }

  return (
    <>
    <div style={{ display: screen === 'builder' ? 'block' : 'none' }} aria-hidden={screen !== 'builder'}>
      <Builder onHome={() => setScreen('home')} />
    </div>
    {visit && <div style={{ display: screen === 'visit' ? 'block' : 'none' }} aria-hidden={screen !== 'visit'}>
      <VisitGame key={visit.session.id} compound={visit.compound} initialVisit={visit.session} onHome={returnHome} onRestart={restartVisit} isActive={screen === 'visit'} />
    </div>}
    {screen === 'perks' && visitDraft && <PerkSelection key={visitDraft.id} visitId={visitDraft.id} onStart={continueToEquipment} onCancel={cancelVisitDraft} />}
    {screen === 'equipment' && visitDraft && <EquipmentSelection onStart={startVisitWithEquipment} onCancel={() => setScreen('perks')} />}
    <main className="game-shell" dir="rtl" style={{ display: screen === 'home' ? 'block' : 'none' }}>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="I’m Home — מסך הבית">
          <span className="brand-mark"><HomeMark /></span>
          <span className="brand-name">I’M <b>HOME</b><small>הבית הוא רק ההתחלה</small></span>
        </a>
        <nav className="top-nav" aria-label="ניווט ראשי">
          <a className="nav-active" href="#home">ראשי</a>
          <a href="#world">העולם</a>
          <a href="#about">על המשחק</a>
        </nav>
        <div className="top-status"><span className="status-dot" /> <span>שרתים פעילים</span><i /></div>
      </header>

      <section className="hero-section" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span /> הבית שלך. החוקים שלך.</div>
          <h1>כולם רוצים<br />להיכנס.<br /><em>תן להם לנסות.</em></h1>
          <p className="hero-description">בנה מתחם שאי אפשר לשכוח. גלה את החולשות של אחרים. וכשמישהו מגיע אליך — תגרום לו להתחרט.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setScreen('builder')}>
              <span>היכנסו למתחם</span><span className="button-arrow" aria-hidden="true">←</span>
            </button>
            {visit?.session.outcome === 'active' ? <>
              <button className="secondary-button" onClick={continueVisit}><span className="play-icon">▶</span> המשיכו ביקור קיים</button>
              <button className="secondary-button abandon-visit-button" onClick={startNewVisit}>וותרו על הביקור והתחילו חדש</button>
            </> : <button className="secondary-button" onClick={startNewVisit}><span className="play-icon">▶</span> התחילו ביקור</button>}
            <a className="secondary-button" href="#world"><span className="play-icon">▶</span> גלו את העולם</a>
          </div>
          <div className="hero-footnote"><span className="footnote-line" /> המשחק נמצא בפיתוח <span className="footnote-separator">·</span> הבית הראשון נבנה עכשיו</div>
        </div>

        <div className="hero-art"><HouseScene /><div className="art-glow" /></div>
        <div className="side-index"><span>01</span><i /> 03</div>
      </section>

      <section className="feature-strip" id="world" aria-label="מה מחכה לכם">
        <div className="feature-intro"><span>העולם שבחוץ</span><p>החוקים פשוטים.<br />ההישרדות פחות.</p></div>
        <article className="feature-card"><span className="feature-number">01</span><span className="feature-icon">⌂</span><div><h2>בנה את הבית</h2><p>כל קיר, מלכודת והחלטה — שלך.</p></div><span className="feature-arrow">↗</span></article>
        <article className="feature-card"><span className="feature-number">02</span><span className="feature-icon crossed">⌁</span><div><h2>הגן על מה ששלך</h2><p>הפולשים מגיעים. תהיה מוכן.</p></div><span className="feature-arrow">↗</span></article>
        <article className="feature-card"><span className="feature-number">03</span><span className="feature-icon">◎</span><div><h2>מצא את החולשה</h2><p>לכל מבצר יש נקודת תורפה.</p></div><span className="feature-arrow">↗</span></article>
      </section>

      <footer className="footer" id="about"><span>© 2026 I’M HOME</span><span>אין כמו בבית. עד שמישהו מנסה להיכנס.</span><span className="version">גרסת פיתוח <i /> 0.1</span></footer>

    </main>
    </>
  )
}

export default App

