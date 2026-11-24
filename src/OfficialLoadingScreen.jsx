import { useEffect, useRef } from 'react'
import loadingBackground from './assets/original loading screen image.jpeg'
import './OfficialLoadingScreen.css'

export default function OfficialLoadingScreen({ onReady }) {
  const artworkRef = useRef(null)

  useEffect(() => {
    const artwork = artworkRef.current
    if (artwork?.complete && artwork.naturalWidth > 0) onReady()
  }, [onReady])

  return <div className="official-loading-screen" role="status" aria-live="polite">
    <img className="official-loading-ambient" src={loadingBackground} alt="" aria-hidden="true" />
    <img ref={artworkRef} className="official-loading-artwork" src={loadingBackground} alt="" aria-hidden="true" onLoad={onReady} onError={onReady} />
    <div className="official-loading-brand" aria-label="I’M HOME">
      <svg className="official-loading-house" viewBox="0 0 48 38" fill="none" aria-hidden="true">
        <path d="M3 18.5 24 2l21 16.5v17H3v-17Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M18 35V22h12v13M9 14V7h7v1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M21 27h6v8h-6z" fill="currentColor" />
      </svg>
      <strong>I’M HOME</strong>
    </div>
    <div className="official-loading-progress">
      <span className="official-loading-spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  </div>
}
