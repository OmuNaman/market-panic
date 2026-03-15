"""
Market Panic — Game Orchestrator

Coordinates the game loop: round management, price ticks, agent brain
execution, trade settlement, and broadcasting updates to the dashboard.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Callable, Awaitable

import chromadb

from server.agent_brain import run_all_agent_brains
from server.events import EventEngine
from server.knowledge_base import KnowledgeBase
from server.market import MarketEngine, execute_trade, get_rankings, calculate_portfolio_value
from server.memory import AgentMemory
from server.models import (
    AgentCreateRequest,
    AgentState,
    GameConfig,
    GameStatus,
    MarketEvent,
    Portfolio,
    Trade,
)

logger = logging.getLogger(__name__)


class GameOrchestrator:
    """
    Manages the entire game lifecycle: waiting → running → paused → finished.
    Coordinates market simulation, agent brains, and WebSocket broadcasting.
    """

    def __init__(self):
        # Game state
        self.status: GameStatus = GameStatus.WAITING
        self.config: GameConfig = GameConfig()
        self.current_round: int = 0

        # Core systems
        self.market = MarketEngine()
        self.events = EventEngine()
        self.knowledge_base = KnowledgeBase()

        # Agents
        self.agents: dict[str, AgentState] = {}
        self.agent_memories: dict[str, AgentMemory] = {}
        self.chromadb_client = chromadb.Client()

        # Chat log
        self.chat_log: list[str] = []

        # Game loop control
        self._game_task: asyncio.Task | None = None
        self._paused_event = asyncio.Event()
        self._paused_event.set()  # not paused initially

        # Broadcast callback (set by main.py)
        self.broadcast: Callable[[dict], Awaitable[None]] | None = None

        # Trade history per round (for highlights)
        self.all_trades: list[Trade] = []

    async def initialize(self):
        """Initialize knowledge base. Called on server startup."""
        self.knowledge_base.initialize()
        logger.info("Knowledge base initialized")

    # ── Agent Management ──────────────────────────────────────

    def add_agent(self, request: AgentCreateRequest) -> AgentState:
        """Create a new agent from the /join form submission."""
        if request.name in self.agents:
            raise ValueError(f"Agent '{request.name}' already exists")

        agent = AgentState(
            name=request.name,
            personality=request.personality,
            strategy=request.strategy,
            risk_level=request.risk_level,
            favorite_sectors=request.favorite_sectors,
            portfolio=Portfolio(cash=self.config.starting_cash),
        )

        # Create per-agent memory collection
        memory = AgentMemory(request.name, self.chromadb_client)

        self.agents[request.name] = agent
        self.agent_memories[request.name] = memory

        logger.info(f"Agent '{request.name}' joined (total: {len(self.agents)})")
        return agent

    def remove_agent(self, name: str) -> bool:
        """Remove an agent from the game."""
        if name in self.agents:
            del self.agents[name]
            self.agent_memories.pop(name, None)
            logger.info(f"Agent '{name}' removed")
            return True
        return False

    def get_agent(self, name: str) -> AgentState | None:
        """Get an agent's full state."""
        return self.agents.get(name)

    def get_agent_inspection(self, name: str) -> dict | None:
        """Get full inspection data for the AgentInspector panel."""
        agent = self.agents.get(name)
        if not agent:
            return None

        memory = self.agent_memories.get(name)
        memories = memory.get_all() if memory else []

        return {
            "name": agent.name,
            "personality": agent.personality,
            "strategy": agent.strategy,
            "risk_level": agent.risk_level,
            "favorite_sectors": agent.favorite_sectors,
            "portfolio": {
                "cash": round(agent.portfolio.cash, 2),
                "holdings": agent.portfolio.holdings,
                "total_value": calculate_portfolio_value(agent.portfolio, self.market.prices),
            },
            "memories": memories,
            "decisions": [
                {
                    "round": d.round_num,
                    "action": d.action,
                    "ticker": d.ticker,
                    "amount": d.amount,
                    "price": d.price,
                    "reasoning": d.reasoning,
                    "message": d.message,
                }
                for d in agent.decisions
            ],
            "response_times": agent.response_times,
            "status": agent.status,
        }

    # ── Game Control ──────────────────────────────────────────

    async def start_game(self, config: dict | None = None):
        """Start the simulation."""
        if self.status != GameStatus.WAITING:
            raise ValueError(f"Cannot start game in '{self.status}' state")

        if config:
            self.config = GameConfig(**{
                **self.config.model_dump(),
                **{k: v for k, v in config.items() if v is not None},
            })

        self.status = GameStatus.RUNNING
        self.current_round = 0
        self.market.reset()
        self.events.clear()
        self.all_trades.clear()
        self.chat_log.clear()

        # Reset agent portfolios
        for agent in self.agents.values():
            agent.portfolio = Portfolio(cash=self.config.starting_cash)
            agent.decisions.clear()
            agent.response_times.clear()
            agent.status = "idle"

        await self._broadcast({"type": "game_status", "status": "running"})
        logger.info(f"Game started with {len(self.agents)} agents, {self.config.total_rounds} rounds")

        # Start the game loop
        self._game_task = asyncio.create_task(self._game_loop())

    async def pause_game(self):
        """Pause the simulation."""
        if self.status == GameStatus.RUNNING:
            self.status = GameStatus.PAUSED
            self._paused_event.clear()
            await self._broadcast({"type": "game_status", "status": "paused"})
            logger.info("Game paused")

    async def resume_game(self):
        """Resume the simulation."""
        if self.status == GameStatus.PAUSED:
            self.status = GameStatus.RUNNING
            self._paused_event.set()
            await self._broadcast({"type": "game_status", "status": "running"})
            logger.info("Game resumed")

    async def end_game(self):
        """End the simulation and show results."""
        self.status = GameStatus.FINISHED
        self._paused_event.set()  # unblock if paused

        if self._game_task and not self._game_task.done():
            self._game_task.cancel()
            try:
                await self._game_task
            except asyncio.CancelledError:
                pass

        # Final rankings
        agents_list = list(self.agents.values())
        final_rankings = get_rankings(agents_list, self.market.prices)

        # Compute highlights
        highlights = self._compute_highlights()

        await self._broadcast({
            "type": "game_over",
            "final_rankings": final_rankings,
            "highlights": highlights,
        })
        await self._broadcast({"type": "game_status", "status": "finished"})
        logger.info("Game ended")

    def set_speed(self, multiplier: float):
        """Change game speed. 1x=normal, 2x=double speed, etc."""
        self.config.speed_multiplier = max(0.5, min(5.0, multiplier))
        logger.info(f"Speed set to {self.config.speed_multiplier}x")

    # ── Event Injection ───────────────────────────────────────

    async def inject_event(self, event_data: dict) -> MarketEvent:
        """Inject a custom event from the control panel."""
        event = MarketEvent(**event_data)
        self.events.inject_event(event, self.current_round)

        await self._broadcast({
            "type": "news_event",
            "headline": event.headline,
            "category": event.category,
            "severity": event.severity,
            "affected_tickers": event.affected_tickers,
            "is_true": event.is_true,
            "round": self.current_round,
        })

        return event

    async def inject_scenario(self, scenario_name: str) -> list[MarketEvent]:
        """Inject a pre-built scenario."""
        events = self.events.inject_scenario(scenario_name, self.current_round)

        # Broadcast the first event immediately (others fire on their round_offset)
        for event in events:
            if event.round_injected == self.current_round:
                await self._broadcast({
                    "type": "news_event",
                    "headline": event.headline,
                    "category": event.category,
                    "severity": event.severity,
                    "affected_tickers": event.affected_tickers,
                    "is_true": event.is_true,
                    "round": self.current_round,
                })

        return events

    # ── Game Loop ─────────────────────────────────────────────

    async def _game_loop(self):
        """Main game loop — runs rounds until finished or cancelled."""
        try:
            for round_num in range(1, self.config.total_rounds + 1):
                if self.status == GameStatus.FINISHED:
                    break

                # Wait if paused
                await self._paused_event.wait()
                if self.status == GameStatus.FINISHED:
                    break

                await self._run_round(round_num)

                # Wait between rounds (adjusted by speed)
                interval = self.config.round_duration / self.config.speed_multiplier
                await asyncio.sleep(interval)

            # Game completed all rounds
            if self.status == GameStatus.RUNNING:
                await self.end_game()

        except asyncio.CancelledError:
            logger.info("Game loop cancelled")
        except Exception as e:
            logger.error(f"Game loop error: {e}")
            self.status = GameStatus.FINISHED

    async def _run_round(self, round_num: int):
        """Execute a single round of the simulation."""
        self.current_round = round_num
        agents_list = list(self.agents.values())

        # Broadcast round transition
        await self._broadcast({
            "type": "round_transition",
            "from": round_num - 1,
            "to": round_num,
        })

        # 1. Tick prices (GBM + event impacts)
        active_events = self.events.get_active(round_num)
        new_prices = self.market.tick(active_events, round_num)
        price_changes = self.market.get_price_changes()

        # Broadcast any new events this round
        for event in active_events:
            if event.round_injected == round_num:
                await self._broadcast({
                    "type": "news_event",
                    "headline": event.headline,
                    "category": event.category,
                    "severity": event.severity,
                    "affected_tickers": event.affected_tickers,
                    "is_true": event.is_true,
                    "round": round_num,
                })

        # 2. Run ALL agent brains (the big one)
        if agents_list:
            decisions = await run_all_agent_brains(
                agents=agents_list,
                prices=new_prices,
                price_changes=price_changes,
                active_events=active_events,
                chat_log=self.chat_log,
                round_num=round_num,
                knowledge_base=self.knowledge_base,
                agent_memories=self.agent_memories,
            )

            # 3. Execute trades
            round_trades: list[Trade] = []
            for agent in agents_list:
                trade = decisions.get(agent.name)
                if trade and trade.action in ("BUY", "SELL"):
                    trade = execute_trade(agent, trade, new_prices)
                if trade:
                    agent.decisions.append(trade)
                    round_trades.append(trade)
                    self.all_trades.append(trade)

                    # Handle chat messages
                    if trade.action == "CHAT" and trade.message:
                        self.chat_log.append(f"{agent.name}: {trade.message}")

                agent.status = "idle"

            # 4. Apply order pressure from trades
            self.market.apply_order_pressure(round_trades)

            # Broadcast individual trades
            for trade in round_trades:
                if trade.action in ("BUY", "SELL"):
                    await self._broadcast({
                        "type": "trade_executed",
                        "agent": trade.agent_name,
                        "action": trade.action,
                        "ticker": trade.ticker,
                        "amount": trade.amount,
                        "price": trade.price,
                        "reasoning": trade.reasoning,
                        "round": round_num,
                    })

        # 5. Compute rankings
        rankings = get_rankings(agents_list, new_prices)

        # 6. Broadcast market update
        await self._broadcast({
            "type": "market_update",
            "round": round_num,
            "total_rounds": self.config.total_rounds,
            "prices": new_prices,
            "price_changes": price_changes,
            "price_history": self.market.get_history(),
            "rankings": rankings,
            "active_events": [
                {
                    "headline": e.headline,
                    "category": e.category,
                    "severity": e.severity,
                    "affected_tickers": e.affected_tickers,
                }
                for e in active_events
            ],
        })

        logger.info(
            f"Round {round_num}/{self.config.total_rounds} complete — "
            f"{len(agents_list)} agents, {sum(1 for t in decisions.values() if t.action != 'HOLD')} trades"
            if agents_list else f"Round {round_num}/{self.config.total_rounds} complete — no agents"
        )

    # ── Helpers ────────────────────────────────────────────────

    def _compute_highlights(self) -> dict:
        """Compute game highlights for the GameOver screen."""
        highlights = {}

        if not self.all_trades:
            return highlights

        # Best single trade (biggest profit potential)
        buy_trades = [t for t in self.all_trades if t.action == "BUY" and t.price > 0]
        sell_trades = [t for t in self.all_trades if t.action == "SELL" and t.price > 0]

        if buy_trades:
            biggest_buy = max(buy_trades, key=lambda t: t.amount * t.price)
            highlights["biggest_buy"] = {
                "agent": biggest_buy.agent_name,
                "ticker": biggest_buy.ticker,
                "amount": biggest_buy.amount,
                "value": round(biggest_buy.amount * biggest_buy.price, 2),
                "round": biggest_buy.round_num,
            }

        if sell_trades:
            biggest_sell = max(sell_trades, key=lambda t: t.amount * t.price)
            highlights["biggest_sell"] = {
                "agent": biggest_sell.agent_name,
                "ticker": biggest_sell.ticker,
                "amount": biggest_sell.amount,
                "value": round(biggest_sell.amount * biggest_sell.price, 2),
                "round": biggest_sell.round_num,
            }

        # Most active trader
        from collections import Counter
        trade_counts = Counter(t.agent_name for t in self.all_trades if t.action in ("BUY", "SELL"))
        if trade_counts:
            most_active_name = trade_counts.most_common(1)[0]
            highlights["most_active"] = {
                "agent": most_active_name[0],
                "trade_count": most_active_name[1],
            }

        # Chatterbox (most chat messages)
        chat_counts = Counter(t.agent_name for t in self.all_trades if t.action == "CHAT")
        if chat_counts:
            chatterbox = chat_counts.most_common(1)[0]
            highlights["chatterbox"] = {
                "agent": chatterbox[0],
                "message_count": chatterbox[1],
            }

        # Memory champion (most memories)
        if self.agent_memories:
            memory_counts = {
                name: mem.count()
                for name, mem in self.agent_memories.items()
            }
            if memory_counts:
                champion_name = max(memory_counts, key=memory_counts.get)
                highlights["memory_champion"] = {
                    "agent": champion_name,
                    "memory_count": memory_counts[champion_name],
                }

        return highlights

    async def _broadcast(self, data: dict):
        """Send data to all connected dashboards/instructor via WebSocket."""
        if self.broadcast:
            await self.broadcast(data)

    def get_market_state(self) -> dict:
        """Get current market state for REST API and WebSocket reconnect."""
        agents_list = list(self.agents.values())
        rankings = get_rankings(agents_list, self.market.prices) if agents_list else []
        active_events = self.events.get_active(self.current_round)

        return {
            "status": self.status.value,
            "round": self.current_round,
            "total_rounds": self.config.total_rounds,
            "prices": self.market.prices,
            "price_changes": self.market.get_price_changes(),
            "price_history": self.market.get_history(),
            "rankings": rankings,
            "active_events": [
                {
                    "headline": e.headline,
                    "category": e.category,
                    "severity": e.severity,
                    "affected_tickers": e.affected_tickers,
                }
                for e in active_events
            ],
            "agent_count": len(self.agents),
            "speed": self.config.speed_multiplier,
        }
