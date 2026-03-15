import { motion, AnimatePresence } from 'framer-motion'
import { formatPrice } from '../../utils/formatters'
import { ACTION_COLORS } from '../../utils/colors'

export default function ActivityFeed({ trades }) {
  return (
    <div className="activity-feed panel">
      <div className="panel-header">ACTIVITY</div>
      <div className="feed-list">
        <AnimatePresence initial={false}>
          {(trades || []).slice(0, 50).map((trade, i) => (
            <motion.div
              key={`${trade.round}-${trade.agent}-${i}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="feed-item"
            >
              <span
                className="feed-action mono"
                style={{ color: ACTION_COLORS[trade.action] }}
              >
                {trade.action}
              </span>
              <span className="feed-text">
                <strong>{trade.agent}</strong>
                {trade.action === 'BUY' && ` bought ${trade.amount} ${trade.ticker} at ${formatPrice(trade.price)}`}
                {trade.action === 'SELL' && ` sold ${trade.amount} ${trade.ticker} at ${formatPrice(trade.price)}`}
              </span>
              <span className="feed-round mono text-muted">R{trade.round}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {(!trades || trades.length === 0) && (
          <div className="feed-empty text-muted">No trades yet...</div>
        )}
      </div>

      <style>{`
        .activity-feed {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .feed-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .feed-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          font-size: 0.78rem;
          border-bottom: 1px solid rgba(42, 42, 62, 0.3);
        }
        .feed-action {
          font-weight: 700;
          font-size: 0.65rem;
          width: 36px;
          flex-shrink: 0;
        }
        .feed-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-secondary);
        }
        .feed-text strong {
          color: var(--text-primary);
        }
        .feed-round {
          font-size: 0.65rem;
          flex-shrink: 0;
        }
        .feed-empty {
          padding: 2rem;
          text-align: center;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  )
}
