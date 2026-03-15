"""
Market Panic — FastAPI Application

The main server: REST API for agent creation, WebSocket hub for real-time
updates, and static file serving for the React frontend.
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from server.models import AgentCreateRequest, MarketEvent
from server.orchestrator import GameOrchestrator

load_dotenv()

# ── Logging ───────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("market_panic")


# ── Gemini Setup ──────────────────────────────────────────────

api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    logger.info("Gemini API key found")
else:
    logger.warning("GEMINI_API_KEY not set — agent brains will fail")

CONTROL_PASSWORD = os.getenv("CONTROL_PASSWORD", "instructor")


# ── WebSocket Connection Manager ─────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections for dashboard viewers and instructor."""

    def __init__(self):
        self.dashboard_connections: list[WebSocket] = []
        self.instructor_connections: list[WebSocket] = []

    async def connect_dashboard(self, ws: WebSocket):
        await ws.accept()
        self.dashboard_connections.append(ws)
        logger.info(f"Dashboard connected (total: {len(self.dashboard_connections)})")

    async def connect_instructor(self, ws: WebSocket):
        await ws.accept()
        self.instructor_connections.append(ws)
        logger.info(f"Instructor connected (total: {len(self.instructor_connections)})")

    def disconnect_dashboard(self, ws: WebSocket):
        if ws in self.dashboard_connections:
            self.dashboard_connections.remove(ws)
        logger.info(f"Dashboard disconnected (total: {len(self.dashboard_connections)})")

    def disconnect_instructor(self, ws: WebSocket):
        if ws in self.instructor_connections:
            self.instructor_connections.remove(ws)
        logger.info(f"Instructor disconnected (total: {len(self.instructor_connections)})")

    async def broadcast(self, data: dict):
        """Send data to ALL connections (dashboard + instructor)."""
        message = json.dumps(data)
        dead: list[WebSocket] = []

        for ws in self.dashboard_connections + self.instructor_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            if ws in self.dashboard_connections:
                self.dashboard_connections.remove(ws)
            if ws in self.instructor_connections:
                self.instructor_connections.remove(ws)

    async def send_to_instructor(self, data: dict):
        """Send data to instructor connections only."""
        message = json.dumps(data)
        dead: list[WebSocket] = []

        for ws in self.instructor_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.instructor_connections.remove(ws)


# ── App Setup ─────────────────────────────────────────────────

manager = ConnectionManager()
orchestrator = GameOrchestrator()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize knowledge base on startup."""
    await orchestrator.initialize()
    orchestrator.broadcast = manager.broadcast
    logger.info("Market Panic server ready")
    yield
    logger.info("Market Panic server shutting down")


app = FastAPI(title="Market Panic", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST API: Agents ──────────────────────────────────────────

@app.post("/api/agents/create")
async def create_agent(request: AgentCreateRequest):
    """Create a new agent from the /join form."""
    try:
        agent = orchestrator.add_agent(request)

        # Broadcast to dashboard
        await manager.broadcast({
            "type": "agent_joined",
            "name": agent.name,
            "personality": agent.personality,
            "strategy": agent.strategy,
            "risk_level": agent.risk_level,
            "favorite_sectors": agent.favorite_sectors,
        })

        return JSONResponse(
            status_code=201,
            content={
                "name": agent.name,
                "status": "ready",
                "game_status": orchestrator.status.value,
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to create agent")


@app.get("/api/agents/count")
async def agent_count():
    """Get the number of registered agents."""
    return {"count": len(orchestrator.agents)}


@app.get("/api/agents")
async def list_agents():
    """List all agents with basic info."""
    return {
        "agents": [
            {
                "name": a.name,
                "status": a.status,
                "portfolio_value": round(
                    a.portfolio.cash + sum(
                        shares * orchestrator.market.prices.get(ticker, 0)
                        for ticker, shares in a.portfolio.holdings.items()
                    ),
                    2,
                ),
            }
            for a in orchestrator.agents.values()
        ]
    }


@app.get("/api/agents/{name}")
async def get_agent(name: str):
    """Get full agent inspection data."""
    data = orchestrator.get_agent_inspection(name)
    if not data:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    return data


@app.delete("/api/agents/{name}")
async def delete_agent(name: str):
    """Remove an agent (instructor only)."""
    if orchestrator.remove_agent(name):
        await manager.broadcast({"type": "agent_removed", "name": name})
        return {"status": "removed"}
    raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")


# ── REST API: Market ──────────────────────────────────────────

@app.get("/api/market/state")
async def market_state():
    """Get current market state."""
    return orchestrator.get_market_state()


@app.get("/api/market/history")
async def market_history():
    """Get price history for charting."""
    return {"history": orchestrator.market.get_history()}


# ── REST API: Events ──────────────────────────────────────────

@app.get("/api/events/scenarios")
async def list_scenarios():
    """List available pre-built scenarios."""
    return {
        "scenarios": [
            {
                "name": name,
                "events": orchestrator.events.get_scenario_preview(name),
                "event_count": len(orchestrator.events.get_scenario_preview(name)),
            }
            for name in orchestrator.events.get_scenario_names()
        ]
    }


# ── REST API: Knowledge ──────────────────────────────────────

@app.get("/api/knowledge/search")
async def search_knowledge(q: str = Query(..., min_length=1), n: int = 5):
    """Search the knowledge base (for debugging/demo)."""
    results = orchestrator.knowledge_base.search(q, n_results=n)
    return {"query": q, "results": results}


# ── REST API: Health ──────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "game_status": orchestrator.status.value,
        "agents": len(orchestrator.agents),
        "round": orchestrator.current_round,
    }


# ── WebSocket: Dashboard ─────────────────────────────────────

@app.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    """
    Dashboard WebSocket — read-only.
    Receives all game broadcasts (market_update, leaderboard, trades, etc.)
    """
    await manager.connect_dashboard(websocket)

    # Send current state on connect (handles page refresh)
    try:
        await websocket.send_json({
            "type": "game_status",
            "status": orchestrator.status.value,
        })
        # Send all existing agents so leaderboard populates
        for agent in orchestrator.agents.values():
            await websocket.send_json({
                "type": "agent_joined",
                "name": agent.name,
                "personality": agent.personality,
                "strategy": agent.strategy,
                "risk_level": agent.risk_level,
                "favorite_sectors": agent.favorite_sectors,
            })
        # Send current market state if game is running
        if orchestrator.status.value in ("running", "paused"):
            await websocket.send_json({
                "type": "market_update",
                **orchestrator.get_market_state(),
            })
        # Send recent trades so activity feed populates
        recent_trades = orchestrator.all_trades[-50:]
        for trade in recent_trades:
            if trade.action in ("BUY", "SELL"):
                await websocket.send_json({
                    "type": "trade_executed",
                    "agent": trade.agent_name,
                    "action": trade.action,
                    "ticker": trade.ticker,
                    "amount": trade.amount,
                    "price": trade.price,
                    "reasoning": trade.reasoning,
                    "round": trade.round_num,
                })
        # Send event history so news ticker populates
        for event in orchestrator.events.event_history[-20:]:
            await websocket.send_json({
                "type": "news_event",
                "headline": event.headline,
                "category": event.category,
                "severity": event.severity,
                "affected_tickers": event.affected_tickers,
                "is_true": event.is_true,
                "round": event.round_injected,
            })
    except Exception:
        pass

    try:
        while True:
            # Dashboard doesn't send messages, but we need to keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_dashboard(websocket)


# ── WebSocket: Instructor ────────────────────────────────────

@app.websocket("/ws/instructor")
async def ws_instructor(websocket: WebSocket, password: str = Query("")):
    """
    Instructor WebSocket — bidirectional.
    Receives broadcasts AND accepts control commands.
    """
    if password != CONTROL_PASSWORD:
        await websocket.accept()
        await websocket.close(code=4003, reason="Invalid password")
        return

    await manager.connect_instructor(websocket)

    # Send current state on connect
    try:
        await websocket.send_json({
            "type": "game_status",
            "status": orchestrator.status.value,
        })
        if orchestrator.status.value != "waiting":
            await websocket.send_json({
                "type": "market_update",
                **orchestrator.get_market_state(),
            })
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_instructor_message(data, websocket)
    except WebSocketDisconnect:
        manager.disconnect_instructor(websocket)
    except Exception as e:
        logger.error(f"Instructor WS error: {e}")
        manager.disconnect_instructor(websocket)


async def _handle_instructor_message(data: dict, ws: WebSocket):
    """Route instructor WebSocket messages to appropriate handlers."""
    msg_type = data.get("type")

    try:
        if msg_type == "start_game":
            config = data.get("config")
            await orchestrator.start_game(config)

        elif msg_type == "pause_game":
            await orchestrator.pause_game()

        elif msg_type == "resume_game":
            await orchestrator.resume_game()

        elif msg_type == "end_game":
            await orchestrator.end_game()

        elif msg_type == "set_speed":
            multiplier = data.get("multiplier", 1.0)
            orchestrator.set_speed(multiplier)
            await manager.broadcast({
                "type": "speed_changed",
                "multiplier": orchestrator.config.speed_multiplier,
            })

        elif msg_type == "inject_event":
            event_data = data.get("event", {})
            await orchestrator.inject_event(event_data)

        elif msg_type == "inject_scenario":
            scenario_name = data.get("scenario_name", "")
            events = await orchestrator.inject_scenario(scenario_name)
            await ws.send_json({
                "type": "scenario_loaded",
                "scenario": scenario_name,
                "event_count": len(events),
            })

        elif msg_type == "remove_agent":
            name = data.get("name", "")
            orchestrator.remove_agent(name)
            await manager.broadcast({"type": "agent_removed", "name": name})

        elif msg_type == "inspect_agent":
            name = data.get("name", "")
            inspection = orchestrator.get_agent_inspection(name)
            if inspection:
                await manager.broadcast({
                    "type": "agent_inspection",
                    **inspection,
                })

        else:
            logger.warning(f"Unknown instructor message type: {msg_type}")

    except Exception as e:
        logger.error(f"Error handling instructor message '{msg_type}': {e}")
        await ws.send_json({
            "type": "error",
            "message": str(e),
        })


# ── Static File Serving (MUST be last) ───────────────────────
# In production, FastAPI serves the built React frontend.
# This mount catches all routes not handled by API/WS endpoints
# and serves the SPA's index.html for client-side routing.

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True))
    logger.info(f"Serving frontend from {frontend_dist}")
else:
    logger.info("Frontend dist not found — API-only mode (run 'cd frontend && npm run build')")
