"""
Market Panic — Agent Brain

THE TEACHING CORE: This file is what the instructor walks through in VS Code
after the simulation. Every function maps to a course session. The code is
intentionally explicit, well-commented, and structured to teach.

The 6-step brain loop:
  Step 1: RAG retrieval        → Session 3 (Write, Select, Compress, Isolate)
  Step 2: Memory recall        → Session 6 (Memory Architectures)
  Step 3: Market analysis      → Session 2 (Context Engineering / Prompts)
  Step 4: Action decision      → Session 4 (Tools & Function Calling)
  Step 5: Memory storage       → Session 6 (Memory Architectures)
  Step 6: Memory compression   → Session 5 (Compress & Isolate)
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time

from server.gemini_client import generate, LLM_MODEL, FLASH_MODEL
from server.knowledge_base import KnowledgeBase
from server.memory import AgentMemory, score_importance
from server.models import (
    COMPANY_MAP,
    AgentState,
    MarketEvent,
    Trade,
)

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# THE MAIN BRAIN LOOP
# This function IS the course capstone — it combines all 6 sessions
# ══════════════════════════════════════════════════════════════

async def run_agent_brain(
    agent: AgentState,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    chat_log: list[str],
    round_num: int,
    knowledge_base: KnowledgeBase,
    memory: AgentMemory,
    gemini_model: str = LLM_MODEL,
    rankings: list[dict] | None = None,
) -> Trade:
    """
    Run one round of decision-making for a single agent.

    This function IS the course capstone — it combines:
      Step 1: RAG retrieval      (Session 3)
      Step 2: Memory recall      (Session 6)
      Step 3: Market analysis    (Session 2 — context engineering)
      Step 4: Action decision    (Session 4 — tool use / structured output)
      Step 5: Memory storage     (Session 6)
      Step 6: Memory compression (Session 5)
    """
    start_time = time.time()

    try:
        # ─────────────────────────────────────────────────
        # STEP 1: RAG — Retrieve relevant knowledge
        # (Session 3: Write, Select, Compress, Isolate)
        # Uses agent.rag_doc_count (Token War Room setting)
        # ─────────────────────────────────────────────────
        relevant_knowledge = await retrieve_knowledge(
            knowledge_base, prices, price_changes, active_events, agent
        )

        # ─────────────────────────────────────────────────
        # STEP 2: MEMORY — Recall past experiences
        # (Session 6: Memory Architectures)
        # Uses agent.memory_recall_count, memory_importance_threshold,
        # forgetting_speed (Memory Architect settings)
        # ─────────────────────────────────────────────────
        relevant_memories = await recall_memories(
            memory, prices, price_changes, active_events, agent, round_num
        )

        # ─────────────────────────────────────────────────
        # STEP 3: ANALYZE — Feed everything to Gemini
        # (Session 2: Context Engineering / Prompt Design)
        # Uses agent.market_data_config, chat_history_count
        # (Token War Room settings control what context is included)
        # ─────────────────────────────────────────────────
        analysis = await analyze_market(
            agent, prices, price_changes, active_events,
            chat_log, relevant_knowledge, relevant_memories,
            round_num, gemini_model, rankings
        )

        # ─────────────────────────────────────────────────
        # STEP 4: DECIDE — Pick an action (structured output)
        # (Session 4: Tools & Function Calling)
        # ─────────────────────────────────────────────────
        trade = await decide_action(
            agent, analysis, prices, round_num, gemini_model
        )

        # ─────────────────────────────────────────────────
        # STEP 5: REMEMBER — Store this round's events
        # (Session 6: Memory Architectures)
        # Uses agent.memory_filters, memory_focus
        # (Memory Architect settings control what + how to remember)
        # ─────────────────────────────────────────────────
        await store_round_memories(
            memory, agent, prices, price_changes,
            active_events, trade, round_num
        )

        # ─────────────────────────────────────────────────
        # STEP 6: COMPRESS — If memory is getting too big
        # (Session 5: Compress & Isolate)
        # Uses agent.compression_trigger (Memory Architect setting)
        # ─────────────────────────────────────────────────
        if await asyncio.to_thread(memory.count) > agent.compression_trigger:
            await memory.compress(round_num, gemini_model)

        # Track response time
        elapsed = time.time() - start_time
        agent.response_times.append(round(elapsed, 2))

        return trade

    except Exception as e:
        logger.error(f"Brain error for {agent.name}: {e}")
        elapsed = time.time() - start_time
        agent.response_times.append(round(elapsed, 2))
        return Trade(
            agent_name=agent.name,
            action="HOLD",
            reasoning=f"Brain error — holding position. ({type(e).__name__})",
            round_num=round_num,
        )


# ══════════════════════════════════════════════════════════════
# STEP 1: RAG RETRIEVAL — Session 3
# Query the shared knowledge base with current market context.
# This is the "Select" in WSCI (Write, Select, Compress, Isolate).
# The knowledge base has ~50 pre-loaded documents about companies,
# sectors, historical patterns, and trading strategies.
#
# Token War Room: agent.rag_doc_count controls how many docs
# are retrieved. More docs = more context = better informed,
# but also more tokens consumed per round.
# ══════════════════════════════════════════════════════════════

async def retrieve_knowledge(
    knowledge_base: KnowledgeBase,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    agent: AgentState,
) -> list[str]:
    """Turn current market state into a natural language query for RAG."""

    # Build a query from what's happening right now
    price_threshold = agent.memory_filters.get("price_threshold", 3.0)
    query_parts = []

    # Mention big movers
    for ticker, change in price_changes.items():
        if abs(change) > price_threshold:
            company = COMPANY_MAP.get(ticker)
            direction = "rising" if change > 0 else "dropping"
            sector = company.sector if company else ticker
            query_parts.append(f"{sector} stock {ticker} {direction} {abs(change):.1f}%")

    # Mention active events
    for event in active_events:
        query_parts.append(f"{event.category}: {event.headline}")

    # Default query if nothing interesting is happening
    if not query_parts:
        query_parts.append("current market conditions, trading strategies, sector analysis")

    query = ", ".join(query_parts)
    return await asyncio.to_thread(knowledge_base.search, query, agent.rag_doc_count)


# ══════════════════════════════════════════════════════════════
# STEP 2: MEMORY RECALL — Session 6
# Retrieve this agent's relevant past experiences.
# Each agent has their own ChromaDB collection of memories
# from previous rounds — trades, events, observations.
#
# Memory Architect: agent.memory_recall_count controls how many
# memories to retrieve. agent.forgetting_speed applies decay
# to old memories, making recent ones more prominent.
# ══════════════════════════════════════════════════════════════

async def recall_memories(
    memory: AgentMemory,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    agent: AgentState,
    round_num: int,
) -> list[dict]:
    """Build a query to find relevant personal memories, apply forgetting decay."""

    query_parts = []

    # What's happening that I might have seen before?
    for event in active_events:
        for ticker in event.affected_tickers:
            if ticker != "ALL":
                query_parts.append(f"past experiences with {ticker} {event.category}")

    # My holdings — what do I remember about these stocks?
    for ticker in agent.portfolio.holdings:
        query_parts.append(f"my trades in {ticker}, {ticker} price movements")

    # Favorite sectors
    for sector in agent.favorite_sectors:
        query_parts.append(f"memories about {sector}")

    if not query_parts:
        query_parts.append("previous rounds, past trades, market events")

    query = ", ".join(query_parts)
    memories = await memory.aretrieve(
        query,
        n_results=agent.memory_recall_count,
        min_importance=agent.memory_importance_threshold,
    )

    # ── Apply forgetting decay (Memory Architect) ──
    # Higher forgetting_speed = faster decay = old memories fade
    # This is a key teaching concept: memory architecture affects behavior
    decay_factors = {1: 0.98, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80}
    decay = decay_factors.get(agent.forgetting_speed, 0.90)

    for mem in memories:
        elapsed = max(0, round_num - mem.get("round", 0))
        mem["effective_importance"] = mem["importance"] * (decay ** elapsed)

    # Re-filter by threshold after decay and re-sort
    memories = [
        m for m in memories
        if m["effective_importance"] >= agent.memory_importance_threshold
    ]
    memories.sort(key=lambda m: m["effective_importance"], reverse=True)

    return memories


# ══════════════════════════════════════════════════════════════
# STEP 3: MARKET ANALYSIS — Session 2
# Feed everything to Gemini with the agent's personality/strategy.
# This is pure context engineering — the prompt structure determines
# how the agent thinks. Different personality text → different analysis.
#
# Token War Room: agent.market_data_config controls which sections
# of market data are included in the prompt. Removing unnecessary
# sections saves tokens. Adding leaderboard gives competitive intel.
# ══════════════════════════════════════════════════════════════

async def analyze_market(
    agent: AgentState,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    chat_log: list[str],
    knowledge: list[str],
    memories: list[dict],
    round_num: int,
    gemini_model: str,
    rankings: list[dict] | None = None,
) -> str:
    """Build the analysis prompt with personality/strategy and call Gemini."""

    # ── System prompt: WHO the agent is ──
    system_prompt = f"""You are {agent.name}, a stock trader in a simulated market.

PERSONALITY: {agent.personality}

TRADING STRATEGY: {agent.strategy}

RISK APPETITE: {agent.risk_level}/5 (1=very cautious, 5=reckless)

FOCUS SECTORS: {', '.join(agent.favorite_sectors) if agent.favorite_sectors else 'No preference'}

You make one trading decision per round. Think carefully about your
personality and strategy when analyzing the market. Stay in character."""

    # ── Analysis prompt: WHAT the agent sees ──
    # Token War Room controls which sections are included
    mdc = agent.market_data_config

    # Format prices (always included — core data)
    if mdc.get("price_changes", True):
        prices_text = "\n".join(
            f"  {ticker}: ${price:.2f} ({'▲' if price_changes.get(ticker, 0) >= 0 else '▼'} "
            f"{abs(price_changes.get(ticker, 0)):.2f}%)"
            for ticker, price in prices.items()
        )
    else:
        prices_text = "\n".join(
            f"  {ticker}: ${price:.2f}" for ticker, price in prices.items()
        )

    sections = [f"=== ROUND {round_num} MARKET BRIEFING ===\n\nCURRENT PRICES:\n{prices_text}"]

    # Full price history (optional — expensive, ~500 tokens)
    if mdc.get("full_price_history", False):
        sections.append("PRICE TREND: Full price change data included above for all tickers.")

    # Portfolio (optional)
    if mdc.get("portfolio_state", True):
        from server.market import calculate_portfolio_value
        total_value = calculate_portfolio_value(agent.portfolio, prices)
        holdings_text = "\n".join(
            f"  {ticker}: {shares} shares (worth ${shares * prices.get(ticker, 0):.2f})"
            for ticker, shares in agent.portfolio.holdings.items()
        ) or "  (no holdings)"
        sections.append(
            f"YOUR PORTFOLIO:\n  Cash: ${agent.portfolio.cash:.2f}\n  Holdings:\n{holdings_text}\n  Total Value: ${total_value:.2f}"
        )

    # Breaking news (optional)
    if mdc.get("active_events", True):
        events_text = "\n".join(
            f"  - [{e.category.upper()}] {e.headline} (severity {e.severity}/5)"
            for e in active_events
        ) or "  (no active events)"
        sections.append(f"BREAKING NEWS:\n{events_text}")

    # Leaderboard (optional — competitive intelligence)
    if mdc.get("agent_rankings", False) and rankings:
        top_5 = rankings[:5]
        lb_text = "\n".join(
            f"  #{r['rank']} {r['name']}: ${r['portfolio_value']:,.2f}"
            for r in top_5
        )
        sections.append(f"LEADERBOARD (top 5):\n{lb_text}")

    # Knowledge (from RAG — always included if docs retrieved)
    knowledge_text = "\n".join(
        f"  - {k}" for k in knowledge
    ) or "  (no relevant intelligence)"
    sections.append(f"MARKET INTELLIGENCE (from research):\n{knowledge_text}")

    # Memories (always included if memories recalled)
    memories_text = "\n".join(
        f"  - [Round {m['round']}] {m['text']} (importance: {m.get('effective_importance', m['importance']):.1f}/10)"
        for m in memories
    ) or "  (no relevant memories)"
    sections.append(f"YOUR MEMORIES:\n{memories_text}")

    # Chat (optional — controlled by chat_history_count)
    if agent.chat_history_count > 0 and chat_log:
        recent_chat = chat_log[-agent.chat_history_count:]
        chat_text = "\n".join(f"  - {msg}" for msg in recent_chat)
        sections.append(f"RECENT CHAT:\n{chat_text}")

    sections.append(
        "Based on your personality and strategy, analyze the current market situation.\n"
        "Think step-by-step:\n"
        "1. What's happening in the market right now?\n"
        "2. How do the news events affect your holdings and target sectors?\n"
        "3. Do your memories suggest any patterns or warnings?\n"
        "4. What does the research say about situations like this?\n"
        "5. Given your risk appetite, what should you do?"
    )

    analysis_prompt = "\n\n".join(sections)

    try:
        return await generate(
            prompt=analysis_prompt,
            system=system_prompt,
            model=gemini_model,
        )
    except Exception as e:
        logger.warning(f"Analysis failed for {agent.name}: {e}")
        return "Unable to analyze market — proceeding with caution."


# ══════════════════════════════════════════════════════════════
# STEP 4: ACTION DECISION — Session 4
# Ask Gemini to pick ONE action and return as structured JSON.
# This demonstrates tool use / function calling concepts —
# the LLM picks from a defined set of "tools" (actions).
# ══════════════════════════════════════════════════════════════

async def decide_action(
    agent: AgentState,
    analysis: str,
    prices: dict[str, float],
    round_num: int,
    gemini_model: str,
) -> Trade:
    """Call Gemini with available actions, parse structured JSON response."""

    # Compute what the agent can actually do
    available_actions = compute_available_actions(agent.portfolio, prices)

    system_prompt = f"""You are {agent.name}. Risk appetite: {agent.risk_level}/5.
You must choose ONE action and respond with ONLY valid JSON."""

    decision_prompt = f"""Based on your analysis:
{analysis}

Choose ONE action from these options:
{json.dumps(available_actions, indent=2)}

Respond with ONLY a JSON object (no markdown, no code blocks):
{{
  "action": "BUY" | "SELL" | "HOLD" | "CHAT",
  "ticker": "NOVA",
  "amount": 5,
  "message": "...",
  "reasoning": "..."
}}

Rules:
- For BUY: include ticker and amount (must not exceed max_shares shown above)
- For SELL: include ticker and amount (must not exceed your holdings)
- For HOLD: just include reasoning
- For CHAT: include a short message and reasoning
- reasoning is ALWAYS required — it shows on the dashboard!"""

    try:
        raw_text = await generate(
            prompt=decision_prompt,
            system=system_prompt,
            model=gemini_model,
        )

        trade = parse_decision(raw_text, available_actions, agent.name, round_num)
        return trade

    except Exception as e:
        logger.warning(f"Decision failed for {agent.name}: {e}")
        return Trade(
            agent_name=agent.name,
            action="HOLD",
            reasoning="Decision error — holding position.",
            round_num=round_num,
        )


def compute_available_actions(
    portfolio, prices: dict[str, float]
) -> list[dict]:
    """
    What can the agent actually do given their portfolio?

    Returns a list of available action descriptors so the LLM
    knows what's possible (and what's not).
    """
    actions = []

    # BUY options
    for ticker, price in prices.items():
        if price > 0 and portfolio.cash >= price:
            max_shares = int(portfolio.cash // price)
            actions.append({
                "action": "BUY",
                "ticker": ticker,
                "max_shares": max_shares,
                "price": price,
            })

    # SELL options
    for ticker, shares in portfolio.holdings.items():
        if shares > 0:
            actions.append({
                "action": "SELL",
                "ticker": ticker,
                "max_shares": shares,
                "current_value": round(shares * prices.get(ticker, 0), 2),
            })

    # Always available
    actions.append({"action": "HOLD"})
    actions.append({"action": "CHAT", "max_length": 100})

    return actions


def parse_decision(
    raw_text: str,
    available_actions: list[dict],
    agent_name: str,
    round_num: int,
) -> Trade:
    """
    Parse LLM JSON output into a validated Trade.

    If parsing fails → default to HOLD with "Parse error" reasoning.
    """
    try:
        # Strip markdown code blocks if present
        text = raw_text.strip()
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

        data = json.loads(text)

        action = data.get("action", "HOLD").upper()
        ticker = data.get("ticker")
        amount = int(data.get("amount", 0))
        reasoning = data.get("reasoning", "No reasoning provided.")
        message = data.get("message")

        # Validate action
        if action not in ("BUY", "SELL", "HOLD", "CHAT"):
            action = "HOLD"
            reasoning = f"Invalid action '{data.get('action')}' — holding."

        # Validate BUY
        if action == "BUY":
            if not ticker:
                action = "HOLD"
                reasoning = "BUY without ticker — holding."
            else:
                buy_options = [a for a in available_actions
                               if a.get("action") == "BUY" and a.get("ticker") == ticker]
                if not buy_options:
                    action = "HOLD"
                    reasoning = f"Cannot afford {ticker} — holding."
                elif amount > buy_options[0]["max_shares"]:
                    amount = buy_options[0]["max_shares"]
                elif amount <= 0:
                    amount = 1

        # Validate SELL
        if action == "SELL":
            if not ticker:
                action = "HOLD"
                reasoning = "SELL without ticker — holding."
            else:
                sell_options = [a for a in available_actions
                                if a.get("action") == "SELL" and a.get("ticker") == ticker]
                if not sell_options:
                    action = "HOLD"
                    reasoning = f"Don't hold {ticker} — holding."
                elif amount > sell_options[0]["max_shares"]:
                    amount = sell_options[0]["max_shares"]
                elif amount <= 0:
                    amount = 1

        return Trade(
            agent_name=agent_name,
            action=action,
            ticker=ticker if action in ("BUY", "SELL") else None,
            amount=amount if action in ("BUY", "SELL") else 0,
            reasoning=reasoning,
            message=message if action == "CHAT" else None,
            round_num=round_num,
        )

    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.warning(f"Parse error for {agent_name}: {e}\nRaw: {raw_text[:200]}")
        return Trade(
            agent_name=agent_name,
            action="HOLD",
            reasoning="Could not parse decision — holding position.",
            round_num=round_num,
        )


# ══════════════════════════════════════════════════════════════
# STEP 5: MEMORY STORAGE — Session 6
# Store this round's events and decisions as memories.
# Each memory gets an importance score that determines whether
# it's retrieved in future rounds. High-importance memories
# (big price moves, scandals, own trades) are recalled more often.
#
# Memory Architect: agent.memory_filters controls WHAT gets stored.
# agent.memory_focus controls HOW it's stored:
#   - episodic: raw events ("MEDI dropped 8%")
#   - semantic: extracted patterns ("Pharma scandals cause 8-12% drops")
#   - procedural: action rules ("When scandal hits, sell immediately")
# ══════════════════════════════════════════════════════════════

async def store_round_memories(
    memory: AgentMemory,
    agent: AgentState,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    trade: Trade,
    round_num: int,
):
    """Create memory entries from this round's events, filtered by Memory Architect settings."""

    memories_to_store = build_round_memories(
        agent, prices, price_changes, active_events, trade, round_num
    )

    # Apply memory focus transformation
    if agent.memory_focus != "episodic" and memories_to_store:
        memories_to_store = await transform_memory_focus(
            memories_to_store, agent.memory_focus
        )

    for mem in memories_to_store:
        await memory.astore(
            text=mem["text"],
            round_num=round_num,
            importance=mem["importance"],
            event_type=mem["type"],
        )


def build_round_memories(
    agent: AgentState,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    trade: Trade,
    round_num: int,
) -> list[dict]:
    """
    Build memory entries from this round, filtered by Memory Architect settings.

    agent.memory_filters controls what types of events are remembered:
    - price_moves + price_threshold: significant price changes
    - news_events: market events from instructor
    - own_trades: BUY/SELL trade results
    - chat_messages: CHAT actions
    - portfolio_snapshots: portfolio value each round (new)
    - failed_trades: HOLD decisions with reasoning (new)
    """
    memories = []
    filters = agent.memory_filters
    price_threshold = filters.get("price_threshold", 3.0)

    # Significant price moves
    if filters.get("price_moves", True):
        for ticker, change in price_changes.items():
            if abs(change) > price_threshold:
                direction = "rose" if change > 0 else "dropped"
                company = COMPANY_MAP.get(ticker)
                name = company.name if company else ticker
                memories.append({
                    "text": f"Round {round_num}: {name} ({ticker}) {direction} {abs(change):.1f}% "
                            f"to ${prices.get(ticker, 0):.2f}",
                    "importance": score_importance("price_change", change),
                    "type": "price_change",
                })

    # Active events
    if filters.get("news_events", True):
        for event in active_events:
            if event.round_injected == round_num:
                memories.append({
                    "text": f"Round {round_num}: [{event.category.upper()}] {event.headline} "
                            f"(severity {event.severity}/5, "
                            f"{'RUMOR - may be false!' if not event.is_true else 'confirmed true'})",
                    "importance": score_importance("news", event.severity * 3),
                    "type": "news",
                })

    # Own trades
    if filters.get("own_trades", True) and trade.action in ("BUY", "SELL"):
        action_past = "bought" if trade.action == "BUY" else "sold"
        # Use prices dict since trade.price isn't set until execute_trade runs later
        exec_price = prices.get(trade.ticker, 0.0) if trade.ticker else 0.0
        memories.append({
            "text": f"Round {round_num}: I {action_past} {trade.amount} {trade.ticker} "
                    f"at ${exec_price:.2f}. Reasoning: {trade.reasoning}",
            "importance": score_importance("trade"),
            "type": "trade",
        })

    # Chat messages
    if filters.get("chat_messages", False) and trade.action == "CHAT" and trade.message:
        memories.append({
            "text": f"Round {round_num}: I said: '{trade.message}'",
            "importance": score_importance("chat"),
            "type": "chat",
        })

    # Portfolio snapshots (NEW — opt-in via Memory Architect)
    if filters.get("portfolio_snapshots", False):
        from server.market import calculate_portfolio_value
        total_value = calculate_portfolio_value(agent.portfolio, prices)
        holdings_summary = ", ".join(
            f"{t} {s}" for t, s in agent.portfolio.holdings.items()
        ) or "no holdings"
        memories.append({
            "text": f"Round {round_num}: Portfolio ${total_value:.2f}. "
                    f"Cash: ${agent.portfolio.cash:.2f}. Holdings: {holdings_summary}",
            "importance": 3,
            "type": "portfolio_snapshot",
        })

    # Failed trades / HOLD reasoning (NEW — opt-in via Memory Architect)
    if filters.get("failed_trades", False) and trade.action == "HOLD":
        if "error" not in trade.reasoning.lower() and "parse" not in trade.reasoning.lower():
            memories.append({
                "text": f"Round {round_num}: Chose to HOLD. Reasoning: {trade.reasoning}",
                "importance": 3,
                "type": "hold_decision",
            })

    return memories


async def transform_memory_focus(
    memories: list[dict],
    focus: str,
) -> list[dict]:
    """
    Transform raw memories based on Memory Architect focus setting.

    - episodic: raw events (default, no transformation)
    - semantic: extract general patterns/rules from events
    - procedural: extract if-then trading rules from events

    Uses Gemini Flash (fast + cheap) for the transformation call.
    """
    if focus == "episodic" or not memories:
        return memories

    transformed = []
    for mem in memories:
        try:
            if focus == "semantic":
                prompt = (
                    f"Based on this market event: '{mem['text']}'\n"
                    f"Extract a general market pattern or rule in ONE sentence. "
                    f"Focus on the underlying principle, not the specific event."
                )
            else:  # procedural
                prompt = (
                    f"Based on this market event: '{mem['text']}'\n"
                    f"Extract a trading rule in ONE sentence starting with 'When... then...'. "
                    f"Make it actionable."
                )

            result = await generate(prompt=prompt, model=FLASH_MODEL)
            transformed.append({
                "text": f"[{focus.upper()}] {result.strip()}",
                "importance": mem["importance"],
                "type": mem["type"],
            })
        except Exception:
            # Fallback to raw episodic memory if transformation fails
            transformed.append(mem)

    return transformed


# ══════════════════════════════════════════════════════════════
# STEP 6: MEMORY COMPRESSION — Session 5
# (Handled by AgentMemory.compress() in memory.py)
# When memory count exceeds agent.compression_trigger, old memories
# are summarized into compressed summaries by Gemini. This keeps
# the agent's context window manageable while preserving
# the key lessons from early rounds.
# ══════════════════════════════════════════════════════════════

# Compression is called in the main brain loop above:
#   if memory.count() > agent.compression_trigger:
#       await memory.compress(round_num, gemini_model)
#
# See server/memory.py for the compression implementation.


# ══════════════════════════════════════════════════════════════
# BATCH EXECUTION — Running 40 agents per round
# ══════════════════════════════════════════════════════════════

async def run_all_agent_brains(
    agents: list[AgentState],
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    chat_log: list[str],
    round_num: int,
    knowledge_base: KnowledgeBase,
    agent_memories: dict[str, AgentMemory],
    gemini_model: str = LLM_MODEL,
    rankings: list[dict] | None = None,
) -> dict[str, Trade]:
    """
    Run all agent brains for a single round, batched to respect rate limits.

    With 40 agents, each making 2 Gemini calls = 80 calls per round.
    We batch in groups of 8 with a brief pause between groups.
    """
    import asyncio

    results: dict[str, Trade] = {}
    batch_size = 8

    # Process agents in batches
    for i in range(0, len(agents), batch_size):
        batch = agents[i : i + batch_size]

        # Update status
        for agent in batch:
            agent.status = "thinking"

        # Run batch concurrently
        batch_tasks = []
        for agent in batch:
            memory = agent_memories.get(agent.name)
            if memory is None:
                results[agent.name] = Trade(
                    agent_name=agent.name,
                    action="HOLD",
                    reasoning="Memory not initialized — holding.",
                    round_num=round_num,
                )
                continue

            batch_tasks.append(
                run_agent_brain(
                    agent=agent,
                    prices=prices,
                    price_changes=price_changes,
                    active_events=active_events,
                    chat_log=chat_log,
                    round_num=round_num,
                    knowledge_base=knowledge_base,
                    memory=memory,
                    gemini_model=gemini_model,
                    rankings=rankings,
                )
            )

        if batch_tasks:
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            task_idx = 0
            for agent in batch:
                if agent.name in results:
                    continue
                result = batch_results[task_idx]
                task_idx += 1

                if isinstance(result, Exception):
                    logger.error(f"Brain exception for {agent.name}: {result}")
                    results[agent.name] = Trade(
                        agent_name=agent.name,
                        action="HOLD",
                        reasoning="Brain exception — holding position.",
                        round_num=round_num,
                    )
                else:
                    results[agent.name] = result

                agent.status = "trading"

        # Brief pause between batches to avoid rate limits
        if i + batch_size < len(agents):
            await asyncio.sleep(0.5)

    return results
