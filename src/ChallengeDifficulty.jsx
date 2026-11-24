import { GUARDIAN_DIFFICULTIES } from './guardianAI.js'
import { ActionFooter, GameShell } from './GameShell.jsx'
import './ChallengePreparation.css'
import './PreparationUI.css'

const COPY = {
  easy: 'ה־Guardian יופיע לעיתים רחוקות יותר ויפעיל יכולות בתדירות נמוכה יותר.',
  normal: 'אתגר מאוזן עם Guardian פעיל יותר וטווח תגובה רחב יותר.',
  hard: 'סיכוי הופעה גבוה יותר, נוכחות ארוכה יותר ותגובות אגרסיביות יותר.',
}

export default function ChallengeDifficulty({ house, value, onSelect, onContinue, onCancel }) {
  return <GameShell className="preparation-game-shell challenge-preparation-game"><main className="challenge-preparation" dir="rtl">
    <header className="preparation-header"><button onClick={onCancel}>חזרה לבחירת בית</button><div><span>הכנות לאתגר · שלב 2 מתוך 7</span><h1>בחרו רמת קושי</h1><p>{house.title}</p></div><b>I’M HOME</b></header>
    <section className="difficulty-options" aria-label="רמת קושי של Guardian">
      {Object.entries(GUARDIAN_DIFFICULTIES).map(([id, profile]) => <button type="button" key={id} className={value === id ? 'difficulty-option difficulty-option-selected' : 'difficulty-option'} aria-pressed={value === id} onClick={() => onSelect(id)}>
        <span>{id.toUpperCase()}</span><b>{profile.label}</b><p>{COPY[id]}</p><small>הופעה {Math.round(profile.appearanceChance * 100)}% · נוכחות {profile.stayMinSeconds}–{profile.stayMaxSeconds} שנ׳</small>
      </button>)}
    </section>
    <ActionFooter className="preparation-actions"><span>ברירת המחדל לבית הזה: {GUARDIAN_DIFFICULTIES[house.guardianDifficulty]?.label ?? 'רגיל'}</span><button onClick={onContinue}>המשך ליכולות ההגנה <b>←</b></button></ActionFooter>
  </main></GameShell>
}
