export default function LiveStats({ round, totalRounds, agentCount, speed }) {
  const progress = totalRounds > 0 ? Math.round((round / totalRounds) * 100) : 0

  return (
    <div className="live-stats panel">
      <div className="panel-header">LIVE STATS</div>
      <div className="panel-body stats-body">
        <div className="stat-item">
          <div className="stat-val mono text-cyan">{agentCount}</div>
          <div className="stat-lbl">AGENTS</div>
        </div>
        <div className="stat-item">
          <div className="stat-val mono">{round} / {totalRounds}</div>
          <div className="stat-lbl">ROUND</div>
        </div>
        <div className="stat-item">
          <div className="stat-val mono text-cyan">{speed}×</div>
          <div className="stat-lbl">SPEED</div>
        </div>
        <div className="stat-item">
          <div className="stat-val mono">{progress}%</div>
          <div className="stat-lbl">PROGRESS</div>
        </div>
      </div>

      <style>{`
        .stats-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .stat-item {
          text-align: center;
        }
        .stat-val {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .stat-lbl {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-top: 2px;
        }
      `}</style>
    </div>
  )
}
