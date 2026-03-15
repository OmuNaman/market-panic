import { createContext, useContext, useRef, useState, useCallback } from 'react'

const SoundContext = createContext(null)

export function useSounds() {
  return useContext(SoundContext)
}

export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(true) // start muted (browser autoplay policy)
  const audioCtxRef = useRef(null)

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  const playTone = useCallback((freq, duration, type = 'sine', volume = 0.15) => {
    if (muted) return
    try {
      const ctx = getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch {
      // ignore audio errors
    }
  }, [muted, getCtx])

  const sounds = {
    tick: () => playTone(800, 0.05, 'sine', 0.08),
    trade: () => playTone(1200, 0.08, 'sine', 0.1),
    news: () => {
      playTone(600, 0.15, 'square', 0.08)
      setTimeout(() => playTone(800, 0.15, 'square', 0.08), 100)
    },
    panic: () => {
      playTone(200, 0.4, 'sawtooth', 0.12)
      setTimeout(() => playTone(150, 0.4, 'sawtooth', 0.1), 200)
    },
    roundStart: () => {
      playTone(523, 0.12, 'sine', 0.1)
      setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100)
      setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 200)
    },
    gameOver: () => {
      playTone(523, 0.3, 'sine', 0.15)
      setTimeout(() => playTone(659, 0.3, 'sine', 0.15), 200)
      setTimeout(() => playTone(784, 0.3, 'sine', 0.15), 400)
      setTimeout(() => playTone(1047, 0.5, 'sine', 0.18), 600)
    },
  }

  const toggleMute = useCallback(() => {
    if (muted) {
      // First unmute — initialize audio context (requires user gesture)
      getCtx()
    }
    setMuted(m => !m)
  }, [muted, getCtx])

  return (
    <SoundContext.Provider value={{ sounds, muted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  )
}

export function MuteButton() {
  const { muted, toggleMute } = useSounds() || {}

  return (
    <button
      onClick={toggleMute}
      className="mute-btn"
      title={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? '🔇' : '🔊'}

      <style>{`
        .mute-btn {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 1rem;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .mute-btn:hover {
          border-color: var(--accent-cyan);
        }
      `}</style>
    </button>
  )
}
