import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCash, formatPrice } from '../../utils/formatters'
import { ACTION_COLORS } from '../../utils/colors'

const TABS = ['Portfolio', 'Memories', 'Decisions']

export default function AgentInspector({ agent, onClose }) {
  const [activeTab, setActiveTab] = useState('Portfolio')

  if (!agent) return null

  return (
    <AnimatePresence>
      <motion.div
        className="inspector-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="inspector-panel"
          initial={{ x: 420 }}
          animate={{ x: 0 }}
          exit={{ x: 420 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="inspector-header">
            <div className="inspector-name">{agent.name}</div>
            <button className="inspector-close" onClick={onClose}>×</button>
          </div>

          {/* Identity — shows the student's form text */}
          <div className="inspector-identity">
            <div className="identity-field">
              <span className="identity-label">PERSONALITY</span>
              <p className="identity-text">{agent.personality}</p>
            </div>
            <div className="identity-field">
              <span className="identity-label">STRATEGY</span>
              <p className="identity-text">{agent.strategy}</p>
            </div>
            <div className="identity-row">
              <span className="identity-label">RISK: </span>
              <span className="mono text-cyan">{agent.risk_level}/5</span>
              <span className="identity-label" style={{ marginLeft: 16 }}>SECTORS: </span>
              <span className="mono text-cyan">{(agent.favorite_sectors || []).join(', ') || 'Any'}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="inspector-tabs">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`inspector-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="inspector-content">
            {activeTab === 'Portfolio' && <PortfolioTab agent={agent} />}
            {activeTab === 'Memories' && <MemoriesTab memories={agent.memories} />}
            {activeTab === 'Decisions' && <DecisionsTab decisions={agent.decisions} />}
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        .inspector-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 100;
        }
        .inspector-panel {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 420px;
          max-width: 100vw;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .inspector-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .inspector-name {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 1.2rem;
          color: var(--accent-cyan);
        }
        .inspector-close {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 1.5rem;
          padding: 4px 8px;
          cursor: pointer;
        }
        .inspector-close:hover { color: var(--text-primary); }
        .inspector-identity {
          padding: 12px 20px;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .identity-field { display: flex; flex-direction: column; gap: 2px; }
        .identity-label {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .identity-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .identity-row {
          font-size: 0.75rem;
          display: flex;
          align-items: center;
        }
        .inspector-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-subtle);
        }
        .inspector-tab {
          flex: 1;
          padding: 10px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          cursor: pointer;
        }
        .inspector-tab.active {
          color: var(--accent-cyan);
          border-bottom-color: var(--accent-cyan);
        }
        .inspector-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px 20px;
        }

        /* Portfolio */
        .portfolio-value {
          font-family: var(--font-mono);
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--accent-cyan);
          margin-bottom: 4px;
        }
        .portfolio-cash {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 16px;
        }
        .holding-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(42, 42, 62, 0.3);
          font-size: 0.8rem;
        }
        .holding-ticker { font-family: var(--font-mono); font-weight: 700; }
        .holding-shares { color: var(--text-secondary); }
        .holding-value { font-family: var(--font-mono); }

        /* Memories */
        .memory-item {
          padding: 8px 0;
          border-bottom: 1px solid rgba(42, 42, 62, 0.3);
        }
        .memory-meta {
          display: flex;
          gap: 8px;
          font-size: 0.65rem;
          margin-bottom: 4px;
        }
        .memory-round { font-family: var(--font-mono); color: var(--text-muted); }
        .memory-importance { font-family: var(--font-mono); }
        .memory-text {
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .memory-compressed {
          color: var(--accent-purple);
          font-style: italic;
        }

        /* Decisions */
        .decision-item {
          padding: 8px 0;
          border-bottom: 1px solid rgba(42, 42, 62, 0.3);
        }
        .decision-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .decision-round {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--text-muted);
        }
        .decision-action {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 700;
        }
        .decision-detail {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-secondary);
        }
        .decision-reasoning {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin-top: 4px;
        }

        .empty-state {
          padding: 2rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.85rem;
        }
      `}</style>
    </AnimatePresence>
  )
}

function PortfolioTab({ agent }) {
  const portfolio = agent.portfolio || {}
  const holdings = portfolio.holdings || {}

  return (
    <div>
      <div className="portfolio-value">{formatCash(portfolio.total_value || 0)}</div>
      <div className="portfolio-cash mono">Cash: {formatCash(portfolio.cash || 0)}</div>

      {Object.keys(holdings).length > 0 ? (
        Object.entries(holdings).map(([ticker, shares]) => (
          <div key={ticker} className="holding-row">
            <span className="holding-ticker">{ticker}</span>
            <span className="holding-shares">{shares} shares</span>
          </div>
        ))
      ) : (
        <div className="empty-state">No holdings — all cash</div>
      )}
    </div>
  )
}

function MemoriesTab({ memories }) {
  if (!memories || memories.length === 0) {
    return <div className="empty-state">No memories yet</div>
  }

  const importanceColor = (imp) => {
    if (imp >= 8) return 'var(--accent-pink)'
    if (imp >= 5) return 'var(--accent-amber)'
    return 'var(--text-muted)'
  }

  return (
    <div>
      {memories.map((mem, i) => (
        <div key={i} className="memory-item">
          <div className="memory-meta">
            <span className="memory-round">R{mem.round}</span>
            <span className="memory-importance" style={{ color: importanceColor(mem.importance) }}>
              ★{mem.importance}
            </span>
            <span className="text-muted">{mem.type}</span>
          </div>
          <div className={`memory-text ${mem.type?.startsWith('compressed') ? 'memory-compressed' : ''}`}>
            {mem.text}
          </div>
        </div>
      ))}
    </div>
  )
}

function DecisionsTab({ decisions }) {
  if (!decisions || decisions.length === 0) {
    return <div className="empty-state">No decisions yet</div>
  }

  return (
    <div>
      {[...decisions].reverse().map((d, i) => (
        <div key={i} className="decision-item">
          <div className="decision-header">
            <span className="decision-round">R{d.round}</span>
            <span className="decision-action" style={{ color: ACTION_COLORS[d.action] }}>
              {d.action}
            </span>
            {d.ticker && (
              <span className="decision-detail">
                {d.amount} {d.ticker} @ {formatPrice(d.price)}
              </span>
            )}
          </div>
          <div className="decision-reasoning">{d.reasoning}</div>
        </div>
      ))}
    </div>
  )
}
