import { useState } from 'react'
import Builder from './Builder.jsx'
import VisitGame from './VisitGame.jsx'
import PerkSelection from './PerkSelection.jsx'
import EquipmentSelection from './EquipmentSelection.jsx'
import VisitSelection from './VisitSelection.jsx'
import ChallengeDifficulty from './ChallengeDifficulty.jsx'
import HostPerkBriefing from './HostPerkBriefing.jsx'
import ChallengeSummary from './ChallengeSummary.jsx'
import { createVisitEquipment, loadEquipmentStore } from './equipment.js'
import { createVisit, loadActiveVisit, saveActiveVisit } from './visitEngine.js'
import { createChallengeVisit } from './challengeVisit.js'
import { CHALLENGE_HOUSES, getChallengeHouse } from './challenges/houses.js'
import { clearActiveChallenge, loadActiveChallenge, loadChallengeProgress, recordChallengeAttempt, saveActiveChallenge, saveChallengeProgress } from './challenges/progress.js'
import { selectChallengeVisitTarget } from './visitSelection.js'
import { loadPerkStore, savePerkStore, syncGuestChallengePerkRewards } from './perks.js'
import './App.css'
import './VisitNavigation.css'

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
  const [visitSaveError, setVisitSaveError] = useState('')
  const [challengeProgress, setChallengeProgress] = useState(() => loadChallengeProgress())
  const [activeChallenge, setActiveChallenge] = useState(() => loadActiveChallenge())
  const [challengeDraft, setChallengeDraft] = useState(null)

  function continueVisit() {
    const active = loadActiveVisit()
    if (!active) { setVisitSaveError('לא נמצא ביקור רגיל שמור ותקף להמשך. השמירה הקיימת לא נמחקה.'); return }
    setVisitSaveError('')
    setVisit(active)
    setScreen('visit')
  }

  function returnHome(session) {
    setVisit((current) => current ? { ...current, session } : current)
    setScreen('home')
  }

  function restartVisit() {
    setVisit(null)
    setScreen('visit-selection')
  }

  function continueToEquipment(selection) {
    setVisitDraft((draft) => ({ ...draft, perkSelection: selection }))
    setScreen('equipment')
  }

  function startVisitWithEquipment(selectedToolIds) {
    setVisitSaveError('')
    const target = visitDraft
    if (!target?.compound || target.visitType !== 'player-house' || target.mapSource !== 'player-house' || !target.houseId) return
    const session = createVisit(target.compound, { id: target.id, visitType: 'player-house', ownerMode: 'absent', mapSource: target.mapSource, houseId: target.houseId, perkSelection: target.perkSelection ?? {}, equipment: createVisitEquipment(loadEquipmentStore(), selectedToolIds) })
    if (!saveActiveVisit(target.compound, session)) {
      setVisitSaveError('לא ניתן לשמור את הביקור החדש. הביקור לא התחיל, והשמירה הקודמת נשארה ללא שינוי.')
      return
    }
    setVisit({ compound: target.compound, session })
    setVisitDraft(null)
    setScreen('visit')
  }

  function cancelVisitDraft() {
    setVisitDraft(null)
    setScreen('home')
  }

  function beginChallenge(house) {
    if (activeChallenge?.visit?.outcome === 'active') return
    const target = selectChallengeVisitTarget(challengeProgress, house?.id)
    if (!target) return
    const guestRewards = syncGuestChallengePerkRewards(loadPerkStore(), challengeProgress)
    if (guestRewards.grants.length) savePerkStore(guestRewards.store)
    const houseData = getChallengeHouse(target.houseId)
    setChallengeDraft({ ...target, id: globalThis.crypto?.randomUUID?.() ?? `challenge-${Date.now()}`, guardianDifficulty: houseData.guardianDifficulty })
    setScreen('challenge-difficulty')
  }

  function selectChallengeDifficulty(difficulty) {
    if (!challengeDraft || !['easy', 'normal', 'hard'].includes(difficulty)) return
    setChallengeDraft((current) => ({ ...current, guardianDifficulty: difficulty }))
    setScreen('challenge-host-perks')
  }

  function continueChallenge() {
    const active = loadActiveChallenge()
    if (!active || active.visit?.outcome !== 'active') {
      setVisitSaveError('לא נמצא ביקור AI Challenge שמור ותקף להמשך.')
      return
    }
    setActiveChallenge(active)
    setScreen('challenge-visit')
  }

  function abandonChallenge() {
    clearActiveChallenge(globalThis.localStorage, activeChallenge?.visit?.id)
    setActiveChallenge(null)
  }

  function selectChallengeEquipmentPerks(selection) {
    setChallengeDraft((current) => {
      if (!current) return current
      const house = getChallengeHouse(current.houseId)
      return { ...current, perkSelection: { ...selection, owner: { profileId: `challenge-owner:${current.houseId}`, selectedIds: house?.guardianPerks ?? [] } } }
    })
    setScreen('challenge-equipment')
  }

  function selectChallengeEquipment(selectedToolIds) {
    setChallengeDraft((current) => current ? { ...current, selectedToolIds: [...selectedToolIds] } : current)
    setScreen('challenge-summary')
  }

  function startChallengeWithEquipment() {
    if (!challengeDraft) return
    if (challengeDraft.visitType !== 'challenge' || challengeDraft.mapSource !== 'challenge-catalog' || !getChallengeHouse(challengeDraft.houseId)) return
    const session = createChallengeVisit(challengeDraft, { id: challengeDraft.id, difficulty: challengeDraft.guardianDifficulty, perkSelection: challengeDraft.perkSelection ?? {}, equipment: createVisitEquipment(loadEquipmentStore(), challengeDraft.selectedToolIds ?? []) })
    if (!session) return
    const active = { version: 1, houseId: challengeDraft.houseId, houseVersion: getChallengeHouse(challengeDraft.houseId).version, compound: challengeDraft.compound, visit: session }
    if (!saveActiveChallenge(active)) return
    setActiveChallenge(active)
    setChallengeDraft(null)
    setScreen('challenge-visit')
  }

  function finishChallengeAttempt(session, houseId) {
    const result = recordChallengeAttempt(challengeProgress, houseId, session)
    if (!result.ok) return
    const progressSaved = saveChallengeProgress(result.progress)
    if (progressSaved) {
      const guestRewards = syncGuestChallengePerkRewards(loadPerkStore(), result.progress)
      if (guestRewards.grants.length) savePerkStore(guestRewards.store)
    }
    setChallengeProgress(result.progress)
    setActiveChallenge((current) => current ? { ...current, visit: session, finished: true } : current)
  }

  function leaveChallenge(session) {
    if (activeChallenge && session.outcome === 'active') {
      const updated = { ...activeChallenge, visit: session }
      saveActiveChallenge(updated)
      setActiveChallenge(updated)
    }
    setScreen('challenge-selection')
  }

  function restartChallenge() {
    const houseId = activeChallenge?.houseId
    const house = CHALLENGE_HOUSES.find((entry) => entry.id === houseId)
    if (!house) { setScreen('challenge-selection'); return }
    clearActiveChallenge(globalThis.localStorage, activeChallenge?.visit?.id)
    setActiveChallenge(null)
    const target = selectChallengeVisitTarget(challengeProgress, houseId)
    if (!target) { setScreen('challenge-selection'); return }
    const houseData = getChallengeHouse(target.houseId)
    setChallengeDraft({ ...target, id: globalThis.crypto?.randomUUID?.() ?? `challenge-${Date.now()}`, guardianDifficulty: houseData.guardianDifficulty })
    setScreen('challenge-difficulty')
  }

  return (
    <>
    <div style={{ display: screen === 'builder' ? 'block' : 'none' }} aria-hidden={screen !== 'builder'}>
      <Builder onHome={() => setScreen('home')} />
    </div>
    {visit && <div style={{ display: screen === 'visit' ? 'block' : 'none' }} aria-hidden={screen !== 'visit'}>
      <VisitGame key={visit.session.id} compound={visit.compound} initialVisit={visit.session} onHome={returnHome} onRestart={restartVisit} isActive={screen === 'visit'} />
    </div>}
    {screen === 'visit-selection' && <VisitSelection mode="visit" onBack={() => setScreen('home')} />}
    {screen === 'challenge-selection' && <VisitSelection mode="challenge" progress={challengeProgress} activeChallenge={activeChallenge} onChallenge={beginChallenge} onContinueChallenge={continueChallenge} onAbandonChallenge={abandonChallenge} onBack={() => setScreen('home')} />}
    {screen === 'challenge-difficulty' && challengeDraft && <ChallengeDifficulty house={getChallengeHouse(challengeDraft.houseId)} value={challengeDraft.guardianDifficulty} onSelect={(difficulty) => setChallengeDraft((current) => current ? { ...current, guardianDifficulty: difficulty } : current)} onContinue={() => selectChallengeDifficulty(challengeDraft.guardianDifficulty)} onCancel={() => { setChallengeDraft(null); setScreen('challenge-selection') }} />}
    {screen === 'challenge-host-perks' && challengeDraft && <HostPerkBriefing house={getChallengeHouse(challengeDraft.houseId)} onContinue={() => setScreen('challenge-perks')} onBack={() => setScreen('challenge-difficulty')} />}
    {screen === 'challenge-perks' && challengeDraft && <PerkSelection key={challengeDraft.id} visitId={challengeDraft.id} challengeMode stepLabel="שלב 4 מתוך 7" continueLabel="שמרו Guest Perks והמשיכו לציוד" onStart={selectChallengeEquipmentPerks} onCancel={() => setScreen('challenge-host-perks')} />}
    {screen === 'challenge-equipment' && challengeDraft && <EquipmentSelection stepLabel="שלב 5 מתוך 7" continueLabel="שמרו ציוד והמשיכו לסיכום" onStart={selectChallengeEquipment} onCancel={() => setScreen('challenge-perks')} />}
    {screen === 'challenge-summary' && challengeDraft && <ChallengeSummary draft={challengeDraft} house={getChallengeHouse(challengeDraft.houseId)} onBack={() => setScreen('challenge-equipment')} onStart={startChallengeWithEquipment} />}
    {activeChallenge && <div style={{ display: screen === 'challenge-visit' ? 'block' : 'none' }} aria-hidden={screen !== 'challenge-visit'}>
      <VisitGame key={activeChallenge.visit.id} compound={activeChallenge.compound} initialVisit={activeChallenge.visit} challengeHouse={getChallengeHouse(activeChallenge.houseId)} onHome={leaveChallenge} onRestart={restartChallenge} onChallengeResult={finishChallengeAttempt} isActive={screen === 'challenge-visit'} />
    </div>}
    {screen === 'perks' && visitDraft && <PerkSelection key={visitDraft.id} visitId={visitDraft.id} onStart={continueToEquipment} onCancel={cancelVisitDraft} />}
    {screen === 'equipment' && visitDraft && <EquipmentSelection onStart={startVisitWithEquipment} onCancel={() => setScreen('perks')} startError={visitSaveError} />}
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
              <span>My Home · הבית שלי</span><span className="button-arrow" aria-hidden="true">←</span>
            </button>
            <button className="secondary-button" onClick={() => setScreen('challenge-selection')}><span className="play-icon">◆</span> AI Challenge</button>
            <button className="secondary-button" onClick={() => { setVisitSaveError(''); setScreen('visit-selection') }}><span className="play-icon">▶</span> Start a Visit</button>
            <button className="secondary-button visit-coming-soon" disabled><span className="play-icon">⌂</span> Visit Other Players · Coming Soon</button>
            {visit?.session.outcome === 'active' && <button className="secondary-button" onClick={continueVisit}><span className="play-icon">▶</span> Continue Visit · ביקור רגיל</button>}
            {activeChallenge?.visit?.outcome === 'active' && <button className="secondary-button" onClick={continueChallenge}><span className="play-icon">▶</span> Continue AI Challenge</button>}
            {visitSaveError && <p className="home-visit-error" role="status">{visitSaveError}</p>}
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

