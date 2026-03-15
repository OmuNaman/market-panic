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

import json
import logging
import re
import time

from server.gemini_client import generate, LLM_MODEL
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
        # ─────────────────────────────────────────────────
        relevant_knowledge = retrieve_knowledge(
            knowledge_base, prices, price_changes, active_events
        )

        # ─────────────────────────────────────────────────
        # STEP 2: MEMORY — Recall past experiences
        # (Session 6: Memory Architectures)
        # ─────────────────────────────────────────────────
        relevant_memories = recall_memories(
            memory, prices, price_changes, active_events, agent
        )

        # ─────────────────────────────────────────────────
        # STEP 3: ANALYZE — Feed everything to Gemini
        # (Session 2: Context Engineering / Prompt Design)
        # ─────────────────────────────────────────────────
        analysis = await analyze_market(
            agent, prices, price_changes, active_events,
            chat_log, relevant_knowledge, relevant_memories,
            round_num, gemini_model
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
        # ─────────────────────────────────────────────────
        store_round_memories(
            memory, agent, prices, price_changes,
            active_events, trade, round_num
        )

        # ─────────────────────────────────────────────────
        # STEP 6: COMPRESS — If memory is getting too big
        # (Session 5: Compress & Isolate)
        # ─────────────────────────────────────────────────
        if memory.count() > 50:
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
# ══════════════════════════════════════════════════════════════

def retrieve_knowledge(
    knowledge_base: KnowledgeBase,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
) -> list[str]:
    """Turn current market state into a natural language query for RAG."""

    # Build a query from what's happening right now
    query_parts = []

    # Mention big movers
    for ticker, change in price_changes.items():
        if abs(change) > 3.0:
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
    return knowledge_base.search(query, n_results=5)


# ══════════════════════════════════════════════════════════════
# STEP 2: MEMORY RECALL — Session 6
# Retrieve this agent's relevant past experiences.
# Each agent has their own ChromaDB collection of memories
# from previous rounds — trades, events, observations.
# ══════════════════════════════════════════════════════════════

def recall_memories(
    memory: AgentMemory,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    agent: AgentState,
) -> list[dict]:
    """Build a query to find relevant personal memories."""

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
    return memory.retrieve(query, n_results=10, min_importance=3)


# ══════════════════════════════════════════════════════════════
# STEP 3: MARKET ANALYSIS — Session 2
# Feed everything to Gemini with the agent's personality/strategy.
# This is pure context engineering — the prompt structure determines
# how the agent thinks. Different personality text → different analysis.
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
) -> str:
    """Build the analysis prompt with personality/strategy and call Gemini."""

    # ── System prompt: WHO the agent is ──
    # The student's personality and strategy text goes right here.
    # This is why different students' agents behave differently —
    # their words become the agent's identity.
    system_prompt = f"""You are {agent.name}, a stock trader in a simulated market.

PERSONALITY: {agent.personality}

TRADING STRATEGY: {agent.strategy}

RISK APPETITE: {agent.risk_level}/5 (1=very cautious, 5=reckless)

FOCUS SECTORS: {', '.join(agent.favorite_sectors) if agent.favorite_sectors else 'No preference'}

You make one trading decision per round. Think carefully about your
personality and strategy when analyzing the market. Stay in character."""

    # ── Analysis prompt: WHAT the agent sees ──
    # This is structured context engineering — every section gives
    # the agent a different type of information to reason about.

    # Format prices
    prices_text = "\n".join(
        f"  {ticker}: ${price:.2f} ({'▲' if price_changes.get(ticker, 0) >= 0 else '▼'} "
        f"{abs(price_changes.get(ticker, 0)):.2f}%)"
        for ticker, price in prices.items()
    )

    # Format portfolio
    from server.market import calculate_portfolio_value
    total_value = calculate_portfolio_value(agent.portfolio, prices)
    holdings_text = "\n".join(
        f"  {ticker}: {shares} shares (worth ${shares * prices.get(ticker, 0):.2f})"
        for ticker, shares in agent.portfolio.holdings.items()
    ) or "  (no holdings)"

    # Format events
    events_text = "\n".join(
        f"  - [{e.category.upper()}] {e.headline} (severity {e.severity}/5)"
        for e in active_events
    ) or "  (no active events)"

    # Format knowledge (from RAG)
    knowledge_text = "\n".join(
        f"  - {k}" for k in knowledge
    ) or "  (no relevant intelligence)"

    # Format memories
    memories_text = "\n".join(
        f"  - [Round {m['round']}] {m['text']} (importance: {m['importance']}/10)"
        for m in memories
    ) or "  (no relevant memories)"

    # Format chat
    chat_text = "\n".join(
        f"  - {msg}" for msg in chat_log[-5:]
    ) or "  (no chat messages)"

    analysis_prompt = f"""=== ROUND {round_num} MARKET BRIEFING ===

CURRENT PRICES:
{prices_text}

YOUR PORTFOLIO:
  Cash: ${agent.portfolio.cash:.2f}
  Holdings:
{holdings_text}
  Total Value: ${total_value:.2f}

BREAKING NEWS:
{events_text}

MARKET INTELLIGENCE (from research):
{knowledge_text}

YOUR MEMORIES:
{memories_text}

RECENT CHAT:
{chat_text}

Based on your personality and strategy, analyze the current market situation.
Think step-by-step:
1. What's happening in the market right now?
2. How do the news events affect your holdings and target sectors?
3. Do your memories suggest any patterns or warnings?
4. What does the research say about situations like this?
5. Given your risk appetite, what should you do?"""

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
# ══════════════════════════════════════════════════════════════

def store_round_memories(
    memory: AgentMemory,
    agent: AgentState,
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    trade: Trade,
    round_num: int,
):
    """Create memory entries from this round's events."""

    memories_to_store = build_round_memories(
        prices, price_changes, active_events, trade, round_num
    )

    for mem in memories_to_store:
        memory.store(
            text=mem["text"],
            round_num=round_num,
            importance=mem["importance"],
            event_type=mem["type"],
        )


def build_round_memories(
    prices: dict[str, float],
    price_changes: dict[str, float],
    active_events: list[MarketEvent],
    trade: Trade,
    round_num: int,
) -> list[dict]:
    """
    Build memory entries from this round.

    Only stores significant events — not every boring 0.5% price move.
    This filtering is important: without it, memory fills with noise
    and retrieval quality degrades.
    """
    memories = []

    # Significant price moves (> 3%)
    for ticker, change in price_changes.items():
        if abs(change) > 3.0:
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
    for event in active_events:
        if event.round_injected == round_num:  # only store when first seen
            memories.append({
                "text": f"Round {round_num}: [{event.category.upper()}] {event.headline} "
                        f"(severity {event.severity}/5, "
                        f"{'RUMOR - may be false!' if not event.is_true else 'confirmed true'})",
                "importance": score_importance("news", event.severity * 3),
                "type": "news",
            })

    # Own trade
    if trade.action in ("BUY", "SELL"):
        memories.append({
            "text": f"Round {round_num}: I {trade.action.lower()}ed {trade.amount} {trade.ticker} "
                    f"at ${trade.price:.2f}. Reasoning: {trade.reasoning}",
            "importance": score_importance("trade"),
            "type": "trade",
        })
    elif trade.action == "CHAT" and trade.message:
        memories.append({
            "text": f"Round {round_num}: I said: '{trade.message}'",
            "importance": score_importance("chat"),
            "type": "chat",
        })

    return memories


# ══════════════════════════════════════════════════════════════
# STEP 6: MEMORY COMPRESSION — Session 5
# (Handled by AgentMemory.compress() in memory.py)
# When memory count exceeds the threshold, old memories are
# summarized into compressed summaries by Gemini. This keeps
# the agent's context window manageable while preserving
# the key lessons from early rounds.
# ══════════════════════════════════════════════════════════════

# Compression is called in the main brain loop above:
#   if memory.count() > 50:
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
                # Agent joined mid-game without memory init
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
                )
            )

        if batch_tasks:
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            task_idx = 0
            for agent in batch:
                if agent.name in results:
                    continue  # already handled (no memory)
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
