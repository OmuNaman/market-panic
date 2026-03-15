import { categoryIcon } from '../../utils/formatters'

export default function NewsTicker({ news }) {
  if (!news || news.length === 0) {
    return (
      <div className="news-ticker panel">
        <div className="ticker-track-static">
          <span className="ticker-item text-muted">Waiting for market events...</span>
        </div>
      </div>
    )
  }

  const severityColor = (severity) => {
    if (severity >= 4) return 'var(--accent-pink)'
    if (severity >= 3) return 'var(--accent-amber)'
    return 'var(--text-secondary)'
  }

  const renderItems = (keyPrefix) =>
    news.map((item, i) => (
      <span
        key={`${keyPrefix}-${i}`}
        className="ticker-item"
        style={{ color: severityColor(item.severity) }}
      >
        <span className="ticker-icon">{categoryIcon(item.category)}</span>
        <span className="ticker-headline">{item.headline}</span>
        {!item.is_true && <span className="rumor-tag">RUMOR</span>}
        <span className="ticker-sep">{'\u2022'}</span>
      </span>
    ))

  return (
    <div className="news-ticker panel">
      <div className="ticker-track">
        {renderItems('a')}
        {renderItems('b')}
      </div>

      <style>{`
        .news-ticker {
          overflow: hidden;
          white-space: nowrap;
          border-radius: 0;
        }
        .ticker-track-static {
          padding: 10px 16px;
        }
        .ticker-track {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 16px;
          animation: scroll-ticker 30s linear infinite;
          width: max-content;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes scroll-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
        }
        .ticker-icon { font-size: 0.9rem; }
        .ticker-headline { font-weight: 500; }
        .ticker-sep {
          color: var(--text-muted);
          margin: 0 8px;
        }
        .rumor-tag {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--accent-amber);
          background: rgba(255, 171, 0, 0.15);
          padding: 1px 5px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}
