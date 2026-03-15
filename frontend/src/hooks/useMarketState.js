import { useReducer, useCallback } from 'react'

const initialState = {
  gameStatus: 'waiting', // waiting | running | paused | finished
  round: 0,
  totalRounds: 30,
  prices: {},
  priceChanges: {},
  priceHistory: {},
  agents: {},       // name -> agent info
  rankings: [],
  news: [],         // { headline, category, severity, round }
  trades: [],       // { agent, action, ticker, amount, price, reasoning, round }
  activeEvents: [],
  inspectedAgent: null,  // full agent inspection data
  gameOver: null,   // { final_rankings, highlights }
  speed: 1,
  error: null,      // last error message from server
  scenarioLoaded: null, // last scenario confirmation
}

function reducer(state, action) {
  switch (action.type) {
    case 'game_status':
      return { ...state, gameStatus: action.status }

    case 'market_update':
      return {
        ...state,
        gameStatus: action.status ?? state.gameStatus,
        round: action.round ?? state.round,
        totalRounds: action.total_rounds ?? state.totalRounds,
        prices: action.prices ?? state.prices,
        priceChanges: action.price_changes ?? state.priceChanges,
        priceHistory: action.price_history ?? state.priceHistory,
        rankings: action.rankings ?? state.rankings,
        activeEvents: action.active_events ?? state.activeEvents,
        speed: action.speed ?? state.speed,
      }

    case 'agent_joined':
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.name]: {
            name: action.name,
            personality: action.personality,
            strategy: action.strategy,
            risk_level: action.risk_level,
            favorite_sectors: action.favorite_sectors,
          },
        },
      }

    case 'agent_removed': {
      const { [action.name]: _, ...remainingAgents } = state.agents
      return {
        ...state,
        agents: remainingAgents,
        rankings: state.rankings.filter(r => r.name !== action.name),
      }
    }

    case 'trade_executed':
      return {
        ...state,
        trades: [
          {
            agent: action.agent,
            action: action.action,
            ticker: action.ticker,
            amount: action.amount,
            price: action.price,
            reasoning: action.reasoning,
            round: action.round,
          },
          ...state.trades,
        ].slice(0, 100), // keep last 100
      }

    case 'news_event':
      return {
        ...state,
        news: [
          {
            headline: action.headline,
            category: action.category,
            severity: action.severity,
            affected_tickers: action.affected_tickers,
            is_true: action.is_true,
            round: action.round,
          },
          ...state.news,
        ].slice(0, 50),
      }

    case 'agent_inspection':
      return {
        ...state,
        inspectedAgent: action,
      }

    case 'round_transition':
      return {
        ...state,
        round: action.to,
      }

    case 'game_over':
      return {
        ...state,
        gameStatus: 'finished',
        gameOver: {
          final_rankings: action.final_rankings,
          highlights: action.highlights,
        },
      }

    case 'speed_changed':
      return {
        ...state,
        speed: action.multiplier,
      }

    case 'clear_inspection':
      return {
        ...state,
        inspectedAgent: null,
      }

    case 'error':
      return {
        ...state,
        error: action.message,
      }

    case 'scenario_loaded':
      return {
        ...state,
        scenarioLoaded: {
          scenario: action.scenario,
          event_count: action.event_count,
        },
      }

    default:
      return state
  }
}

export function useMarketState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const handleMessage = useCallback((data) => {
    dispatch(data)
  }, [])

  return { state, dispatch, handleMessage }
}
