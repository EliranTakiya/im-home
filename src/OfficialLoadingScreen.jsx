import { useCallback, useEffect, useRef, useState } from 'react'
import loadingBackground from './assets/original loading screen image.jpeg'
import './OfficialLoadingScreen.css'

const MINIMUM_DISPLAY_MS = 500

export default function OfficialLoadingScreen({ onReady, appReady = false }) {
  const artworkRef = useRef(null)
  const startedAt = useRef(null)
  const [artworkReady, setArtworkReady] = useState(false)
  const markArtworkReady = useCallback(() => setArtworkReady(true), [])

  useEffect(() => {
    startedAt.current = performance.now()
  }, [])

  useEffect(() => {
    const artwork = artworkRef.current
    if (artwork?.complete && artwork.naturalWidth > 0) markArtworkReady()
  }, [markArtworkReady])

  useEffect(() => {
    if (!appReady || !artworkReady) return undefined
    const remaining = Math.max(0, MINIMUM_DISPLAY_MS - (performance.now() - (startedAt.current ?? performance.now())))
    const timeout = window.setTimeout(onReady, remaining)
    return () => window.clearTimeout(timeout)
  }, [appReady, artworkReady, onReady])

  return <div className="official-loading-screen" role="status" aria-live="polite">
    <img className="official-loading-ambient" src={loadingBackground} alt="" aria-hidden="true" />
    <img ref={artworkRef} className="official-loading-artwork" src={loadingBackground} alt="" aria-hidden="true" onLoad={markArtworkReady} onError={markArtworkReady} />
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
