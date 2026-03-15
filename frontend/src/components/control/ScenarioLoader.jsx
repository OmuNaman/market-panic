import { useState, useEffect } from 'react'

const SCENARIO_DESCRIPTIONS = {
  flash_crash: { name: 'Flash Crash', desc: 'Algorithmic glitch → market-wide panic → recovery', icon: '💥' },
  earnings_season: { name: 'Earnings Season', desc: 'Mixed results — some beat, some miss', icon: '📊' },
  the_big_lie: { name: 'The Big Lie', desc: 'Fake merger rumor → hype → denial crash', icon: '🤥' },
  sector_rotation: { name: 'Sector Rotation', desc: 'Money flows from tech to defense & energy', icon: '🔄' },
  bull_run: { name: 'Bull Run', desc: 'Rate cut → consumer confidence → broad rally', icon: '🐂' },
  insider_tip: { name: 'Insider Tip', desc: 'Unusual activity → pharma breakthrough', icon: '🔮' },
}

export default function ScenarioLoader({ sendMessage }) {
  const [scenarios, setScenarios] = useState([])
  const [loaded, setLoaded] = useState(new Set())

  useEffect(() => {
    fetch('/api/events/scenarios')
      .then(r => r.json())
      .then(d => setScenarios(d.scenarios || []))
      .catch(() => {})
  }, [])

  const handleLoad = (name) => {
    sendMessage({ type: 'inject_scenario', scenario_name: name })
    setLoaded(prev => new Set([...prev, name]))
  }

  return (
    <div className="scenario-loader panel">
      <div className="panel-header">SCENARIOS</div>
      <div className="panel-body scenario-grid">
        {Object.entries(SCENARIO_DESCRIPTIONS).map(([key, info]) => (
          <button
            key={key}
            className={`scenario-card ${loaded.has(key) ? 'loaded' : ''}`}
            onClick={() => handleLoad(key)}
            disabled={loaded.has(key)}
          >
            <span className="scenario-icon">{info.icon}</span>
            <span className="scenario-name">{info.name}</span>
            <span className="scenario-desc">{info.desc}</span>
            {loaded.has(key) && <span className="scenario-badge">LOADED</span>}
          </button>
        ))}
      </div>

      <style>{`
        .scenario-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .scenario-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-secondary);
          text-align: center;
          cursor: pointer;
          transition: all 0.2s var(--ease-snappy);
          position: relative;
        }
        .scenario-card:hover:not(:disabled) {
          border-color: var(--accent-cyan);
          box-shadow: var(--glow-cyan);
        }
        .scenario-card:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .scenario-card.loaded {
          border-color: var(--accent-green);
        }
        .scenario-icon { font-size: 1.5rem; }
        .scenario-name {
          font-weight: 700;
          font-size: 0.75rem;
          color: var(--text-primary);
        }
        .scenario-desc {
          font-size: 0.6rem;
          line-height: 1.3;
        }
        .scenario-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          font-family: var(--font-mono);
          font-size: 0.5rem;
          font-weight: 700;
          color: var(--accent-green);
          background: rgba(0, 230, 118, 0.15);
          padding: 1px 4px;
          border-radius: 3px;
        }

        @media (max-width: 600px) {
          .scenario-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}
