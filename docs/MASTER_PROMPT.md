# MASTER PROMPT — Market Panic: Complete Build Guide

## What This Is
**Market Panic** is a live multi-agent stock market simulation. It's the capstone for a 10-session Context Engineering bootcamp. One web app deployed on Railway. Students join via a URL, create their AI trader agent by filling a form (personality, strategy, risk, sectors), and watch all agents compete in a simulated market on a live dashboard. The instructor injects events, controls drama, and then walks through the code to teach how RAG, memory, compression, and tool use power every agent's brain.

**Students write zero code. The server runs all 40 agent brains using Gemini Flash.** Each agent's behavior emerges from the student's personality/strategy text fed into the LLM prompts. Different text = different agent behavior. This IS context engineering.


## Architecture

### One Deployment, Three URLs
```
marketpanic.up.railway.app/join       → Student agent creation form
marketpanic.up.railway.app/dashboard  → Live simulation (everyone watches)
marketpanic.up.railway.app/control    → Instructor panel (password-protected)
```

### System Diagram
```
┌─────────────────────────────────────────────┐
│          Railway (Single Service)            │
│                                             │
│  FastAPI Server                             │
│  ├── Serves React frontend (static files)   │
│  ├── REST API (/api/agents, /api/market)    │
│  ├── WebSocket hub (/ws/dashboard, /ws/instructor) │
│  ├── Market engine (GBM price simulation)   │
│  ├── Event system (injection, decay)        │
│  ├── Agent brain loop (Gemini Flash calls)  │
│  ├── ChromaDB (knowledge base + per-agent memory) │
│  └── Orchestrator (game loop)               │
│                                             │
│  React Frontend (built → static in dist/)   │
│  ├── /join → AgentForm                      │
│  ├── /dashboard → PriceCharts, Leaderboard, │
│  │    NewsTicker, ActivityFeed, AgentInspector │
│  └── /control → GameControls, EventInjector, │
│       ScenarioLoader, AgentManager          │
└─────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    Student A      Student B      Instructor
    (browser)      (browser)      (browser)
    /join→/dashboard  /join→/dashboard  /control + /dashboard
```

---

## Build Sequence

### Phase 1: Server Core
1. `server/models.py` — Pydantic models: Company, MarketEvent, Trade, Portfolio, AgentState, GameConfig
2. `server/market.py` — GBM price engine, trade execution, rankings, price history
3. `server/events.py` — Event injection, decay, severity→impact mapping, "ALL" ticker support
4. `server/scenarios.yaml` — 6 pre-built event sequences
5. `server/knowledge_base.py` — ChromaDB with ~50 pre-loaded docs, Gemini embeddings, search
6. `server/memory.py` — Per-agent ChromaDB collections, store/retrieve/compress
7. `server/agent_brain.py` — The 6-step brain loop (RAG → recall → analyze → decide → store → compress)
8. `server/orchestrator.py` — Game loop, round management, batch Gemini calls, speed control
9. `server/main.py` — FastAPI app, WebSocket hub, REST API, static file serving
10. `server/requirements.txt`, `server/.env.example`

**Test**: Start server locally, POST to /api/agents/create, start game via API, see rounds execute with Gemini calls.

### Phase 2: React Frontend
11. Scaffold: `npm create vite@latest frontend -- --template react`
12. Install: react-router-dom, chart.js, react-chartjs-2, framer-motion
13. `src/styles/global.css` — Full design system
14. `src/App.jsx` — React Router (/join, /dashboard, /control)
15. `src/hooks/useWebSocket.js` — Auto-detect ws/wss, reconnect
16. `src/hooks/useMarketState.js` — useReducer for all state

17. **JoinPage**: AgentForm component — name, personality, strategy, risk slider, sector toggles, submit → redirect
18. **DashboardPage**: TopBar, PriceCharts, Leaderboard + LeaderboardRow, NewsTicker, ActivityFeed, MarketStats, AgentInspector, RoundOverlay, GameOver, SoundEngine
19. **ControlPage**: Password gate, GameControls, EventInjector, ScenarioLoader, AgentManager, LiveStats, EventTimeline

**Test**: Full stack locally — create agent via /join, see on dashboard, start game from /control, watch simulation.

### Phase 3: Deploy
20. `railway.json` — build command (npm build + pip install), start command
21. `Procfile` — `web: uvicorn server.main:app --host 0.0.0.0 --port $PORT`
22. Set env vars in Railway: GEMINI_API_KEY, CONTROL_PASSWORD
23. Deploy, test all 3 URLs live

### Phase 4: Polish
24. Responsive dashboard (works on Zoom screen-share resolution)
25. Sound design (Web Audio synthesized)
26. Loading states, error states, reconnection UI
27. GameOver screen with podium and highlights
28. Performance: batch Gemini calls, memoize React components

---

## The Six Companies

| Ticker | Name | Sector | Start $ | σ | Personality |
|--------|------|--------|---------|---|-------------|
| NOVA | TechNova | AI/Tech | 150 | 0.03 | Hype-driven, momentum, AI news sensitive |
| GRNE | GreenPulse | Clean Energy | 85 | 0.02 | Policy-sensitive, steady, regulation driven |
| MEDI | MediCorp | Pharma | 200 | 0.025 | Scandal-prone, patent cliffs, big upside |
| FOOD | FoodCo | Agriculture | 45 | 0.012 | Safe haven, boring, great in downturns |
| LUXE | LuxeGlobal | Luxury | 310 | 0.035 | Sentiment-driven, celebrity-linked, volatile |
| IRON | IronShield | Defense | 120 | 0.015 | Geopolitics play, inverse market correlation |

---

## Simulation Pacing (20-30 Rounds, ~15-20 Min)

### Act 1 — "The Calm" (Rounds 1-8)
Rounds 1-4: natural drift, agents establish positions. Round 5: FOOD earnings beat (+5%). Round 7: first rumor about NOVA (test who bites).

### Act 2 — "The Storm" (Rounds 9-20)
Round 10: MEDI scandal (-12%). Round 12: conflicting info — "scandal overblown?" Round 15: sector rotation (NOVA down, IRON up). Round 17: "The Big Lie" — fake merger rumor. Round 19: market-wide panic.

### Act 3 — "The Recovery" (Rounds 21-30)
Round 22: recovery signal. Round 25: final twist. Round 28: bull run. Round 30: game ends.

---

## WebSocket Protocol

### Server → Dashboard
```json
{"type": "game_status", "status": "waiting|running|paused|finished"}
{"type": "agent_joined", "name": "Alice", "personality": "...", "strategy": "..."}
{"type": "market_update", "round": 12, "prices": {...}, "price_history": {...}}
{"type": "leaderboard", "rankings": [{"name": "...", "portfolio_value": 12500, "rank": 1, "last_action": "BUY NOVA", "status": "trading"}]}
{"type": "trade_executed", "agent": "Alice", "action": "BUY", "ticker": "NOVA", "amount": 5, "reasoning": "..."}
{"type": "news_event", "headline": "...", "category": "scandal", "severity": 4}
{"type": "agent_inspection", "name": "Alice", "personality": "...", "strategy": "...", "memories": [...], "decisions": [...], "portfolio": {...}}
{"type": "round_transition", "from": 12, "to": 13}
{"type": "game_over", "final_rankings": [...], "highlights": {...}}
```

### Instructor → Server (via WS)
```json
{"type": "start_game", "config": {"rounds": 30, "round_duration": 30}}
{"type": "pause_game"}
{"type": "resume_game"}
{"type": "end_game"}
{"type": "set_speed", "multiplier": 2}
{"type": "inject_event", "event": {...}}
{"type": "inject_scenario", "scenario_name": "flash_crash"}
{"type": "remove_agent", "name": "Bob"}
{"type": "inspect_agent", "name": "Alice"}
```

---

## Gemini API Usage
- **Model**: `gemini-2.0-flash` for all agent brain calls
- **Embeddings**: `text-embedding-004` for ChromaDB (knowledge base + memories)
- **Calls per round**: 2 per agent (analysis + decision) × 40 agents = 80 calls
- **Rate limit strategy**: batch in groups of 8, `asyncio.gather`, 0.5s pause between batches
- **Timeout**: 10s per call, fallback to HOLD
- **Environment variable**: `GEMINI_API_KEY` in Railway dashboard

---

## Success Criteria
1. Student opens URL → fills form → sees agent on dashboard in under 2 minutes
2. Dashboard makes everyone on the Zoom call lean forward
3. Instructor runs entire simulation from /control tab
4. 40 agents run simultaneously without Gemini rate limit failures
5. AgentInspector shows how personality text → memories → decisions (the teaching link)
6. Code walkthrough in VS Code clearly maps each function to a course session
7. "Your personality said X → the LLM did Y → that's context engineering"
