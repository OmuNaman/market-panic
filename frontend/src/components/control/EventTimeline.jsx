import { categoryIcon } from '../../utils/formatters'

export default function EventTimeline({ news }) {
  return (
    <div className="event-timeline panel">
      <div className="panel-header">EVENT TIMELINE</div>
      <div className="timeline-list">
        {(news || []).map((event, i) => (
          <div key={i} className="timeline-item">
            <span className="timeline-icon">{categoryIcon(event.category)}</span>
            <div className="timeline-content">
              <div className="timeline-headline">{event.headline}</div>
              <div className="timeline-meta">
                <span className="mono">R{event.round}</span>
                <span className="severity-dots">
                  {Array.from({ length: 5 }, (_, j) => (
                    <span
                      key={j}
                      className="sev-dot"
                      style={{
                        background: j < event.severity
                          ? event.severity >= 4 ? 'var(--accent-pink)' : 'var(--accent-amber)'
                          : 'var(--bg-tertiary)',
                      }}
                    />
                  ))}
                </span>
                {!event.is_true && <span className="rumor-badge">RUMOR</span>}
              </div>
            </div>
          </div>
        ))}
        {(!news || news.length === 0) && (
          <div className="text-muted" style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
            No events yet
          </div>
        )}
      </div>

      <style>{`
        .timeline-list {
          max-height: 350px;
          overflow-y: auto;
        }
        .timeline-item {
          display: flex;
          gap: 10px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(42, 42, 62, 0.3);
        }
        .timeline-icon {
          font-size: 1rem;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .timeline-content {
          flex: 1;
          min-width: 0;
        }
        .timeline-headline {
          font-size: 0.8rem;
          line-height: 1.3;
          margin-bottom: 4px;
        }
        .timeline-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.65rem;
          color: var(--text-muted);
        }
        .severity-dots {
          display: flex;
          gap: 3px;
        }
        .sev-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .rumor-badge {
          font-family: var(--font-mono);
          font-size: 0.55rem;
          font-weight: 700;
          color: var(--accent-amber);
          background: rgba(255, 171, 0, 0.15);
          padding: 1px 4px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}
