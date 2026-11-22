import { useState } from 'react'
import { CHALLENGE_HOUSES } from './challenges/houses.js'
import { challengeAchievementStats, challengeHouseStats, isChallengeHouseUnlocked } from './challenges/progress.js'
import { EQUIPMENT_CATALOG } from './equipment.js'
import { PERK_CATALOG } from './perks.js'
import './VisitSelection.css'
import './VisitHistory.css'

const MEDALS = { gold: 'זהב', silver: 'כסף', bronze: 'ארד' }
const DIFFICULTIES = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

function formatDate(value) {
  if (!value) return 'לא זמין'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'לא זמין' : new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function SelectionHistory({ house, progress }) {
  const history = challengeHouseStats(progress, house.id).history
  const names = (ids, catalog) => !Array.isArray(ids) ? 'לא זמין' : ids.length ? ids.map((id) => catalog.find((item) => item.id === id)?.name ?? id).join(', ') : 'ללא בחירות'
  return <section className="selection-history"><h4>היסטוריית ניסיונות · {history.length}</h4>{history.length ? <ol>{history.map((attempt) => <li key={attempt.id}><header><time>{formatDate(attempt.endedAt ?? attempt.startedAt)}</time><b className={attempt.medal ? `history-medal medal-${attempt.medal}` : 'history-failure'}>{attempt.medal ? MEDALS[attempt.medal] : 'כישלון'}</b></header><div className="history-facts"><span>ניקוד <b>{attempt.score?.total ?? 'לא זמין'}</b></span><span>צעדים <b>{attempt.stepsTaken ?? 'לא זמין'}</b></span><span>חיים <b>{attempt.remainingHealth ?? 'לא זמין'}</b></span><span>קושי <b>{DIFFICULTIES[attempt.difficulty] ?? 'לא זמין'}</b></span></div><p>Guest Perks: {names(attempt.guestPerks ?? attempt.perkSelections?.guest, PERK_CATALOG)}</p><p>ציוד: {Array.isArray(attempt.equipment?.selectedToolIds) ? names(attempt.equipment.selectedToolIds, Object.values(EQUIPMENT_CATALOG)) : 'לא זמין'}</p></li>)}</ol> : <p>עדיין אין ניסיונות מתועדים בבית הזה.</p>}</section>
}

function Achievements({ progress }) {
  const stats = challengeAchievementStats(progress)
  return <section className="selection-achievements" aria-label="הישגי השחקן"><div className="selection-achievement-stats">{[['Gold', stats.gold], ['Silver', stats.silver], ['Bronze', stats.bronze], ['בתים שהושלמו', `${stats.completedHouses}/${CHALLENGE_HOUSES.length}`], ['ניסיונות', stats.totalAttempts], ['שיא צעדים', stats.bestSteps ?? '—']].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div><h3>מדליות והתקדמות לפי בית</h3><div className="selection-achievement-houses">{stats.houses.map((house) => <article key={house.id}><b>{house.name}</b><span>{house.completed ? 'הושלם' : 'בתהליך'} · {house.bestSteps ?? '—'} צעדים</span><div>{['gold', 'silver', 'bronze'].map((medal) => <i key={medal} className={`${house.medals.includes(medal) ? `earned-${medal}` : ''}`}>{MEDALS[medal]}</i>)}</div></article>)}</div><h3>הישגים שנפתחו</h3>{stats.achievements.length ? <ul>{[...stats.achievements].sort((a, b) => Date.parse(b.awardedAt) - Date.parse(a.awardedAt)).map((achievement) => <li key={achievement.awardId}>{CHALLENGE_HOUSES.find((house) => house.id === achievement.houseId)?.title ?? achievement.houseId} · {MEDALS[achievement.medal] ?? achievement.medal}<time>{formatDate(achievement.awardedAt)}</time></li>)}</ul> : <p>עדיין לא נפתחו הישגים.</p>}</section>
}

function HouseCard({ house, progress, unlocked, disabled, onSelect }) {
  const [showHistory, setShowHistory] = useState(false)
  const stats = challengeHouseStats(progress, house.id)
  return <article className={`selection-house ${unlocked ? '' : 'selection-house-locked'}`}>
    <div className={`selection-map theme-${house.theme.id}`} aria-hidden="true">
      {Array.from({ length: house.map.width * house.map.height }, (_, index) => {
        const x = index % house.map.width
        const y = Math.floor(index / house.map.width)
        const room = house.map.rooms.some((item) => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h)
        const passage = house.map.passages.some((item) => x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height)
        return <i key={`${x}-${y}`} className={`${room ? 'selection-room' : ''} ${passage ? 'selection-passage' : ''}`} />
      })}
    </div>
    <div className="selection-house-copy">
      <span className="selection-overline">בית {String(house.order).padStart(2, '0')} · {house.difficulty}</span>
      <h3>{house.title}</h3>
      <p>{house.description}</p>
      <div className="selection-stats"><span>{stats.attempts} ניסיונות</span><span>שיא: {stats.bestSteps ?? '—'} צעדים</span><span>{stats.bestMedal ? `מדליה: ${MEDALS[stats.bestMedal]}` : 'ללא מדליה'}</span></div>
      <button className="selection-history-button" aria-expanded={showHistory} onClick={(event) => { event.stopPropagation(); setShowHistory((value) => !value) }}>{showHistory ? 'הסתרת היסטוריה' : 'היסטוריית ניסיונות'}</button>
      {showHistory && <SelectionHistory house={house} progress={progress} />}
      {!unlocked && <small className="selection-requirement">תנאי פתיחה: השלמת {CHALLENGE_HOUSES[house.order - 2]?.title}</small>}
      <button disabled={!unlocked || disabled} onClick={() => onSelect(house)}>{!unlocked ? 'הבית נעול' : disabled ? 'המשיכו או ותרו על האתגר הפעיל' : 'בחירת בית והמשך'} <b>←</b></button>
    </div>
    {!unlocked && <span className="selection-lock" aria-label="נעול">⌑</span>}
  </article>
}

export default function VisitSelection({ mode = 'visit', progress, activeChallenge, onChallenge, onContinueChallenge, onAbandonChallenge, onBack }) {
  const [showAchievements, setShowAchievements] = useState(false)
  const challengeMode = mode === 'challenge'
  const unlocked = CHALLENGE_HOUSES.filter((house) => isChallengeHouseUnlocked(progress, house.id))
  const locked = CHALLENGE_HOUSES.filter((house) => !isChallengeHouseUnlocked(progress, house.id))
  const hasActive = activeChallenge?.visit?.outcome === 'active'
  return <main className="visit-selection" dir="rtl">
    <header className="visit-selection-header">
      <button onClick={onBack}>חזרה לבית</button>
      <div><span>{challengeMode ? 'מסלול יחיד · התקדמות נפרדת' : 'יעד לביקור רגיל'}</span><h1>{challengeMode ? 'AI Challenge' : 'Start a Visit'}</h1></div>
      <div className="selection-header-actions">{challengeMode && <button onClick={() => setShowAchievements((value) => !value)}>{showAchievements ? 'חזרה לבתים' : 'הישגים'}</button>}<strong>I’M <b>HOME</b></strong></div>
    </header>
    {!challengeMode ? <section className="selection-category destination-empty-state">
      <div className="selection-category-heading"><span>01</span><div><small>בחירת יעד מפורשת</small><h2>Player Houses</h2></div><b>אין בתים זמינים</b></div>
      <div className="selection-empty"><span>⌂</span><div><b>אין כרגע יעד זמין לביקור רגיל</b><p>כשיהיו בתים של שחקנים אחרים זמינים לבחירה, הם יוצגו כאן. הבית האישי שלך נשאר ב־My Home ואינו נבחר אוטומטית או כיעד לביקור.</p><small>Visit Other Players · Coming Soon</small></div></div>
    </section> : showAchievements ? <Achievements progress={progress} /> : <>
    {hasActive && <aside className="selection-resume"><div><span>אתגר פעיל</span><b>{CHALLENGE_HOUSES.find((house) => house.id === activeChallenge.houseId)?.title ?? 'בית אתגר'}</b></div><button onClick={onContinueChallenge}>המשיכו בביקור ←</button><button className="selection-abandon" onClick={onAbandonChallenge}>וותרו על הניסיון</button></aside>}
    <section className="selection-category">
      <div className="selection-category-heading"><span>02</span><div><small>מסלול יחיד · שלושה מתחמים</small><h2>AI Challenge Houses</h2></div><b>{unlocked.length} פתוחים</b></div>
      <div className="selection-house-grid">{unlocked.map((house) => <HouseCard key={house.id} house={house} progress={progress} unlocked disabled={hasActive} onSelect={onChallenge} />)}</div>
    </section>
    <section className="selection-category selection-locked-category">
      <div className="selection-category-heading"><span>03</span><div><small>נפתחים עם ההתקדמות</small><h2>Locked Houses</h2></div><b>{locked.length} נעולים</b></div>
      {locked.length ? <div className="selection-house-grid">{locked.map((house) => <HouseCard key={house.id} house={house} progress={progress} unlocked={false} disabled={hasActive} onSelect={onChallenge} />)}</div> : <p className="selection-all-open">כל בתי האתגר פתוחים.</p>}
    </section>
    </>}
  </main>
}
