import { PERK_CATALOG } from './perks.js'
import { EQUIPMENT_CATALOG } from './equipment.js'
import { GUARDIAN_DIFFICULTIES } from './guardianAI.js'
import { ActionFooter, GameShell } from './GameShell.jsx'
import './ChallengePreparation.css'
import './PreparationUI.css'

export default function ChallengeSummary({ draft, house, onBack, onStart }) {
  const guestPerks = draft.perkSelection?.guest?.selectedIds ?? []
  const ownerPerks = house.guardianPerks ?? []
  const selectedTools = draft.selectedToolIds ?? []
  const perkNames = (ids) => ids.map((id) => PERK_CATALOG.find((perk) => perk.id === id)?.name ?? id)
  const toolNames = selectedTools.map((id) => EQUIPMENT_CATALOG[id]?.name ?? id)
  return <GameShell className="preparation-game-shell challenge-preparation-game"><main className="challenge-preparation" dir="rtl">
    <header className="preparation-header"><button onClick={onBack}>חזרה לציוד</button><div><span>הכנות לאתגר · שלב 6 מתוך 7</span><h1>סיכום ההכנות</h1><p>בדקו את הבחירות לפני תחילת הביקור</p></div><b>I’M HOME</b></header>
    <section className="challenge-summary-grid">
      <article><small>בית האתגר</small><h2>{house.title}</h2></article>
      <article><small>רמת קושי · נעולה לניסיון</small><h2>{GUARDIAN_DIFFICULTIES[draft.guardianDifficulty]?.label ?? draft.guardianDifficulty}</h2></article>
      <article><small>יכולות הגנה זמינות ל־Guardian</small>{ownerPerks.length ? <ul>{perkNames(ownerPerks).map((name) => <li key={name}>{name}</li>)}</ul> : <p>אין יכולות Host Perks מיוחדות</p>}</article>
      <article><small>Guest Perks</small>{guestPerks.length ? <ul>{perkNames(guestPerks).map((name) => <li key={name}>{name}</li>)}</ul> : <p>לא נבחרו יכולות</p>}</article>
      <article><small>ציוד וכלים</small>{toolNames.length ? <ul>{toolNames.map((name) => <li key={name}>{name}</li>)}</ul> : <p>לא נבחר ציוד</p>}</article>
    </section>
    <ActionFooter className="preparation-actions"><span>הביקור ייווצר רק לאחר האישור</span><button onClick={onStart}>Start Challenge <b>←</b></button></ActionFooter>
  </main></GameShell>
}
