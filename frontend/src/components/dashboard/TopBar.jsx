import { MuteButton } from './SoundEngine'

export default function TopBar({ round, totalRounds, gameStatus, isConnected, rankings }) {
  const statusColor = {
    waiting: 'var(--text-muted)',
    running: 'var(--accent-green)',
    paused: 'var(--accent-amber)',
    finished: 'var(--accent-pink)',
  }[gameStatus] || 'var(--text-muted)'

  const statusText = {
    waiting: 'WAITING',
    running: 'LIVE',
    paused: 'PAUSED',
    finished: 'GAME OVER',
  }[gameStatus] || gameStatus?.toUpperCase()

  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-logo">MARKET PANIC</h1>
      </div>
      <div className="topbar-center">
        <div className="round-display">
          <span className="round-label">ROUND</span>
          <span className="round-number mono">{round}</span>
          <span className="round-total">/ {totalRounds}</span>
        </div>
        {gameStatus === 'running' && totalRounds > 0 && (
          <div className="round-bar">
            <div
              className="round-bar-fill"
              style={{ width: `${(round / totalRounds) * 100}%` }}
            />
          </div>
        )}
        {(() => {
          const thinking = (rankings || []).filter(r => r.status === 'thinking').length
          const total = (rankings || []).length
          if (thinking > 0 && total > 0) {
            return (
              <span className="thinking-indicator mono">
                {total - thinking}/{total} decided
              </span>
            )
          }
          return null
        })()}
      </div>
      <div className="topbar-right">
        <MuteButton />
        <div className="status-badge" style={{ color: statusColor }}>
          <span
            className="status-dot"
            style={{ background: statusColor }}
          />
          {statusText}
        </div>
        <div className="connection-indicator">
          <span
            className={`status-dot ${isConnected ? 'status-dot--active' : 'status-dot--error'}`}
          />
        </div>
      </div>

      <style>{`
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          height: 56px;
        }
        .topbar-logo {
          font-family: var(--font-mono);
          font-size: 1.1rem;
          color: var(--accent-cyan);
          text-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
          letter-spacing: 0.12em;
        }
        .topbar-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .round-display {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .round-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          letter-spacing: 0.1em;
        }
        .round-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .round-total {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .round-bar {
          width: 120px;
          height: 3px;
          background: var(--bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
        }
        .round-bar-fill {
          height: 100%;
          background: var(--accent-cyan);
          transition: width 0.5s var(--ease-snappy);
        }
        .thinking-indicator {
          font-size: 0.6rem;
          color: var(--accent-amber);
          letter-spacing: 0.04em;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .status-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
        }
        .connection-indicator {
          display: flex;
          align-items: center;
        }
      `}</style>
    </div>
  )
}
