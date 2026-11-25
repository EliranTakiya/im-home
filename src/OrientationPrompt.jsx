import { useEffect, useState } from 'react'
import './OrientationPrompt.css'

const MOBILE_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 900px)'

export default function OrientationPrompt({ active = true }) {
  const [portrait, setPortrait] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [lockFailed, setLockFailed] = useState(false)
  const canRequestLock = typeof window !== 'undefined' && typeof window.screen?.orientation?.lock === 'function'

  useEffect(() => {
    const query = window.matchMedia(MOBILE_PORTRAIT_QUERY)
    const update = () => {
      setPortrait(query.matches)
      setDismissed(false)
      setLockFailed(false)
    }
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const unlockOrientation = () => window.screen?.orientation?.unlock?.()
    window.addEventListener('pagehide', unlockOrientation)
    return () => window.removeEventListener('pagehide', unlockOrientation)
  }, [])

  async function requestLandscape() {
    try {
      await window.screen.orientation.lock('landscape')
      setDismissed(true)
    } catch {
      setLockFailed(true)
    }
  }

  if (!active || !portrait || dismissed) return null

  return <aside className="orientation-prompt" role="status" aria-live="polite" dir="rtl">
    <div className="orientation-prompt-icon" aria-hidden="true"><span>↻</span></div>
    <div className="orientation-prompt-copy">
      <strong>לנוחות משחק טובה יותר, סובבו את המכשיר לרוחב</strong>
      <span>{lockFailed ? 'הדפדפן לא מאפשר נעילת כיוון. אפשר לסובב את המכשיר ידנית.' : 'המשחק יתאים את המסך לכיוון המכשיר.'}</span>
    </div>
    <div className="orientation-prompt-actions">
      {canRequestLock && <button type="button" onClick={requestLandscape}>מעבר לרוחב</button>}
      <button type="button" className="orientation-prompt-dismiss" onClick={() => setDismissed(true)}>המשך לאורך</button>
    </div>
  </aside>
}
