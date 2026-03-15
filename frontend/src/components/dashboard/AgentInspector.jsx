import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCash, formatPrice } from '../../utils/formatters'
import { ACTION_COLORS } from '../../utils/colors'

const TABS = ['Portfolio', 'Memories', 'Decisions', 'Config']

export default function AgentInspector({ agent, onClose }) {
  const [activeTab, setActiveTab] = useState('Portfolio')

  return (
    <>
      <AnimatePresence>
        {agent && (
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
                {activeTab === 'Config' && <ConfigTab agent={agent} />}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </>
  )
}

function PortfolioTab({ agent }) {
  const portfolio = agent.portfolio || {}
  const holdings = portfolio.holdings || {}
  const prices = agent.prices || {}

  return (
    <div>
      <div className="portfolio-value">{formatCash(portfolio.total_value || 0)}</div>
      <div className="portfolio-cash mono">Cash: {formatCash(portfolio.cash || 0)}</div>

      {Object.keys(holdings).length > 0 ? (
        Object.entries(holdings).map(([ticker, shares]) => {
          const value = shares * (prices[ticker] || 0)
          return (
            <div key={ticker} className="holding-row">
              <span className="holding-ticker">{ticker}</span>
              <span className="holding-shares">{shares} shares</span>
              <span className="holding-value mono">{formatCash(value)}</span>
            </div>
          )
        })
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
              {'\u2605'}{mem.importance}
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

function ConfigTab({ agent }) {
  const focusLabels = { episodic: 'Episodic', semantic: 'Semantic', procedural: 'Procedural' }
  const forgetLabels = { 1: 'Elephant', 2: 'Studious', 3: 'Balanced', 4: 'Breezy', 5: 'Goldfish' }
  const mdc = agent.market_data_config || {}
  const mf = agent.memory_filters || {}

  const ConfigRow = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(42,42,62,0.3)', fontSize: '0.78rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{value}</span>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>TOKEN WAR ROOM</div>
      <ConfigRow label="Research docs" value={agent.rag_doc_count ?? 5} />
      <ConfigRow label="Memory slots" value={agent.memory_recall_count ?? 10} />
      <ConfigRow label="Min importance" value={agent.memory_importance_threshold ?? 3} />
      <ConfigRow label="Chat messages" value={agent.chat_history_count ?? 5} />
      <ConfigRow label="Price changes" value={mdc.price_changes !== false ? 'ON' : 'OFF'} />
      <ConfigRow label="Full history" value={mdc.full_price_history ? 'ON' : 'OFF'} />
      <ConfigRow label="Portfolio" value={mdc.portfolio_state !== false ? 'ON' : 'OFF'} />
      <ConfigRow label="News events" value={mdc.active_events !== false ? 'ON' : 'OFF'} />
      <ConfigRow label="Leaderboard" value={mdc.agent_rankings ? 'ON' : 'OFF'} />

      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 16, marginBottom: 8 }}>MEMORY ARCHITECT</div>
      <ConfigRow label="Focus" value={focusLabels[agent.memory_focus] || 'Episodic'} />
      <ConfigRow label="Decay speed" value={forgetLabels[agent.forgetting_speed] || 'Balanced'} />
      <ConfigRow label="Compress after" value={`${agent.compression_trigger ?? 50} memories`} />
      <ConfigRow label="Price threshold" value={`${mf.price_threshold ?? 3}%`} />
      <ConfigRow label="Remember trades" value={mf.own_trades !== false ? 'ON' : 'OFF'} />
      <ConfigRow label="Remember chat" value={mf.chat_messages ? 'ON' : 'OFF'} />
      <ConfigRow label="Portfolio snaps" value={mf.portfolio_snapshots ? 'ON' : 'OFF'} />
      <ConfigRow label="HOLD decisions" value={mf.failed_trades ? 'ON' : 'OFF'} />
    </div>
  )
}
