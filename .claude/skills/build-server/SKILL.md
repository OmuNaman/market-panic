---
name: build-server
description: Build the Market Panic FastAPI server — price engine, event system, orchestrator, WebSocket hub, REST API, knowledge base, and static file serving for the React frontend. Single deployment on Railway.
---

# Server Build Skill

## Overview
One FastAPI process does everything: simulates the market, runs all agent brains via Gemini, serves the React frontend, pushes real-time updates over WebSocket, and exposes REST API for the join form.

## FastAPI App (`server/main.py`)
```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# API routes
app.include_router(agent_router, prefix="/api/agents")
app.include_router(market_router, prefix="/api/market")
app.include_router(event_router, prefix="/api/events")
app.include_router(knowledge_router, prefix="/api/knowledge")

# WebSocket
@app.websocket("/ws/{role}")
# role = "dashboard" | "instructor"
# No agent WS — agents run server-side, only browsers connect

# Serve React frontend (MUST be last — catches all routes for SPA)
app.mount("/", StaticFiles(directory="frontend/dist", html=True))

# Startup: init market, load knowledge base, no agents yet (they join via form)
```

### Key Difference from Previous Architecture
**No agent WebSocket connections.** Agents don't run on student machines. The server runs ALL agent brains internally. Only the dashboard and instructor control panel connect via WebSocket.

## Companies
| Ticker | Name | Sector | Start $ | σ | Character |
|--------|------|--------|---------|---|-----------|
| NOVA | TechNova | AI/Tech | 150 | 0.03 | Hype-driven, momentum |
| GRNE | GreenPulse | Clean Energy | 85 | 0.02 | Policy-sensitive, steady |
| MEDI | MediCorp | Pharma | 200 | 0.025 | Scandal-prone, patent-driven |
| FOOD | FoodCo | Agriculture | 45 | 0.012 | Safe haven, boring, defensive |
| LUXE | LuxeGlobal | Luxury | 310 | 0.035 | Sentiment-driven, volatile |
| IRON | IronShield | Defense | 120 | 0.015 | Geopolitics, inverse correlation |

## Price Engine (`server/market.py`)
```python
# GBM per round
Z = np.random.standard_normal()
new_price = price * exp((mu - 0.5 * sigma**2) * dt + sigma * sqrt(dt) * Z)
# mu=0.001, dt=1/252

# Event impact (multiplicative with decay)
for event in active_events_for_ticker:
    decay = max(0, 1 - (round - event.round_injected) / event.duration)
    new_price *= (1 + event.impact * decay)

# Order pressure from agent trades
net_pressure = (buy_vol - sell_vol) / max(total_vol, 1)
new_price *= (1 + net_pressure * 0.02)

# Floor
new_price = max(1.0, round(new_price, 2))
```

Trade execution: market orders only. Each agent starts with $10,000. No shorting. Cap at max affordable / max held.

## Event System (`server/events.py`)
```python
class MarketEvent(BaseModel):
    id: str
    headline: str
    category: Literal["earnings", "scandal", "rumor", "regulation", "partnership", "panic", "recovery"]
    affected_tickers: list[str]  # or ["ALL"]
    impact: float  # auto from severity: 1→±0.02, 2→±0.05, 3→±0.08, 4→±0.12, 5→±0.18
    is_true: bool
    severity: int  # 1-5
    duration_rounds: int = 3
    round_injected: int = 0
```

6 scenarios in `scenarios.yaml`: flash_crash, earnings_season, the_big_lie, sector_rotation, bull_run, insider_tip.

## Knowledge Base (`server/knowledge_base.py`)
ChromaDB collection `market_knowledge` loaded on startup with ~50 docs:
- 6 company profiles, 6 sector reports, 12 historical patterns, 10 strategies, 8 cross-company relationships, 8 red herrings
- Uses Gemini `text-embedding-004` for embeddings
- `search(query, n=5)` → list of relevant text chunks
- Fallback: keyword search if ChromaDB fails

## Agent Registration (REST API)
When student submits the /join form:
```
POST /api/agents/create
{
    "name": "Alice",
    "personality": "A paranoid day-trader who trusts nobody...",
    "strategy": "Buy undervalued stocks, sell at 15% profit...",
    "risk_level": 4,
    "favorite_sectors": ["NOVA", "MEDI"]
}
→ 201 { "name": "Alice", "status": "ready" }
```

Server:
1. Validate name uniqueness
2. Create AgentState with $10,000 portfolio
3. Create ChromaDB collection `agent_alice_memories`
4. Broadcast `agent_joined` to dashboard
5. Agent joins next round

```
GET /api/agents/count → { "count": 32 }
GET /api/agents/{name} → full agent state (for inspector)
DELETE /api/agents/{name} → remove agent (instructor only)
```

## Orchestrator (`server/orchestrator.py`)
```python
async def run_round(round_num: int):
    # 1. Tick prices
    new_prices = market.tick()
    
    # 2. Apply active events
    new_prices = events.apply(new_prices, round_num)
    
    # 3. Run ALL agent brains (this is the big one)
    decisions = await run_all_agent_brains(
        agents=all_agents,
        prices=new_prices,
        active_events=events.get_active(round_num),
        chat_log=recent_chat,
        round_num=round_num
    )
    # Stagger Gemini calls to avoid rate limits:
    # batch 5-8 agents at a time with asyncio.gather
    
    # 4. Execute trades
    results = market.execute_trades(decisions, new_prices)
    
    # 5. Compute rankings
    rankings = compute_rankings(all_agents, new_prices)
    
    # 6. Store memories for each agent
    for agent, decision, events_seen in zip(...):
        await memory.store_round_memories(agent, events_seen, decision, round_num)
    
    # 7. Compress memories if needed (check threshold per agent)
    for agent in agents_over_memory_limit:
        await memory.compress(agent)
    
    # 8. Broadcast everything to dashboard
    await ws.broadcast({
        "type": "market_update",
        "round": round_num,
        "prices": new_prices,
        "price_history": market.get_history(),
        "rankings": rankings,
        "trades": results,
        "active_events": events.get_active(round_num),
    })
    
    # 9. Pause before next round
    await asyncio.sleep(config.round_interval)
```

### Gemini Rate Limiting
With 40 agents, each making 1 LLM call per round = 40 calls per round. Gemini Flash free tier: 15 RPM. Paid tier: 1000 RPM. **This is the biggest constraint.**

Strategy:
- Use Gemini Flash (fastest, cheapest)
- Batch with `asyncio.gather()` in groups of 8-10
- Each call timeout: 10 seconds, fallback to HOLD
- If rate limited: queue and retry next round, agent HOLDs this round
- Log response times for the instructor's LiveStats panel

## WebSocket Hub
Only TWO types of connections (no agent WS):
```python
class ConnectionManager:
    dashboard_connections: list[WebSocket]    # multiple viewers
    instructor_connections: list[WebSocket]   # 1 instructor
    
    async def broadcast(data):          # → all connections
    async def send_instructor(data):    # → instructor only
```

### Server → Dashboard messages
```json
{"type": "market_update", "round": 12, "prices": {...}, "price_history": {...}, "rankings": [...], "trades": [...]}
{"type": "news_event", "headline": "...", "category": "scandal", "severity": 4}
{"type": "agent_joined", "name": "Alice", "personality": "..."}
{"type": "agent_status", "name": "Alice", "status": "thinking|trading|idle|error"}
{"type": "agent_inspection", "name": "Alice", "memories": [...], "decisions": [...], "portfolio": {...}, "personality": "...", "strategy": "..."}
{"type": "round_transition", "from": 12, "to": 13}
{"type": "game_status", "status": "waiting|running|paused|finished"}
{"type": "game_over", "final_rankings": [...], "highlights": {...}}
```

### Instructor → Server messages (via WS)
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

## Railway Deployment

### `railway.json`
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd frontend && npm install && npm run build && cd ../server && pip install -r requirements.txt"
  },
  "deploy": {
    "startCommand": "cd server && uvicorn main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Environment Variables (set in Railway dashboard)
```
GEMINI_API_KEY=your-key-here
CONTROL_PASSWORD=instructor-secret
```

### `server/requirements.txt`
```
fastapi>=0.110
uvicorn[standard]>=0.29
websockets>=12.0
chromadb>=0.4.0
google-generativeai>=0.5.0
pydantic>=2.0
numpy>=1.26
pyyaml>=6.0
python-dotenv>=1.0
```

## Error Handling
- Every API endpoint: try/except, return JSON errors with helpful messages
- Agent brain fails: log error, default to HOLD, dashboard shows amber status
- Gemini rate limited: retry once, then HOLD
- WebSocket disconnect: clean up connection, dashboard reconnects automatically
- ChromaDB fails: fallback to keyword search
- Server should NEVER crash from bad input
