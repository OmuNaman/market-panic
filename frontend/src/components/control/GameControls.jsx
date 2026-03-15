import { useState } from 'react'

const SPEEDS = [0.5, 1, 1.5, 2, 3]

export default function GameControls({ gameStatus, round, totalRounds, speed, sendMessage }) {
  const [rounds, setRounds] = useState(30)
  const [roundDuration, setRoundDuration] = useState(30)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const handleStart = () => {
    sendMessage({
      type: 'start_game',
      config: { total_rounds: rounds, round_duration: roundDuration },
    })
  }

  return (
    <div className="game-controls panel">
      <div className="panel-header">GAME CONTROLS</div>
      <div className="panel-body controls-body">
        {gameStatus === 'waiting' && (
          <>
            <div className="config-row">
              <label>Rounds</label>
              <input
                type="number"
                value={rounds}
                onChange={e => setRounds(Number(e.target.value))}
                min={5}
                max={100}
                className="config-input"
              />
            </div>
            <div className="config-row">
              <label>Duration (sec)</label>
              <input
                type="number"
                value={roundDuration}
                onChange={e => setRoundDuration(Number(e.target.value))}
                min={5}
                max={120}
                className="config-input"
              />
            </div>
            <button className="ctrl-btn ctrl-start" onClick={handleStart}>
              START GAME
            </button>
          </>
        )}

        {gameStatus === 'running' && (
          <>
            <div className="round-info mono">
              Round <span className="text-cyan">{round}</span> / {totalRounds}
            </div>
            <button
              className="ctrl-btn ctrl-pause"
              onClick={() => sendMessage({ type: 'pause_game' })}
            >
              PAUSE
            </button>
          </>
        )}

        {gameStatus === 'paused' && (
          <button
            className="ctrl-btn ctrl-start"
            onClick={() => sendMessage({ type: 'resume_game' })}
          >
            RESUME
          </button>
        )}

        {(gameStatus === 'running' || gameStatus === 'paused') && (
          <>
            <div className="speed-controls">
              <span className="speed-label">SPEED</span>
              <div className="speed-buttons">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    className={`speed-btn ${speed === s ? 'active' : ''}`}
                    onClick={() => sendMessage({ type: 'set_speed', multiplier: s })}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            {!confirmEnd ? (
              <button
                className="ctrl-btn ctrl-end"
                onClick={() => setConfirmEnd(true)}
              >
                END GAME
              </button>
            ) : (
              <div className="confirm-end">
                <span>End the game?</span>
                <button
                  className="ctrl-btn ctrl-end"
                  onClick={() => {
                    sendMessage({ type: 'end_game' })
                    setConfirmEnd(false)
                  }}
                >
                  YES, END IT
                </button>
                <button
                  className="ctrl-btn ctrl-cancel"
                  onClick={() => setConfirmEnd(false)}
                >
                  CANCEL
                </button>
              </div>
            )}
          </>
        )}

        {gameStatus === 'finished' && (
          <div className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>
            Game finished. Refresh to start a new session.
          </div>
        )}
      </div>

      <style>{`
        .controls-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .config-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .config-row label {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .config-input {
          width: 80px;
          text-align: center;
          font-family: var(--font-mono);
          padding: 8px;
        }
        .ctrl-btn {
          width: 100%;
          padding: 16px;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 8px;
          letter-spacing: 0.08em;
          min-height: 56px;
        }
        .ctrl-start {
          background: transparent;
          color: var(--accent-green);
          border: 2px solid var(--accent-green);
          box-shadow: var(--glow-green);
        }
        .ctrl-start:hover { background: rgba(0, 230, 118, 0.1); }
        .ctrl-pause {
          background: transparent;
          color: var(--accent-amber);
          border: 2px solid var(--accent-amber);
        }
        .ctrl-pause:hover { background: rgba(255, 171, 0, 0.1); }
        .ctrl-end {
          background: transparent;
          color: var(--accent-pink);
          border: 2px solid var(--accent-pink);
          box-shadow: var(--glow-pink);
        }
        .ctrl-end:hover { background: rgba(255, 45, 122, 0.1); }
        .ctrl-cancel {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border-subtle);
        }
        .round-info {
          text-align: center;
          font-size: 1.1rem;
        }
        .speed-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .speed-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.06em;
        }
        .speed-buttons {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .speed-btn {
          flex: 1;
          padding: 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.75rem;
        }
        .speed-btn.active {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          box-shadow: var(--glow-cyan);
        }
        .confirm-end {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: center;
          color: var(--accent-pink);
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}
