import { useState, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useMarketState } from '../hooks/useMarketState'
import GameControls from '../components/control/GameControls'
import EventInjector from '../components/control/EventInjector'
import ScenarioLoader from '../components/control/ScenarioLoader'
import AgentManager from '../components/control/AgentManager'
import LiveStats from '../components/control/LiveStats'
import EventTimeline from '../components/control/EventTimeline'

export default function ControlPage() {
  const [password, setPassword] = useState(sessionStorage.getItem('control_password') || '')
  const [authenticated, setAuthenticated] = useState(!!sessionStorage.getItem('control_password'))

  if (!authenticated) {
    return (
      <div className="control-gate">
        <div className="gate-card">
          <h1 className="mono text-cyan">CONTROL PANEL</h1>
          <p className="text-secondary">Enter instructor password</p>
          <form onSubmit={(e) => {
            e.preventDefault()
            sessionStorage.setItem('control_password', password)
            setAuthenticated(true)
          }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password..."
              autoFocus
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
              ENTER
            </button>
          </form>
        </div>

        <style>{`
          .control-gate {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .gate-card {
            max-width: 360px;
            width: 100%;
            background: var(--bg-secondary);
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
          }
          .gate-card h1 {
            font-size: 1.2rem;
            letter-spacing: 0.1em;
            margin-bottom: 0.5rem;
          }
          .gate-card p { margin-bottom: 1.5rem; font-size: 0.85rem; }
        `}</style>
      </div>
    )
  }

  return <ControlInner password={password} onAuthFail={() => {
    setAuthenticated(false)
    setPassword('')
  }} />
}

function ControlInner({ password, onAuthFail }) {
  const { state, handleMessage } = useMarketState()

  const { sendMessage, isConnected, authFailed } = useWebSocket('/ws/instructor', {
    onMessage: handleMessage,
    queryParams: { password },
  })

  // If auth failed, clear stored password and go back to login
  if (authFailed) {
    sessionStorage.removeItem('control_password')
    if (onAuthFail) onAuthFail()
    return (
      <div className="control-gate">
        <div className="gate-card">
          <h1 className="mono text-pink">ACCESS DENIED</h1>
          <p className="text-secondary">Wrong password. Please try again.</p>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={onAuthFail}>
            RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="control-page">
      <div className="control-header">
        <h1 className="mono text-cyan">MARKET PANIC — CONTROL</h1>
        <div className="control-status">
          <span className={`status-dot ${isConnected ? 'status-dot--active' : 'status-dot--error'}`} />
          <span className="mono" style={{ fontSize: '0.75rem' }}>
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
          {state.round > 0 && (
            <span className="mono text-muted" style={{ marginLeft: 12, fontSize: '0.75rem' }}>
              R:{state.round}
            </span>
          )}
        </div>
      </div>

      <div className="control-grid">
        <div className="cg-controls">
          <GameControls
            gameStatus={state.gameStatus}
            round={state.round}
            totalRounds={state.totalRounds}
            speed={state.speed}
            sendMessage={sendMessage}
          />
        </div>
        <div className="cg-stats">
          <LiveStats
            round={state.round}
            totalRounds={state.totalRounds}
            agentCount={state.rankings?.length || Object.keys(state.agents).length}
            speed={state.speed}
          />
        </div>
        <div className="cg-scenarios">
          <ScenarioLoader sendMessage={sendMessage} />
        </div>
        <div className="cg-injector">
          <EventInjector sendMessage={sendMessage} />
        </div>
        <div className="cg-agents">
          <AgentManager
            agents={state.agents}
            rankings={state.rankings}
            sendMessage={sendMessage}
          />
        </div>
        <div className="cg-timeline">
          <EventTimeline news={state.news} />
        </div>
      </div>

      <style>{`
        .control-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary);
        }
        .control-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
        }
        .control-header h1 {
          font-size: 1rem;
          letter-spacing: 0.1em;
        }
        .control-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .control-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto auto auto;
          gap: 16px;
          padding: 16px 24px 24px;
        }
        .cg-controls { grid-column: 1; }
        .cg-stats { grid-column: 2; }
        .cg-scenarios { grid-column: 1 / -1; }
        .cg-injector { grid-column: 1 / -1; }
        .cg-agents { grid-column: 1; }
        .cg-timeline { grid-column: 2; }

        @media (max-width: 768px) {
          .control-grid {
            grid-template-columns: 1fr;
            padding: 12px;
            gap: 12px;
          }
          .cg-controls,
          .cg-stats,
          .cg-scenarios,
          .cg-injector,
          .cg-agents,
          .cg-timeline {
            grid-column: 1;
          }
        }
      `}</style>
    </div>
  )
}
