import { useState, useMemo } from 'react'
import { formatPrice } from '../../utils/formatters'
import { ACTION_COLORS } from '../../utils/colors'

const FILTERS = ['ALL', 'MINE', 'CHAT']

export default function ActivityFeed({ trades, chatMessages, myAgent }) {
  const [filter, setFilter] = useState('ALL')

  // Merge trades + chat into a single sorted feed
  const feed = useMemo(() => {
    const items = []
    for (const t of (trades || [])) {
      items.push({ ...t, _type: 'trade', _sort: t.round * 1000 + items.length })
    }
    for (const c of (chatMessages || [])) {
      items.push({ ...c, _type: 'chat', _sort: c.round * 1000 + items.length })
    }
    return items.slice(0, 100)
  }, [trades, chatMessages])

  const filtered = useMemo(() => {
    if (filter === 'MINE' && myAgent) return feed.filter(f => f.agent === myAgent)
    if (filter === 'CHAT') return feed.filter(f => f._type === 'chat')
    return feed
  }, [feed, filter, myAgent])

  return (
    <div className="activity-feed panel">
      <div className="panel-header">
        <span>ACTIVITY</span>
        <div className="feed-filters">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`feed-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="feed-list">
        {filtered.map((item, i) => (
          item._type === 'chat' ? (
            <div key={`chat-${item.round}-${item.agent}-${i}`} className="feed-item feed-item--chat">
              <span className="feed-action mono" style={{ color: 'var(--accent-purple)' }}>CHAT</span>
              <span className="feed-text">
                <strong>{item.agent}</strong>: {item.text}
              </span>
              <span className="feed-round mono text-muted">R{item.round}</span>
            </div>
          ) : (
            <div key={`${item.round}-${item.agent}-${i}`} className="feed-item">
              <span
                className="feed-action mono"
                style={{ color: ACTION_COLORS[item.action] }}
              >
                {item.action}
              </span>
              <span className="feed-text">
                <strong>{item.agent}</strong>
                {item.action === 'BUY' && ` bought ${item.amount} ${item.ticker} at ${formatPrice(item.price)}`}
                {item.action === 'SELL' && ` sold ${item.amount} ${item.ticker} at ${formatPrice(item.price)}`}
              </span>
              <span className="feed-round mono text-muted">R{item.round}</span>
            </div>
          )
        ))}
        {filtered.length === 0 && (
          <div className="feed-empty text-muted">
            {filter === 'MINE' ? 'No trades from your agent yet...' : 'No activity yet...'}
          </div>
        )}
      </div>

      <style>{`
        .activity-feed {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .activity-feed .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .feed-filters {
          display: flex;
          gap: 2px;
        }
        .feed-filter-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.55rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          letter-spacing: 0.04em;
        }
        .feed-filter-btn.active {
          color: var(--accent-cyan);
          background: rgba(0, 240, 255, 0.1);
        }
        .feed-filter-btn:hover:not(.active) {
          color: var(--text-secondary);
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
        .feed-item--chat {
          background: rgba(179, 136, 255, 0.04);
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
