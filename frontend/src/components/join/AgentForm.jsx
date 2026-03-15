import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const SECTORS = [
  { ticker: 'NOVA', name: 'AI/Tech', emoji: '🤖' },
  { ticker: 'GRNE', name: 'Energy', emoji: '⚡' },
  { ticker: 'MEDI', name: 'Pharma', emoji: '💊' },
  { ticker: 'FOOD', name: 'Agri', emoji: '🌾' },
  { ticker: 'LUXE', name: 'Luxury', emoji: '💎' },
  { ticker: 'IRON', name: 'Defense', emoji: '🛡️' },
]

const RISK_LABELS = ['', 'Conservative', 'Cautious', 'Balanced', 'Aggressive', 'Reckless']

export default function AgentForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('')
  const [strategy, setStrategy] = useState('')
  const [riskLevel, setRiskLevel] = useState(3)
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agentCount, setAgentCount] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  // Check if already submitted
  useEffect(() => {
    const existingAgent = sessionStorage.getItem('market_panic_agent')
    if (existingAgent) {
      setSubmitted(true)
    }
  }, [])

  // Poll agent count
  useEffect(() => {
    const poll = () => {
      fetch('/api/agents/count')
        .then(r => r.json())
        .then(d => setAgentCount(d.count))
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [])

  const toggleSector = (ticker) => {
    setSectors(prev => {
      if (prev.includes(ticker)) return prev.filter(t => t !== ticker)
      if (prev.length >= 3) return prev
      return [...prev, ticker]
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) return setError('Give your agent a name!')
    if (!personality.trim()) return setError('Describe your agent\'s personality!')
    if (!strategy.trim()) return setError('What\'s your trading strategy?')
    if (sectors.length === 0) return setError('Pick at least one sector!')

    setLoading(true)
    try {
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          personality: personality.trim(),
          strategy: strategy.trim(),
          risk_level: riskLevel,
          favorite_sectors: sectors,
        }),
      })

      if (res.status === 409) {
        setError('That name is taken — try another!')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Something went wrong')
        setLoading(false)
        return
      }

      sessionStorage.setItem('market_panic_agent', name.trim())
      setSubmitted(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch {
      setError('Can\'t reach the server — is it running?')
      setLoading(false)
    }
  }

  if (submitted) {
    const agentName = sessionStorage.getItem('market_panic_agent')
    return (
      <div className="join-page">
        <div className="join-card">
          <h1 className="join-title">MARKET PANIC</h1>
          <div className="join-success">
            <div className="success-icon">✓</div>
            <h2>Agent Deployed!</h2>
            <p className="text-secondary">
              <span className="text-cyan">{agentName}</span> is ready to trade.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1.5rem', width: '100%' }}
              onClick={() => navigate('/dashboard')}
            >
              GO TO DASHBOARD →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <h1 className="join-title">MARKET PANIC</h1>
        <p className="join-subtitle">Create Your Trader</p>

        <form onSubmit={handleSubmit} className="join-form">
          {/* Agent Name */}
          <div className="form-group">
            <label>Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. WolfOfWallSt"
              maxLength={20}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Personality */}
          <div className="form-group">
            <label>Personality</label>
            <textarea
              value={personality}
              onChange={e => setPersonality(e.target.value)}
              placeholder="A paranoid day-trader who trusts nobody and always hedges their bets..."
              rows={3}
            />
          </div>

          {/* Strategy */}
          <div className="form-group">
            <label>Trading Strategy</label>
            <textarea
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
              placeholder="Buy undervalued stocks after scandals, sell at 15% profit, avoid hype..."
              rows={3}
            />
          </div>

          {/* Risk Level */}
          <div className="form-group">
            <label>Risk Appetite</label>
            <div className="risk-slider">
              <input
                type="range"
                min={1}
                max={5}
                value={riskLevel}
                onChange={e => setRiskLevel(Number(e.target.value))}
                className="slider"
              />
              <div className="risk-labels">
                <span className={riskLevel === 1 ? 'active' : ''}>1</span>
                <span className={riskLevel === 2 ? 'active' : ''}>2</span>
                <span className={riskLevel === 3 ? 'active' : ''}>3</span>
                <span className={riskLevel === 4 ? 'active' : ''}>4</span>
                <span className={riskLevel === 5 ? 'active' : ''}>5</span>
              </div>
              <div className="risk-label-text mono">
                {RISK_LABELS[riskLevel]}
              </div>
            </div>
          </div>

          {/* Sectors */}
          <div className="form-group">
            <label>Favorite Sectors <span className="text-muted">(pick 1-3)</span></label>
            <div className="sector-grid">
              {SECTORS.map(s => (
                <button
                  key={s.ticker}
                  type="button"
                  className={`sector-pill ${sectors.includes(s.ticker) ? 'selected' : ''}`}
                  onClick={() => toggleSector(s.ticker)}
                >
                  <span className="sector-emoji">{s.emoji}</span>
                  <span className="sector-ticker">{s.ticker}</span>
                  <span className="sector-name">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary deploy-btn"
            disabled={loading}
          >
            {loading ? 'DEPLOYING...' : '🚀 DEPLOY AGENT'}
          </button>
        </form>

        {agentCount > 0 && (
          <div className="agent-counter">
            <span className="mono text-cyan">{agentCount}</span> agent{agentCount !== 1 ? 's' : ''} in the market
          </div>
        )}
      </div>

      <style>{`
        .join-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          background: radial-gradient(ellipse at center, rgba(0, 240, 255, 0.03) 0%, transparent 70%);
        }

        .join-card {
          width: 100%;
          max-width: 560px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 2.5rem;
          box-shadow: 0 0 60px rgba(0, 240, 255, 0.05);
        }

        .join-title {
          font-family: var(--font-mono);
          font-size: 2.5rem;
          text-align: center;
          color: var(--accent-cyan);
          text-shadow: 0 0 30px rgba(0, 240, 255, 0.4);
          letter-spacing: 0.15em;
          margin-bottom: 0.25rem;
        }

        .join-subtitle {
          text-align: center;
          color: var(--text-secondary);
          font-size: 1rem;
          margin-bottom: 2rem;
        }

        .join-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 700;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
        }

        .risk-slider {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          outline: none;
          border: none;
          padding: 0;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--accent-cyan);
          box-shadow: var(--glow-cyan);
          cursor: pointer;
        }

        .risk-labels {
          display: flex;
          justify-content: space-between;
          padding: 0 2px;
        }

        .risk-labels span {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .risk-labels span.active {
          color: var(--accent-cyan);
          font-weight: 700;
        }

        .risk-label-text {
          text-align: center;
          font-size: 0.8rem;
          color: var(--accent-cyan);
        }

        .sector-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .sector-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          padding: 0.75rem 0.5rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s var(--ease-snappy);
        }

        .sector-pill:hover {
          border-color: var(--accent-cyan);
        }

        .sector-pill.selected {
          border-color: var(--accent-cyan);
          box-shadow: var(--glow-cyan);
          color: var(--accent-cyan);
          background: rgba(0, 240, 255, 0.05);
        }

        .sector-emoji { font-size: 1.25rem; }
        .sector-ticker {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 0.8rem;
        }
        .sector-name {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-error {
          color: var(--accent-pink);
          font-size: 0.85rem;
          text-align: center;
          padding: 0.5rem;
          background: rgba(255, 45, 122, 0.1);
          border-radius: 8px;
        }

        .deploy-btn {
          width: 100%;
          padding: 16px;
          font-size: 1.1rem;
          margin-top: 0.5rem;
          letter-spacing: 0.1em;
        }

        .agent-counter {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .join-success {
          text-align: center;
          padding: 2rem 0;
        }

        .success-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(0, 230, 118, 0.15);
          color: var(--accent-green);
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          border: 2px solid var(--accent-green);
          box-shadow: var(--glow-green);
        }

        @media (max-width: 480px) {
          .join-card { padding: 1.5rem; }
          .join-title { font-size: 1.8rem; }
          .sector-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}
