import { AnimatePresence } from 'framer-motion'
import LeaderboardRow from './LeaderboardRow'

export default function Leaderboard({ rankings, onSelectAgent, myAgent }) {
  const count = (rankings || []).length
  return (
    <div className="leaderboard panel">
      <div className="panel-header">LEADERBOARD</div>
      <div className="lb-list">
        <AnimatePresence>
          {(rankings || []).map((entry) => (
            <LeaderboardRow
              key={entry.name}
              rank={entry.rank}
              name={entry.name}
              portfolioValue={entry.portfolio_value}
              lastAction={entry.last_action}
              status={entry.status}
              isMe={entry.name === myAgent}
              disableLayout={count > 10}
              onClick={() => onSelectAgent(entry.name)}
            />
          ))}
        </AnimatePresence>
        {(!rankings || rankings.length === 0) && (
          <div className="lb-empty text-muted">
            No agents yet — waiting for players to join...
          </div>
        )}
      </div>

      <style>{`
        .leaderboard {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .lb-list {
          flex: 1;
          overflow-y: auto;
        }
        .lb-empty {
          padding: 2rem;
          text-align: center;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  )
}
