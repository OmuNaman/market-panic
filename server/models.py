"""
Market Panic — Pydantic Models

All shared data types for the simulation. Every other server file imports from here.
"""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


# ── Game Status ──────────────────────────────────────────────

class GameStatus(str, Enum):
    WAITING = "waiting"
    RUNNING = "running"
    PAUSED = "paused"
    FINISHED = "finished"


# ── Company ──────────────────────────────────────────────────

class Company(BaseModel):
    ticker: str
    name: str
    sector: str
    start_price: float
    volatility: float  # sigma for GBM
    personality: str   # how this stock behaves narratively


COMPANIES: list[Company] = [
    Company(
        ticker="NOVA",
        name="TechNova",
        sector="AI/Tech",
        start_price=150.0,
        volatility=0.03,
        personality="Hype-driven, momentum, AI news sensitive",
    ),
    Company(
        ticker="GRNE",
        name="GreenPulse",
        sector="Clean Energy",
        start_price=85.0,
        volatility=0.02,
        personality="Policy-sensitive, steady, regulation driven",
    ),
    Company(
        ticker="MEDI",
        name="MediCorp",
        sector="Pharma",
        start_price=200.0,
        volatility=0.025,
        personality="Scandal-prone, patent cliffs, big upside",
    ),
    Company(
        ticker="FOOD",
        name="FoodCo",
        sector="Agriculture",
        start_price=45.0,
        volatility=0.012,
        personality="Safe haven, boring, great in downturns",
    ),
    Company(
        ticker="LUXE",
        name="LuxeGlobal",
        sector="Luxury",
        start_price=310.0,
        volatility=0.035,
        personality="Sentiment-driven, celebrity-linked, volatile",
    ),
    Company(
        ticker="IRON",
        name="IronShield",
        sector="Defense",
        start_price=120.0,
        volatility=0.015,
        personality="Geopolitics play, inverse market correlation",
    ),
]

TICKERS: list[str] = [c.ticker for c in COMPANIES]
COMPANY_MAP: dict[str, Company] = {c.ticker: c for c in COMPANIES}


# ── Market Event ─────────────────────────────────────────────

EventCategory = Literal[
    "earnings", "scandal", "rumor", "regulation",
    "partnership", "panic", "recovery",
]

SEVERITY_IMPACT: dict[int, float] = {
    1: 0.02,
    2: 0.05,
    3: 0.08,
    4: 0.12,
    5: 0.18,
}

NEGATIVE_CATEGORIES: set[str] = {"scandal", "panic"}
POSITIVE_CATEGORIES: set[str] = {"earnings", "partnership", "recovery", "regulation"}


class MarketEvent(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    headline: str
    category: EventCategory
    affected_tickers: list[str]  # ticker codes or ["ALL"]
    severity: int = Field(ge=1, le=5)
    is_true: bool = True
    duration_rounds: int = 3
    round_injected: int = 0

    @property
    def impact(self) -> float:
        """Signed impact based on severity and category."""
        magnitude = SEVERITY_IMPACT.get(self.severity, 0.05)
        if self.category in NEGATIVE_CATEGORIES:
            return -magnitude
        if self.category == "rumor":
            # Rumors: positive impact initially (hype), but reduced magnitude
            # The "damage" comes later when the rumor is denied
            return magnitude * 0.7
        return magnitude


# ── Trade ────────────────────────────────────────────────────

ActionType = Literal["BUY", "SELL", "HOLD", "CHAT"]


class Trade(BaseModel):
    agent_name: str
    action: ActionType
    ticker: str | None = None
    amount: int = 0
    price: float = 0.0
    reasoning: str = ""
    message: str | None = None  # for CHAT action
    round_num: int = 0


# ── Portfolio ────────────────────────────────────────────────

class Portfolio(BaseModel):
    cash: float = 10_000.0
    holdings: dict[str, int] = Field(default_factory=dict)  # ticker → shares


# ── Agent State ──────────────────────────────────────────────

AgentStatus = Literal["waiting", "thinking", "trading", "idle", "error"]


class AgentState(BaseModel):
    name: str
    personality: str
    strategy: str
    risk_level: int = Field(ge=1, le=5, default=3)
    favorite_sectors: list[str] = Field(default_factory=list)
    portfolio: Portfolio = Field(default_factory=Portfolio)
    status: AgentStatus = "waiting"
    decisions: list[Trade] = Field(default_factory=list)
    response_times: list[float] = Field(default_factory=list)

    # ── Token War Room ───────────────────────────────────────
    rag_doc_count: int = Field(default=5, ge=1, le=10)
    memory_recall_count: int = Field(default=10, ge=3, le=20)
    memory_importance_threshold: int = Field(default=3, ge=1, le=10)
    chat_history_count: int = Field(default=5, ge=0, le=10)
    market_data_config: dict = Field(default_factory=lambda: {
        "price_changes": True, "full_price_history": False,
        "portfolio_state": True, "active_events": True, "agent_rankings": False,
    })

    # ── Memory Architect ─────────────────────────────────────
    memory_focus: str = Field(default="episodic")
    forgetting_speed: int = Field(default=3, ge=1, le=5)
    compression_trigger: int = Field(default=50, ge=10, le=100)
    memory_filters: dict = Field(default_factory=lambda: {
        "price_moves": True, "price_threshold": 3.0,
        "news_events": True, "own_trades": True,
        "chat_messages": False, "portfolio_snapshots": False, "failed_trades": False,
    })


# ── Game Config ──────────────────────────────────────────────

class GameConfig(BaseModel):
    total_rounds: int = 30
    round_duration: float = 30.0  # seconds per round at 1x speed
    starting_cash: float = 10_000.0
    speed_multiplier: float = 1.0


# ── Agent Creation Request (from /join form) ─────────────────

class AgentCreateRequest(BaseModel):
    name: str = Field(max_length=20, min_length=1, pattern=r'^[a-zA-Z0-9_\- ]+$')
    personality: str = Field(min_length=1)
    strategy: str = Field(min_length=1)
    risk_level: int = Field(ge=1, le=5, default=3)
    favorite_sectors: list[str] = Field(default_factory=list)

    # Token War Room (optional — defaults match current hardcoded behavior)
    rag_doc_count: int = Field(default=5, ge=1, le=10)
    memory_recall_count: int = Field(default=10, ge=3, le=20)
    memory_importance_threshold: int = Field(default=3, ge=1, le=10)
    chat_history_count: int = Field(default=5, ge=0, le=10)
    market_data_config: dict = Field(default_factory=lambda: {
        "price_changes": True, "full_price_history": False,
        "portfolio_state": True, "active_events": True, "agent_rankings": False,
    })

    # Memory Architect (optional — defaults match current behavior)
    memory_focus: str = Field(default="episodic")
    forgetting_speed: int = Field(default=3, ge=1, le=5)
    compression_trigger: int = Field(default=50, ge=10, le=100)
    memory_filters: dict = Field(default_factory=lambda: {
        "price_moves": True, "price_threshold": 3.0,
        "news_events": True, "own_trades": True,
        "chat_messages": False, "portfolio_snapshots": False, "failed_trades": False,
    })
