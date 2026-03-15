import { useState } from 'react'

const CATEGORIES = ['earnings', 'scandal', 'rumor', 'regulation', 'partnership', 'panic', 'recovery']
const TICKERS = ['NOVA', 'GRNE', 'MEDI', 'FOOD', 'LUXE', 'IRON']

export default function EventInjector({ sendMessage }) {
  const [headline, setHeadline] = useState('')
  const [category, setCategory] = useState('scandal')
  const [severity, setSeverity] = useState(3)
  const [selectedTickers, setSelectedTickers] = useState([])
  const [isRumor, setIsRumor] = useState(false)
  const [duration, setDuration] = useState(3)

  const toggleTicker = (t) => {
    setSelectedTickers(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const handleInject = () => {
    if (!headline.trim() || selectedTickers.length === 0) return

    sendMessage({
      type: 'inject_event',
      event: {
        headline: headline.trim(),
        category,
        severity,
        affected_tickers: selectedTickers,
        is_true: !isRumor,
        duration_rounds: duration,
      },
    })

    setHeadline('')
    setSelectedTickers([])
    setIsRumor(false)
  }

  return (
    <div className="event-injector panel">
      <div className="panel-header">EVENT INJECTOR</div>
      <div className="panel-body injector-body">
        <input
          type="text"
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          placeholder="Breaking news headline..."
          className="headline-input"
        />

        <div className="injector-row">
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>

          <div className="severity-control">
            <label>SEV</label>
            <input
              type="range"
              min={1}
              max={5}
              value={severity}
              onChange={e => setSeverity(Number(e.target.value))}
            />
            <span className="mono">{severity}</span>
          </div>
        </div>

        <div className="ticker-toggles">
          {TICKERS.map(t => (
            <button
              key={t}
              className={`ticker-toggle ${selectedTickers.includes(t) ? 'selected' : ''}`}
              onClick={() => toggleTicker(t)}
            >
              {t}
            </button>
          ))}
          <button
            className={`ticker-toggle ${selectedTickers.length === 6 ? 'selected' : ''}`}
            onClick={() => setSelectedTickers(selectedTickers.length === 6 ? [] : [...TICKERS])}
          >
            ALL
          </button>
        </div>

        <div className="injector-row">
          <label className="rumor-toggle">
            <input
              type="checkbox"
              checked={isRumor}
              onChange={e => setIsRumor(e.target.checked)}
            />
            <span className={isRumor ? 'text-amber' : ''}>
              {isRumor ? 'THIS IS A LIE' : 'Is Rumor?'}
            </span>
          </label>

          <div className="duration-control">
            <label>Rounds:</label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              min={1}
              max={10}
              className="config-input"
              style={{ width: 50 }}
            />
          </div>
        </div>

        <button
          className="btn btn-primary inject-btn"
          onClick={handleInject}
          disabled={!headline.trim() || selectedTickers.length === 0}
        >
          INJECT EVENT
        </button>
      </div>

      <style>{`
        .injector-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .headline-input {
          font-size: 0.9rem;
        }
        .injector-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .injector-row select {
          flex: 1;
        }
        .severity-control {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .severity-control input[type="range"] {
          width: 80px;
          padding: 0;
          border: none;
        }
        .ticker-toggles {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .ticker-toggle {
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 700;
        }
        .ticker-toggle.selected {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          box-shadow: 0 0 8px rgba(0, 240, 255, 0.2);
        }
        .rumor-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .rumor-toggle input {
          width: auto;
        }
        .duration-control {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .inject-btn {
          width: 100%;
          min-height: 48px;
        }
      `}</style>
    </div>
  )
}
