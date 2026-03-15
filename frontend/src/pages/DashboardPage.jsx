import { useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useMarketState } from '../hooks/useMarketState'
import { SoundProvider, useSounds } from '../components/dashboard/SoundEngine'
import TopBar from '../components/dashboard/TopBar'
import PriceCharts from '../components/dashboard/PriceCharts'
import Leaderboard from '../components/dashboard/Leaderboard'
import NewsTicker from '../components/dashboard/NewsTicker'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import MarketStats from '../components/dashboard/MarketStats'
import AgentInspector from '../components/dashboard/AgentInspector'
import RoundOverlay from '../components/dashboard/RoundOverlay'
import GameOver from '../components/dashboard/GameOver'

function DashboardInner() {
  const { state, dispatch, handleMessage } = useMarketState()
  const { isConnected } = useWebSocket('/ws/dashboard', { onMessage: handleMessage })
  const prevRound = useRef(0)
  const sounds = useSounds()

  // Sound effects on state changes
  useEffect(() => {
    if (!sounds) return
    if (state.round > prevRound.current && state.round > 0) {
      sounds.sounds.roundStart()
      prevRound.current = state.round
    }
  }, [state.round, sounds])

  useEffect(() => {
    if (!sounds) return
    if (state.gameStatus === 'finished') {
      sounds.sounds.gameOver()
    }
  }, [state.gameStatus, sounds])

  const handleSelectAgent = useCallback((name) => {
    // Fetch full agent data via REST
    fetch(`/api/agents/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => dispatch({ type: 'agent_inspection', ...data }))
      .catch(() => {})
  }, [dispatch])

  const handleCloseInspector = useCallback(() => {
    dispatch({ type: 'clear_inspection' })
  }, [dispatch])

  return (
    <div className="dashboard">
      <TopBar
        round={state.round}
        totalRounds={state.totalRounds}
        gameStatus={state.gameStatus}
        isConnected={isConnected}
      />

      <div className="dashboard-grid">
        <div className="grid-charts">
          <PriceCharts
            prices={state.prices}
            priceChanges={state.priceChanges}
            priceHistory={state.priceHistory}
          />
        </div>
        <div className="grid-leaderboard">
          <Leaderboard
            rankings={state.rankings}
            onSelectAgent={handleSelectAgent}
          />
        </div>
        <div className="grid-ticker">
          <NewsTicker news={state.news} />
        </div>
        <div className="grid-activity">
          <ActivityFeed trades={state.trades} />
        </div>
        <div className="grid-stats">
          <MarketStats
            prices={state.prices}
            priceChanges={state.priceChanges}
            rankings={state.rankings}
            activeEvents={state.activeEvents}
          />
        </div>
      </div>

      {/* Overlays */}
      <RoundOverlay round={state.round} />
      <AgentInspector
        agent={state.inspectedAgent}
        onClose={handleCloseInspector}
      />
      {state.gameStatus === 'finished' && <GameOver data={state.gameOver} />}

      {/* Waiting state */}
      {state.gameStatus === 'waiting' && (
        <div className="waiting-overlay">
          <div className="waiting-content">
            <h2 className="mono text-cyan">MARKET PANIC</h2>
            <p className="text-secondary">Waiting for the instructor to start the game...</p>
            <div className="waiting-dots">
              <span className="status-dot status-dot--thinking" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dashboard {
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .dashboard-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 60fr 40fr;
          grid-template-rows: 1fr 48px 280px;
          gap: 1px;
          background: var(--border-subtle);
          min-height: 0;
        }
        .grid-charts { grid-column: 1; grid-row: 1; }
        .grid-leaderboard { grid-column: 2; grid-row: 1; }
        .grid-ticker { grid-column: 1 / -1; grid-row: 2; }
        .grid-activity { grid-column: 1; grid-row: 3; }
        .grid-stats { grid-column: 2; grid-row: 3; }

        .grid-charts > *,
        .grid-leaderboard > *,
        .grid-ticker > *,
        .grid-activity > *,
        .grid-stats > * {
          height: 100%;
          border-radius: 0;
        }

        .waiting-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 15, 0.8);
          z-index: 50;
        }
        .waiting-content {
          text-align: center;
        }
        .waiting-content h2 {
          font-size: 2rem;
          text-shadow: 0 0 30px rgba(0, 240, 255, 0.4);
          letter-spacing: 0.15em;
          margin-bottom: 1rem;
        }
        .waiting-dots {
          margin-top: 1.5rem;
          display: flex;
          justify-content: center;
        }
        .waiting-dots .status-dot {
          width: 12px;
          height: 12px;
        }

        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
            grid-template-rows: 300px auto 48px 200px;
          }
          .grid-charts { grid-column: 1; grid-row: 1; }
          .grid-leaderboard { grid-column: 1; grid-row: 2; }
          .grid-ticker { grid-column: 1; grid-row: 3; }
          .grid-activity { grid-column: 1; grid-row: 4; }
          .grid-stats { display: none; }
        }
      `}</style>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <SoundProvider>
      <DashboardInner />
    </SoundProvider>
  )
}
