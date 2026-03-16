import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const SECTORS = [
  { ticker: 'NOVA', name: 'AI/Tech' },
  { ticker: 'GRNE', name: 'Energy' },
  { ticker: 'MEDI', name: 'Pharma' },
  { ticker: 'FOOD', name: 'Agri' },
  { ticker: 'LUXE', name: 'Luxury' },
  { ticker: 'IRON', name: 'Defense' },
]

const RISK_LABELS = ['', 'Conservative', 'Cautious', 'Balanced', 'Aggressive', 'Reckless']
const FORGET_LABELS = ['', 'Elephant', 'Studious', 'Balanced', 'Breezy', 'Goldfish']

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

  // Token War Room
  const [showWarRoom, setShowWarRoom] = useState(false)
  const [ragDocCount, setRagDocCount] = useState(5)
  const [memoryRecallCount, setMemoryRecallCount] = useState(10)
  const [memoryImportanceThreshold, setMemoryImportanceThreshold] = useState(3)
  const [chatHistoryCount, setChatHistoryCount] = useState(5)
  const [marketDataConfig, setMarketDataConfig] = useState({
    price_changes: true, full_price_history: false,
    portfolio_state: true, active_events: true, agent_rankings: false,
  })

  // Memory Architect
  const [showMemArch, setShowMemArch] = useState(false)
  const [memoryFocus, setMemoryFocus] = useState('episodic')
  const [forgettingSpeed, setForgettingSpeed] = useState(3)
  const [compressionTrigger, setCompressionTrigger] = useState(50)
  const [memoryFilters, setMemoryFilters] = useState({
    price_moves: true, price_threshold: 3.0,
    news_events: true, own_trades: true,
    chat_messages: false, portfolio_snapshots: false, failed_trades: false,
  })

  useEffect(() => {
    const existingAgent = sessionStorage.getItem('market_panic_agent')
    if (existingAgent) setSubmitted(true)
  }, [])

  useEffect(() => {
    const poll = () => {
      fetch('/api/agents/count').then(r => r.json()).then(d => setAgentCount(d.count)).catch(() => {})
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

  const toggleMarketData = (key) => {
    setMarketDataConfig(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleMemFilter = (key) => {
    setMemoryFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Context health estimate
  const estimatedTokens = 300 + (ragDocCount * 200) + (memoryRecallCount * 50)
    + (marketDataConfig.portfolio_state ? 150 : 0)
    + (marketDataConfig.active_events ? 100 : 0)
    + (marketDataConfig.full_price_history ? 500 : 0)
    + (marketDataConfig.agent_rankings ? 150 : 0)
    + (chatHistoryCount * 30) + 500
  const healthPct = Math.min(100, Math.round((estimatedTokens / 4000) * 100))
  const healthColor = healthPct > 90 ? 'var(--accent-pink)' : healthPct > 80 ? 'var(--accent-amber)' : healthPct < 40 ? 'var(--accent-amber)' : 'var(--accent-green)'
  const healthLabel = healthPct > 90 ? 'CONTEXT ROT RISK' : healthPct > 80 ? 'DENSE' : healthPct < 40 ? 'SPARSE' : 'OPTIMAL'

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
          rag_doc_count: ragDocCount,
          memory_recall_count: memoryRecallCount,
          memory_importance_threshold: memoryImportanceThreshold,
          chat_history_count: chatHistoryCount,
          market_data_config: marketDataConfig,
          memory_focus: memoryFocus,
          forgetting_speed: forgettingSpeed,
          compression_trigger: compressionTrigger,
          memory_filters: memoryFilters,
        }),
      })

      if (res.status === 409) { setError('That name is taken — try another!'); setLoading(false); return }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Something went wrong'); setLoading(false); return
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
            <div className="success-icon">OK</div>
            <h2>Agent Deployed!</h2>
            <p className="text-secondary"><span className="text-cyan">{agentName}</span> is ready to trade.</p>
            <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => navigate('/dashboard')}>GO TO DASHBOARD →</button>
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
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. WolfOfWallSt" maxLength={20} style={{ fontFamily: 'var(--font-mono)' }} />
          </div>

          {/* Personality */}
          <div className="form-group">
            <label>Personality</label>
            <textarea value={personality} onChange={e => setPersonality(e.target.value)} placeholder="A paranoid day-trader who trusts nobody and always hedges their bets..." rows={3} />
          </div>

          {/* Strategy */}
          <div className="form-group">
            <label>Trading Strategy</label>
            <textarea value={strategy} onChange={e => setStrategy(e.target.value)} placeholder="Buy undervalued stocks after scandals, sell at 15% profit, avoid hype..." rows={3} />
          </div>

          {/* Risk Level */}
          <div className="form-group">
            <label>Risk Appetite</label>
            <div className="risk-slider">
              <input type="range" min={1} max={5} value={riskLevel} onChange={e => setRiskLevel(Number(e.target.value))} className="slider" />
              <div className="risk-labels">
                {[1,2,3,4,5].map(n => <span key={n} className={riskLevel === n ? 'active' : ''}>{n}</span>)}
              </div>
              <div className="risk-label-text mono">{RISK_LABELS[riskLevel]}</div>
            </div>
          </div>

          {/* Sectors */}
          <div className="form-group">
            <label>Favorite Sectors <span className="text-muted">(pick 1-3)</span></label>
            <div className="sector-grid">
              {SECTORS.map(s => (
                <button key={s.ticker} type="button" className={`sector-pill ${sectors.includes(s.ticker) ? 'selected' : ''}`} onClick={() => toggleSector(s.ticker)}>
                  <span className="sector-ticker">{s.ticker}</span>
                  <span className="sector-name">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── TOKEN WAR ROOM ── */}
          <div className="adv-section">
            <button type="button" className="adv-toggle" onClick={() => setShowWarRoom(!showWarRoom)}>
              <span>TOKEN WAR ROOM</span>
              <span className="adv-arrow">{showWarRoom ? '▾' : '▸'}</span>
            </button>
            {showWarRoom && (
              <div className="adv-content">
                <div className="context-health">
                  <div className="health-bar">
                    <div className="health-fill" style={{ width: `${healthPct}%`, background: healthColor }} />
                  </div>
                  <div className="health-label" style={{ color: healthColor }}>
                    <span className="mono">{estimatedTokens}</span> tokens — {healthLabel}
                  </div>
                </div>

                <div className="adv-row">
                  <label>Research Documents <span className="text-muted">({ragDocCount})</span></label>
                  <input type="range" min={1} max={10} value={ragDocCount} onChange={e => setRagDocCount(Number(e.target.value))} className="slider" />
                  <span className="adv-hint">~{ragDocCount * 200} tokens</span>
                </div>

                <div className="adv-row">
                  <label>Memory Slots <span className="text-muted">({memoryRecallCount})</span></label>
                  <input type="range" min={3} max={20} value={memoryRecallCount} onChange={e => setMemoryRecallCount(Number(e.target.value))} className="slider" />
                  <span className="adv-hint">~{memoryRecallCount * 50} tokens</span>
                </div>

                <div className="adv-row">
                  <label>Min Memory Importance <span className="text-muted">({memoryImportanceThreshold})</span></label>
                  <input type="range" min={1} max={10} value={memoryImportanceThreshold} onChange={e => setMemoryImportanceThreshold(Number(e.target.value))} className="slider" />
                </div>

                <div className="adv-row">
                  <label>Chat Messages <span className="text-muted">({chatHistoryCount})</span></label>
                  <input type="range" min={0} max={10} value={chatHistoryCount} onChange={e => setChatHistoryCount(Number(e.target.value))} className="slider" />
                </div>

                <div className="adv-checks">
                  <label className="adv-check"><input type="checkbox" checked={marketDataConfig.price_changes} onChange={() => toggleMarketData('price_changes')} /> Price changes (%)</label>
                  <label className="adv-check"><input type="checkbox" checked={marketDataConfig.portfolio_state} onChange={() => toggleMarketData('portfolio_state')} /> Portfolio state</label>
                  <label className="adv-check"><input type="checkbox" checked={marketDataConfig.active_events} onChange={() => toggleMarketData('active_events')} /> News events</label>
                  <label className="adv-check"><input type="checkbox" checked={marketDataConfig.full_price_history} onChange={() => toggleMarketData('full_price_history')} /> Full price history <span className="text-pink">+500t</span></label>
                  <label className="adv-check"><input type="checkbox" checked={marketDataConfig.agent_rankings} onChange={() => toggleMarketData('agent_rankings')} /> Leaderboard (top 5)</label>
                </div>
              </div>
            )}
          </div>

          {/* ── MEMORY ARCHITECT ── */}
          <div className="adv-section">
            <button type="button" className="adv-toggle" onClick={() => setShowMemArch(!showMemArch)}>
              <span>MEMORY ARCHITECT</span>
              <span className="adv-arrow">{showMemArch ? '▾' : '▸'}</span>
            </button>
            {showMemArch && (
              <div className="adv-content">
                <div className="form-group">
                  <label>Memory Focus</label>
                  <div className="focus-options">
                    {[
                      { val: 'episodic', icon: 'E', name: 'Episodic', desc: 'Remember specific events as they happened' },
                      { val: 'semantic', icon: 'S', name: 'Semantic', desc: 'Extract general market patterns (+cost)' },
                      { val: 'procedural', icon: 'P', name: 'Procedural', desc: 'Create if-then trading rules (+cost)' },
                    ].map(f => (
                      <button key={f.val} type="button" className={`focus-btn ${memoryFocus === f.val ? 'selected' : ''}`} onClick={() => setMemoryFocus(f.val)}>
                        <span className="focus-icon">{f.icon}</span>
                        <span className="focus-name">{f.name}</span>
                        <span className="focus-desc">{f.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="adv-row">
                  <label>Memory Decay <span className="text-muted">({forgettingSpeed})</span></label>
                  <input type="range" min={1} max={5} value={forgettingSpeed} onChange={e => setForgettingSpeed(Number(e.target.value))} className="slider" />
                  <div className="risk-label-text mono">{FORGET_LABELS[forgettingSpeed]}</div>
                </div>

                <div className="adv-row">
                  <label>Auto-Compress After</label>
                  <input type="number" min={10} max={100} value={compressionTrigger} onChange={e => setCompressionTrigger(Number(e.target.value))} className="config-input" style={{ width: 70, textAlign: 'center' }} />
                  <span className="adv-hint">memories</span>
                </div>

                <div className="adv-checks">
                  <label className="adv-check">
                    <input type="checkbox" checked={memoryFilters.price_moves} onChange={() => toggleMemFilter('price_moves')} />
                    Price moves above
                    <input type="number" min={1} max={15} step={0.5} value={memoryFilters.price_threshold} onChange={e => setMemoryFilters(p => ({...p, price_threshold: Number(e.target.value)}))} className="config-input" style={{ width: 50, textAlign: 'center', marginLeft: 4 }} />%
                  </label>
                  <label className="adv-check"><input type="checkbox" checked={memoryFilters.news_events} onChange={() => toggleMemFilter('news_events')} /> News events</label>
                  <label className="adv-check"><input type="checkbox" checked={memoryFilters.own_trades} onChange={() => toggleMemFilter('own_trades')} /> Own trade results</label>
                  <label className="adv-check"><input type="checkbox" checked={memoryFilters.chat_messages} onChange={() => toggleMemFilter('chat_messages')} /> Chat messages</label>
                  <label className="adv-check"><input type="checkbox" checked={memoryFilters.portfolio_snapshots} onChange={() => toggleMemFilter('portfolio_snapshots')} /> Portfolio snapshots</label>
                  <label className="adv-check"><input type="checkbox" checked={memoryFilters.failed_trades} onChange={() => toggleMemFilter('failed_trades')} /> HOLD decisions</label>
                </div>
              </div>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary deploy-btn" disabled={loading}>
            {loading ? 'DEPLOYING...' : 'DEPLOY AGENT'}
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
          max-width: 580px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 2.5rem;
          box-shadow: 0 0 60px rgba(0, 240, 255, 0.05);
        }
        .join-title { font-family: var(--font-mono); font-size: 2.5rem; text-align: center; color: var(--accent-cyan); text-shadow: 0 0 30px rgba(0, 240, 255, 0.4); letter-spacing: 0.15em; margin-bottom: 0.25rem; }
        .join-subtitle { text-align: center; color: var(--text-secondary); font-size: 1rem; margin-bottom: 2rem; }
        .join-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-group label { font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); }
        .risk-slider { display: flex; flex-direction: column; gap: 0.5rem; }
        .slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; outline: none; border: none; padding: 0; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--accent-cyan); box-shadow: var(--glow-cyan); cursor: pointer; }
        .risk-labels { display: flex; justify-content: space-between; padding: 0 2px; }
        .risk-labels span { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); }
        .risk-labels span.active { color: var(--accent-cyan); font-weight: 700; }
        .risk-label-text { text-align: center; font-size: 0.8rem; color: var(--accent-cyan); }
        .sector-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .sector-pill { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; padding: 0.75rem 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: 10px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s var(--ease-snappy); }
        .sector-pill:hover { border-color: var(--accent-cyan); }
        .sector-pill.selected { border-color: var(--accent-cyan); box-shadow: var(--glow-cyan); color: var(--accent-cyan); background: rgba(0, 240, 255, 0.05); }
        .sector-ticker { font-family: var(--font-mono); font-weight: 700; font-size: 0.8rem; }
        .sector-name { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .form-error { color: var(--accent-pink); font-size: 0.85rem; text-align: center; padding: 0.5rem; background: rgba(255, 45, 122, 0.1); border-radius: 8px; }
        .deploy-btn { width: 100%; padding: 16px; font-size: 1.1rem; margin-top: 0.5rem; letter-spacing: 0.1em; }
        .agent-counter { text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: var(--text-muted); }
        .join-success { text-align: center; padding: 2rem 0; }
        .success-icon { width: 60px; height: 60px; border-radius: 50%; background: rgba(0, 230, 118, 0.15); color: var(--accent-green); font-size: 1.5rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; border: 2px solid var(--accent-green); box-shadow: var(--glow-green); }

        /* Advanced sections */
        .adv-section { border: 1px solid var(--border-subtle); border-radius: 10px; overflow: hidden; }
        .adv-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: background 0.2s; }
        .adv-toggle:hover { background: var(--bg-elevated); }
        .adv-arrow { color: var(--text-muted); font-size: 0.8rem; }
        .adv-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--bg-secondary); }
        .adv-row { display: flex; flex-direction: column; gap: 4px; }
        .adv-row label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); }
        .adv-hint { font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono); }
        .adv-checks { display: flex; flex-direction: column; gap: 6px; }
        .adv-check { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--text-secondary); cursor: pointer; }
        .adv-check input[type="checkbox"] { width: auto; accent-color: var(--accent-cyan); }
        .config-input { font-family: var(--font-mono); padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--text-primary); font-size: 0.8rem; }

        /* Context health bar */
        .context-health { margin-bottom: 4px; }
        .health-bar { height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; }
        .health-fill { height: 100%; border-radius: 3px; transition: all 0.3s var(--ease-snappy); }
        .health-label { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 0.65rem; }

        /* Memory focus buttons */
        .focus-options { display: flex; flex-direction: column; gap: 6px; }
        .focus-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: 8px; color: var(--text-secondary); cursor: pointer; text-align: left; transition: all 0.2s var(--ease-snappy); }
        .focus-btn:hover { border-color: var(--accent-purple); }
        .focus-btn.selected { border-color: var(--accent-purple); box-shadow: 0 0 12px rgba(179, 136, 255, 0.2); color: var(--text-primary); background: rgba(179, 136, 255, 0.05); }
        .focus-icon { font-size: 1.2rem; flex-shrink: 0; }
        .focus-name { font-weight: 700; font-size: 0.8rem; min-width: 70px; }
        .focus-desc { font-size: 0.68rem; color: var(--text-muted); }

        @media (max-width: 480px) {
          .join-card { padding: 1.5rem; }
          .join-title { font-size: 1.8rem; }
          .sector-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}
