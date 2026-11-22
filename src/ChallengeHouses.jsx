import { useState } from 'react'
import { CHALLENGE_HOUSES } from './challenges/houses.js'
import { challengeHouseStats, isChallengeHouseUnlocked } from './challenges/progress.js'
import './ChallengeHouses.css'

const MEDALS = { gold: 'זהב', silver: 'כסף', bronze: 'ארד' }
function HousePreview({ house }) {
  const { map, theme } = house
  return <div className={`challenge-preview challenge-grain-${theme.grain}`} style={{ '--house-wall': theme.wall, '--house-room': theme.room, '--house-corridor': theme.corridor, '--house-floor': theme.floor, '--house-frame': theme.frame, '--house-lamp': theme.lamp, '--house-accent': theme.accent }} aria-label={`תצוגה מקדימה: ${house.title}`} role="img">
    {Array.from({ length: map.width * map.height }, (_, index) => {
      const x = index % map.width
      const y = Math.floor(index / map.width)
      const room = map.rooms.find((area) => x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h)
      const passage = map.passages.some((area) => x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height)
      const entrance = map.entrances.some((point) => point.x === x && point.y === y)
      const decor = house.decor.find((item) => item.x === x && item.y === y)
      return <i key={`${x}-${y}`} className={`${room ? 'preview-room' : ''} ${passage ? 'preview-corridor' : ''} ${entrance ? 'preview-entrance' : ''} ${decor ? 'preview-decor' : ''}`} aria-hidden="true">{decor?.glyph}</i>
    })}
    <span className="challenge-preview-lamp" />
  </div>
}

export default function ChallengeHouses({ progress, activeChallenge, onStart, onContinue, onAbandon, onBack }) {
  const [selectedId, setSelectedId] = useState(CHALLENGE_HOUSES[0].id)
  const selectedHouse = CHALLENGE_HOUSES.find((house) => house.id === selectedId) ?? CHALLENGE_HOUSES[0]
  const selectedStats = challengeHouseStats(progress, selectedHouse.id)
  const selectedUnlocked = isChallengeHouseUnlocked(progress, selectedHouse.id)
  const activeHouse = activeChallenge?.visit?.outcome === 'active' && CHALLENGE_HOUSES.find((house) => house.id === activeChallenge.houseId)

  return <main className="challenge-houses-shell" dir="rtl">
    <header className="challenge-houses-header"><button className="challenge-back" onClick={onBack}>← חזרה לבית</button><div><span>מסלול יחיד · שלושה מתחמים</span><h1>בתי אתגר</h1></div><span className="challenge-header-mark">I’M HOME <i>◆</i></span></header>
    {activeHouse && <div className="challenge-resume-row"><button className="challenge-resume" onClick={onContinue}>המשך ביקור פעיל · {activeHouse.title}<b>המשך ←</b></button><button className="challenge-abandon" onClick={onAbandon}>וותרו על הניסיון הפעיל</button></div>}
    <section className="challenge-houses-layout">
      <div className="challenge-house-list" aria-label="רשימת בתי האתגר">
        {CHALLENGE_HOUSES.map((house) => {
          const stats = challengeHouseStats(progress, house.id)
          const unlocked = isChallengeHouseUnlocked(progress, house.id)
          return <article key={house.id} className={`challenge-house-card ${selectedId === house.id ? 'challenge-house-selected' : ''} ${unlocked ? '' : 'challenge-house-locked'}`}>
            <button className="challenge-house-select" onClick={() => setSelectedId(house.id)} aria-pressed={selectedId === house.id}>
              <HousePreview house={house} />
              <span className="challenge-house-copy"><small>בית {String(house.order).padStart(2, '0')} · {house.difficulty}</small><b>{house.title}</b><span>{unlocked ? stats.completed ? `הושלם · ${stats.bestMedal ? MEDALS[stats.bestMedal] : ''}` : 'פתוח' : 'נעול'}</span></span>
              <span className="challenge-house-arrow">{unlocked ? '↖' : '⌑'}</span>
            </button>
            <div className="challenge-house-record"><span>{stats.bestSteps === null ? '—' : `${stats.bestSteps} צעדים`}</span><span>{stats.attempts} ניסיונות</span></div>
          </article>
        })}
      </div>
      <section className={`challenge-house-detail theme-${selectedHouse.theme.id}`} style={{ '--house-wall': selectedHouse.theme.wall, '--house-room': selectedHouse.theme.room, '--house-corridor': selectedHouse.theme.corridor, '--house-floor': selectedHouse.theme.floor, '--house-frame': selectedHouse.theme.frame, '--house-lamp': selectedHouse.theme.lamp, '--house-accent': selectedHouse.theme.accent }}>
        <HousePreview house={selectedHouse} />
        <div className="challenge-detail-content"><span className="challenge-detail-eyebrow">{selectedHouse.difficulty} · מתחם {String(selectedHouse.order).padStart(2, '0')}</span><h2>{selectedHouse.title}</h2><p>{selectedHouse.description}</p>
          <div className="challenge-detail-meta"><span><small>ניסיונות</small><b>{selectedStats.attempts}</b></span><span><small>הצלחות / כישלונות</small><b>{selectedStats.wins} / {selectedStats.failures}</b></span><span><small>שיא אישי</small><b>{selectedStats.bestSteps === null ? '—' : `${selectedStats.bestSteps} צעדים`}</b></span></div>
          <div className="challenge-objective"><small>תנאי הצלחה</small><b>{selectedHouse.objective}</b></div>
          <div className="challenge-prize-row"><span>פרסים אפשריים</span>{Object.entries(MEDALS).map(([key, name]) => <b key={key} className={`challenge-medal medal-${key}`}>{name}</b>)}</div>
          {!selectedUnlocked && <p className="challenge-locked-note">השלימו את {CHALLENGE_HOUSES[selectedHouse.order - 2]?.title} כדי לפתוח את הבית.</p>}
          <button className="challenge-enter-button" disabled={!selectedUnlocked || Boolean(activeChallenge)} onClick={() => onStart(selectedHouse)}>{activeChallenge ? 'המשיכו או ותרו על הניסיון הפעיל' : selectedUnlocked ? 'בחירת יכולות וכניסה' : 'הבית נעול'} <span>←</span></button>
        </div>
      </section>
    </section>
  </main>
}
