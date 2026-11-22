import { calculateVisitScore } from './visitEngine.js'
import { evaluateChallengeMedal } from './challenges/progress.js'
import './ChallengeResults.css'

const MEDALS = {
  gold: { title: 'מדליית זהב', glyph: '✦', copy: 'מסלול יעיל במיוחד.' },
  silver: { title: 'מדליית כסף', glyph: '◇', copy: 'ביצוע מדויק.' },
  bronze: { title: 'מדליית ארד', glyph: '◆', copy: 'האתגר הושלם.' },
}

export default function ChallengeResults({ house, visit, onReplay, onHouses }) {
  const medal = evaluateChallengeMedal(house.id, visit)
  const score = calculateVisitScore(visit)
  const success = Boolean(medal)
  return <div className="challenge-result-backdrop" role="presentation">
    <section className="challenge-result-dialog" role="dialog" aria-modal="true" aria-labelledby="challenge-result-title">
      <span className="challenge-result-eyebrow">{house.name} · תוצאת ניסיון</span>
      <span className={`challenge-result-medal ${success ? `result-${medal}` : 'result-failure'}`} aria-hidden="true">{success ? MEDALS[medal].glyph : '×'}</span>
      <h2 id="challenge-result-title">{success ? MEDALS[medal].title : 'האתגר לא הושלם'}</h2>
      <p>{success ? MEDALS[medal].copy : visit.outcome === 'dead' ? 'נקודות החיים אזלו במהלך הביקור.' : 'הביקור הסתיים לפני השלמת היעד והחזרה לכניסה.'}</p>
      <div className="challenge-result-stats"><span><small>צעדים</small><b>{visit.guest.stepsTaken}</b></span><span><small>מסלול מינימלי</small><b>{visit.minimumSteps}</b></span><span><small>חיים שנותרו</small><b>{visit.guest.health}</b></span><span><small>ניקוד</small><b>{score.total}</b></span></div>
      <div className="challenge-result-reward"><small>{success ? 'הישג שנשמר' : 'פרס השלמה'}</small><b>{success ? `${house.title} · ${MEDALS[medal].title}` : 'לא הוענק פרס השלמה'}</b></div>
      <div className="challenge-result-actions"><button onClick={onHouses}>בחירת בתים</button><button className="result-replay" onClick={onReplay}>נסו שוב <span>↻</span></button></div>
    </section>
  </div>
}
