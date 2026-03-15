import { memo } from 'react'
import { motion } from 'framer-motion'
import { formatCash } from '../../utils/formatters'

const ACTION_BADGE = {
  BUY: 'badge-buy',
  SELL: 'badge-sell',
  HOLD: 'badge-hold',
  CHAT: 'badge-chat',
}

const RANK_ACCENT = {
  1: 'var(--accent-amber)',    // gold
  2: '#adb5bd',                // silver
  3: '#cd7f32',                // bronze
}

export default memo(function LeaderboardRow({ rank, name, portfolioValue, lastAction, status, isMe, disableLayout, onClick }) {
  const accentColor = RANK_ACCENT[rank]
  const actionWord = lastAction?.split(' ')[0] || 'HOLD'
  const badgeClass = ACTION_BADGE[actionWord] || 'badge-hold'

  return (
    <motion.div
      layout={!disableLayout}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`lb-row ${isMe ? 'lb-row--me' : ''}`}
      onClick={onClick}
      style={{
        borderLeftColor: isMe ? 'var(--accent-cyan)' : (accentColor || 'transparent'),
        cursor: 'pointer',
      }}
    >
      <span className="lb-rank mono" style={{ color: accentColor }}>
        #{rank}
      </span>
      <span className="lb-name">
        {name}
        {isMe && <span className="lb-you-tag">YOU</span>}
      </span>
      <span className="lb-value mono">{formatCash(portfolioValue)}</span>
      <span className={`badge ${badgeClass}`}>{lastAction || 'WAITING'}</span>
      <span className={`status-dot status-dot--${status === 'thinking' ? 'thinking' : status === 'trading' ? 'active' : 'idle'}`} />

      <style>{`
        .lb-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-left: 3px solid transparent;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s;
        }
        .lb-row:hover {
          background: var(--bg-tertiary);
        }
        .lb-row--me {
          background: rgba(0, 240, 255, 0.05);
          border-left-width: 3px;
        }
        .lb-rank {
          width: 32px;
          font-weight: 700;
          font-size: 0.85rem;
        }
        .lb-name {
          flex: 1;
          font-weight: 700;
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .lb-you-tag {
          font-family: var(--font-mono);
          font-size: 0.55rem;
          font-weight: 700;
          color: var(--accent-cyan);
          background: rgba(0, 240, 255, 0.12);
          padding: 1px 5px;
          border-radius: 3px;
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }
        .lb-value {
          font-size: 0.85rem;
          font-weight: 700;
          min-width: 90px;
          text-align: right;
        }
      `}</style>
    </motion.div>
  )
})
