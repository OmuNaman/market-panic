import { useState } from 'react'
import { formatCash } from '../../utils/formatters'

export default function AgentManager({ agents, rankings, sendMessage }) {
  const [confirmRemove, setConfirmRemove] = useState(null)

  const handleRemove = (name) => {
    sendMessage({ type: 'remove_agent', name })
    setConfirmRemove(null)
  }

  const handleInspect = (name) => {
    sendMessage({ type: 'inspect_agent', name })
  }

  // Use rankings if available (during game), otherwise show from agents dict (pre-game)
  let agentList
  if (rankings && rankings.length > 0) {
    agentList = rankings.map(r => ({
      ...r,
      ...(agents?.[r.name] || {}),
    }))
  } else {
    agentList = Object.values(agents || {}).map(a => ({
      ...a,
      portfolio_value: 10000,
      status: 'waiting',
    }))
  }

  return (
    <div className="agent-manager panel">
      <div className="panel-header">
        AGENTS ({agentList.length})
      </div>
      <div className="agent-list">
        {agentList.map(agent => (
          <div key={agent.name} className="agent-row">
            <span className={`status-dot status-dot--${agent.status === 'thinking' ? 'thinking' : agent.status === 'error' ? 'error' : 'active'}`} />
            <span className="agent-name">{agent.name}</span>
            <span className="agent-value mono">{formatCash(agent.portfolio_value || 0)}</span>
            <button
              className="agent-action-btn"
              onClick={() => handleInspect(agent.name)}
              title="Inspect"
            >
              🔍
            </button>
            {confirmRemove === agent.name ? (
              <>
                <button
                  className="agent-action-btn text-pink"
                  onClick={() => handleRemove(agent.name)}
                >
                  ✓
                </button>
                <button
                  className="agent-action-btn"
                  onClick={() => setConfirmRemove(null)}
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                className="agent-action-btn text-muted"
                onClick={() => setConfirmRemove(agent.name)}
                title="Remove"
              >
                🗑
              </button>
            )}
          </div>
        ))}

        {agentList.length === 0 && (
          <div className="text-muted" style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
            No agents yet
          </div>
        )}
      </div>

      <style>{`
        .agent-list {
          max-height: 300px;
          overflow-y: auto;
        }
        .agent-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-bottom: 1px solid rgba(42, 42, 62, 0.3);
        }
        .agent-row:hover {
          background: var(--bg-tertiary);
        }
        .agent-name {
          flex: 1;
          font-weight: 500;
          font-size: 0.8rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .agent-value {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .agent-action-btn {
          background: none;
          border: none;
          padding: 4px 6px;
          font-size: 0.8rem;
          cursor: pointer;
          border-radius: 4px;
        }
        .agent-action-btn:hover {
          background: var(--bg-elevated);
        }
      `}</style>
    </div>
  )
}
