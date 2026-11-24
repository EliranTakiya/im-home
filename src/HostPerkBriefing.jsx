import { PERK_CATALOG } from './perks.js'
import { ActionFooter, GameShell } from './GameShell.jsx'
import './ChallengePreparation.css'
import './PreparationUI.css'

export default function HostPerkBriefing({ house, onContinue, onBack }) {
  const perks = (house.guardianPerks ?? []).map((id) => PERK_CATALOG.find((perk) => perk.id === id)).filter(Boolean)
  return <GameShell className="preparation-game-shell challenge-preparation-game"><main className="challenge-preparation" dir="rtl">
    <header className="preparation-header"><button onClick={onBack}>חזרה לבחירת קושי</button><div><span>הכנות לאתגר · שלב 3 מתוך 7</span><h1>יכולות ההגנה בבית</h1><p>{house.title}</p></div><b>I’M HOME</b></header>
    <section className="host-perk-briefing">
      <p>אלה היכולות הזמינות ל־Guardian באתגר. הן עשויות לפעול בהתאם למצב המשחק; מיקומי מלכודות ומידע סודי על המפה אינם מוצגים כאן.</p>
      {perks.length ? <div className="preparation-perks">{perks.map((perk) => <article key={perk.id}><span aria-hidden="true">✦</span><div><small>HOST PERK · {perk.category === 'defense' ? 'הגנתי' : 'שליטה'}</small><h2>{perk.name}</h2><p>{perk.description}</p><em>עד {perk.maxActivationsPerVisit ?? 1} הפעלות לניסיון</em></div></article>)}</div> : <div className="no-host-perks"><span>◇</span><div><b>אין יכולות הגנה מיוחדות פעילות בבית הזה</b><p>ה־Guardian לא קיבל Host Perks לאתגר הזה.</p></div></div>}
    </section>
    <ActionFooter className="preparation-actions"><span>השלב הבא: בחירת Guest Perks</span><button onClick={onContinue}>המשך ליכולות האורח <b>←</b></button></ActionFooter>
  </main></GameShell>
}
