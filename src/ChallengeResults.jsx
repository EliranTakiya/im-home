import { calculateVisitScore } from './visitEngine.js'
import { evaluateChallengeMedal } from './challenges/progress.js'
import { elapsedGameplayMs, formatGameplayTime } from './gameTimer.js'
import { ActionFooter, WideModal } from './GameShell.jsx'
import './ChallengeResults.css'
import './PreparationUI.css'

const MEDALS = {
  gold: { title: 'מדליית זהב', glyph: '✦', copy: 'מסלול יעיל במיוחד.' },
  silver: { title: 'מדליית כסף', glyph: '◇', copy: 'ביצוע מדויק.' },
  bronze: { title: 'מדליית ארד', glyph: '◆', copy: 'האתגר הושלם.' },
}

export default function ChallengeResults({ house, visit, onReplay, onHouses }) {
  const medal = evaluateChallengeMedal(house.id, visit)
  const score = calculateVisitScore(visit)
  const gameplayTime = formatGameplayTime(elapsedGameplayMs(visit))
  const success = Boolean(medal)
  return <WideModal title={success ? MEDALS[medal].title : 'האתגר לא הושלם'} eyebrow={`${house.name} · תוצאת ניסיון`} className="challenge-result-dialog challenge-result-modal" footer={<ActionFooter className="challenge-result-actions"><button onClick={onHouses}>בחירת בתים</button><button className="result-replay" onClick={onReplay}>נסו שוב <span>↻</span></button></ActionFooter>}>
      <span className={`challenge-result-medal ${success ? `result-${medal}` : 'result-failure'}`} aria-hidden="true">{success ? MEDALS[medal].glyph : '×'}</span>
      <p>{success ? MEDALS[medal].copy : visit.outcome === 'dead' ? 'נקודות החיים אזלו במהלך הביקור.' : 'הביקור הסתיים לפני השלמת היעד והחזרה לכניסה.'}</p>
      <div className="challenge-result-stats"><span><small>זמן משחק</small><b>{gameplayTime}</b></span><span><small>צעדים</small><b>{visit.guest.stepsTaken}</b></span><span><small>מסלול מינימלי</small><b>{visit.minimumSteps}</b></span><span><small>חיים שנותרו</small><b>{visit.guest.health}</b></span><span><small>ניקוד</small><b>{score.total}</b></span></div>
      <div className="challenge-result-reward"><small>{success ? 'הישג שנשמר' : 'פרס השלמה'}</small><b>{success ? `${house.title} · ${MEDALS[medal].title}` : 'לא הוענק פרס השלמה'}</b></div>
  </WideModal>
}
