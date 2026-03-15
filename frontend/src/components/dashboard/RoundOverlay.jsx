import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function RoundOverlay({ round }) {
  const [visible, setVisible] = useState(false)
  const [displayRound, setDisplayRound] = useState(0)
  const prevRound = useRef(0)
  const initialized = useRef(false)

  useEffect(() => {
    if (round > 0) {
      // Skip overlay on reconnect (jumping from 0 to a high round)
      if (!initialized.current) {
        initialized.current = true
        prevRound.current = round
        return
      }
      // Only show for sequential round changes (1 -> 2, not 0 -> 15)
      if (round === prevRound.current + 1) {
        setDisplayRound(round)
        setVisible(true)
        const timer = setTimeout(() => setVisible(false), 1500)
        prevRound.current = round
        return () => clearTimeout(timer)
      }
      prevRound.current = round
    }
  }, [round])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="round-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="round-overlay-text"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          >
            <span className="round-overlay-label">ROUND</span>
            <span className="round-overlay-number">{displayRound}</span>
          </motion.div>

          <style>{`
            .round-overlay {
              position: fixed;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(10, 10, 15, 0.7);
              z-index: 200;
              pointer-events: none;
            }
            .round-overlay-text {
              text-align: center;
            }
            .round-overlay-label {
              display: block;
              font-family: var(--font-mono);
              font-size: 1.5rem;
              color: var(--text-muted);
              letter-spacing: 0.3em;
            }
            .round-overlay-number {
              display: block;
              font-family: var(--font-mono);
              font-size: 8rem;
              font-weight: 700;
              color: var(--accent-cyan);
              text-shadow: 0 0 60px rgba(0, 240, 255, 0.5);
              line-height: 1;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
