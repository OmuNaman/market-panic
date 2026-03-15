import { formatPrice, formatChange } from '../../utils/formatters'

export default function MarketStats({ prices, priceChanges, rankings, activeEvents }) {
  const tickers = Object.keys(prices || {})

  // Biggest mover
  let biggestMover = { ticker: '-', change: 0 }
  for (const ticker of tickers) {
    const change = Math.abs(priceChanges?.[ticker] || 0)
    if (change > Math.abs(biggestMover.change)) {
      biggestMover = { ticker, change: priceChanges[ticker] }
    }
  }

  // Market mood (avg change)
  const avgChange = tickers.length > 0
    ? tickers.reduce((sum, t) => sum + (priceChanges?.[t] || 0), 0) / tickers.length
    : 0
  const mood = avgChange > 1 ? 'BULLISH' : avgChange < -1 ? 'BEARISH' : 'NEUTRAL'
  const moodColor = avgChange > 1 ? 'var(--accent-green)' : avgChange < -1 ? 'var(--accent-pink)' : 'var(--accent-amber)'

  const stats = [
    {
      label: 'AGENTS',
      value: rankings?.length || 0,
      color: 'var(--accent-cyan)',
    },
    {
      label: 'MOOD',
      value: mood,
      color: moodColor,
    },
    {
      label: 'BIGGEST MOVER',
      value: biggestMover.ticker,
      sub: formatChange(biggestMover.change),
      color: biggestMover.change >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)',
    },
    {
      label: 'ACTIVE EVENTS',
      value: activeEvents?.length || 0,
      color: (activeEvents?.length || 0) > 0 ? 'var(--accent-amber)' : 'var(--text-muted)',
    },
  ]

  return (
    <div className="market-stats panel">
      <div className="panel-header">MARKET STATS</div>
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value mono" style={{ color: stat.color }}>
              {stat.value}
            </div>
            {stat.sub && (
              <div className="stat-sub mono" style={{ color: stat.color }}>
                {stat.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .market-stats {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: var(--border-subtle);
          flex: 1;
        }
        .stat-card {
          background: var(--bg-secondary);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-label {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .stat-value {
          font-size: 1.3rem;
          font-weight: 700;
        }
        .stat-sub {
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  )
}
