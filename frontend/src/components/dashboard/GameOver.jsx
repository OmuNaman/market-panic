import { motion } from 'framer-motion'
import { formatCash } from '../../utils/formatters'

const PODIUM_COLORS = ['var(--accent-amber)', '#adb5bd', '#cd7f32']
const PODIUM_LABELS = ['🥇', '🥈', '🥉']

export default function GameOver({ data }) {
  if (!data) return null

  const { final_rankings = [], highlights = {} } = data

  return (
    <motion.div
      className="gameover-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="gameover-content">
        <motion.h1
          className="gameover-title"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 12 }}
        >
          GAME OVER
        </motion.h1>

        {/* Podium */}
        <div className="podium">
          {final_rankings.slice(0, 3).map((entry, i) => (
            <motion.div
              key={entry.name}
              className="podium-entry"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.15 }}
              style={{ order: i === 0 ? 1 : i === 1 ? 0 : 2 }}
            >
              <div className="podium-medal">{PODIUM_LABELS[i]}</div>
              <div className="podium-name" style={{ color: PODIUM_COLORS[i] }}>
                {entry.name}
              </div>
              <div className="podium-value mono">{formatCash(entry.portfolio_value)}</div>
              <div
                className="podium-bar"
                style={{
                  height: `${i === 0 ? 120 : i === 1 ? 90 : 60}px`,
                  background: PODIUM_COLORS[i],
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Highlights */}
        {Object.keys(highlights).length > 0 && (
          <div className="highlights">
            {highlights.most_active && (
              <div className="highlight-card">
                <div className="highlight-label">MOST ACTIVE</div>
                <div className="highlight-value">{highlights.most_active.agent}</div>
                <div className="highlight-sub">{highlights.most_active.trade_count} trades</div>
              </div>
            )}
            {highlights.memory_champion && (
              <div className="highlight-card">
                <div className="highlight-label">MEMORY CHAMPION</div>
                <div className="highlight-value">{highlights.memory_champion.agent}</div>
                <div className="highlight-sub">{highlights.memory_champion.memory_count} memories</div>
              </div>
            )}
            {highlights.chatterbox && (
              <div className="highlight-card">
                <div className="highlight-label">CHATTERBOX</div>
                <div className="highlight-value">{highlights.chatterbox.agent}</div>
                <div className="highlight-sub">{highlights.chatterbox.message_count} messages</div>
              </div>
            )}
          </div>
        )}

        {/* Full Rankings */}
        <div className="final-rankings">
          <div className="rankings-header">FINAL STANDINGS</div>
          {final_rankings.map((entry) => (
            <div key={entry.name} className="final-rank-row">
              <span className="final-rank mono">#{entry.rank}</span>
              <span className="final-name">{entry.name}</span>
              <span className="final-value mono">{formatCash(entry.portfolio_value)}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .gameover-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 10, 15, 0.95);
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
        }
        .gameover-content {
          max-width: 700px;
          width: 100%;
          padding: 2rem;
          text-align: center;
        }
        .gameover-title {
          font-family: var(--font-mono);
          font-size: 3.5rem;
          color: var(--accent-cyan);
          text-shadow: 0 0 60px rgba(0, 240, 255, 0.5);
          letter-spacing: 0.2em;
          margin-bottom: 2rem;
        }
        .podium {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 12px;
          margin-bottom: 2rem;
        }
        .podium-entry {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          width: 140px;
        }
        .podium-medal { font-size: 2rem; }
        .podium-name {
          font-weight: 700;
          font-size: 1rem;
        }
        .podium-value {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .podium-bar {
          width: 100%;
          border-radius: 6px 6px 0 0;
          opacity: 0.3;
        }
        .highlights {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }
        .highlight-card {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 12px 20px;
          min-width: 150px;
        }
        .highlight-label {
          font-size: 0.6rem;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .highlight-value {
          font-weight: 700;
          color: var(--accent-cyan);
        }
        .highlight-sub {
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }
        .final-rankings {
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          overflow: hidden;
          text-align: left;
        }
        .rankings-header {
          padding: 10px 16px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-subtle);
        }
        .final-rank-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          border-bottom: 1px solid rgba(42, 42, 62, 0.3);
        }
        .final-rank {
          width: 30px;
          font-weight: 700;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .final-name { flex: 1; font-weight: 500; font-size: 0.85rem; }
        .final-value {
          font-size: 0.85rem;
          font-weight: 700;
        }
      `}</style>
    </motion.div>
  )
}
