---
name: build-agent-brain
description: Build the agent brain system — the server-side code that runs every agent's decision-making using RAG, memory, compression, and Gemini. This is THE teaching core — the code the instructor walks through after the simulation to explain how everything works.
---

# Agent Brain Build Skill

## Context
This is the most important code in the entire project from a TEACHING perspective. After students watch the simulation, the instructor screen-shares VS Code and walks through this file explaining: "This is how your agent made decisions." Every function maps to a course session. The code must be clean, well-commented, and structured to teach.

## Architecture
```
server/agent_brain.py  → Orchestrates the 6-step brain loop per agent
server/memory.py       → ChromaDB memory per agent (store, retrieve, compress)
server/knowledge_base.py → Shared knowledge base (RAG)
```

## `server/agent_brain.py` — The Main Brain Loop

```python
async def run_agent_brain(
    agent: AgentState,
    prices: dict,
    price_changes: dict,
    active_events: list[MarketEvent],
    chat_log: list[str],
    round_num: int,
    knowledge_base,    # shared ChromaDB collection
    memory_store,      # this agent's ChromaDB collection
    gemini_client,
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
    
    # ─────────────────────────────────────────────────
    # STEP 1: RAG — Retrieve relevant knowledge
    # (Session 3: Write, Select, Compress, Isolate)
    # ─────────────────────────────────────────────────
    
    # Build a query from current market context
    query = build_knowledge_query(prices, price_changes, active_events)
    # e.g. "pharma stock dropping after scandal, defense sector rising"
    
    relevant_knowledge = knowledge_base.query(
        query_texts=[query],
        n_results=5
    )["documents"][0]
    # Returns: ["When pharma scandals hit, prices typically drop 10-15%...", ...]
    
    
    # ─────────────────────────────────────────────────
    # STEP 2: MEMORY — Recall past experiences
    # (Session 6: Memory Architectures)
    # ─────────────────────────────────────────────────
    
    memory_query = build_memory_query(prices, active_events, agent)
    # e.g. "What do I remember about MEDI scandals and past rumors?"
    
    relevant_memories = memory_store.query(
        query_texts=[memory_query],
        n_results=10,
        where={"importance": {"$gte": 3}}  # only important memories
    )["documents"][0]
    # Returns: ["Round 5: NOVA rumor turned out false, lost $500", ...]
    
    
    # ─────────────────────────────────────────────────
    # STEP 3: ANALYZE — Feed everything to Gemini
    # (Session 2: Context Engineering / Prompt Design)
    # ─────────────────────────────────────────────────
    
    system_prompt = build_system_prompt(agent)
    # Uses agent.personality, agent.strategy, agent.risk_level, agent.favorite_sectors
    # e.g. "You are Alice, a paranoid day-trader who trusts nobody.
    #        Your strategy: buy undervalued stocks, sell at 15% profit.
    #        Risk appetite: 4/5 (aggressive). Focus sectors: NOVA, MEDI."
    
    analysis_prompt = build_analysis_prompt(
        prices=prices,
        price_changes=price_changes,
        portfolio=agent.portfolio,
        active_events=active_events,
        chat_log=chat_log[-5:],          # last 5 chat messages
        knowledge=relevant_knowledge,     # from RAG
        memories=relevant_memories,       # from memory
        round_num=round_num,
    )
    # This is pure context engineering — structured prompt with:
    # - Current market state (prices, changes)
    # - Agent's portfolio (cash, holdings)
    # - Active news events
    # - Retrieved knowledge (RAG results)
    # - Relevant memories (personal history)
    # - Recent chat messages
    # - Clear instruction: "Analyze the market and reason step-by-step"
    
    analysis = await gemini_call(
        system=system_prompt,
        prompt=analysis_prompt,
        model="gemini-2.0-flash"
    )
    
    
    # ─────────────────────────────────────────────────
    # STEP 4: DECIDE — Pick an action (structured output)
    # (Session 4: Tools & Function Calling)
    # ─────────────────────────────────────────────────
    
    available_actions = compute_available_actions(agent.portfolio, prices)
    # e.g. [{"action": "BUY", "ticker": "NOVA", "max_shares": 64},
    #        {"action": "SELL", "ticker": "MEDI", "max_shares": 10},
    #        {"action": "HOLD"},
    #        {"action": "CHAT", "max_length": 100}]
    
    decision_prompt = build_decision_prompt(
        analysis=analysis,
        available_actions=available_actions,
    )
    # Asks Gemini to pick ONE action and return as JSON:
    # {"action": "BUY", "ticker": "NOVA", "amount": 5, "reasoning": "..."}
    
    raw_decision = await gemini_call(
        system=system_prompt,
        prompt=decision_prompt,
        model="gemini-2.0-flash"
    )
    
    trade = parse_decision(raw_decision, available_actions)
    # Parses JSON from LLM response, validates against available actions
    # If parsing fails → default to HOLD with "Parse error" reasoning
    
    
    # ─────────────────────────────────────────────────
    # STEP 5: REMEMBER — Store this round's events
    # (Session 6: Memory Architectures)
    # ─────────────────────────────────────────────────
    
    new_memories = build_round_memories(
        prices, price_changes, active_events, trade, round_num
    )
    # Creates memory entries like:
    # - "Round 12: MEDI dropped 12% after CEO scandal" (importance: 8)
    # - "Round 12: I bought 5 NOVA at $155 based on recovery analysis" (importance: 6)
    # - "Round 12: Chat from Oracle: 'storm brews in pharma'" (importance: 4)
    
    for mem in new_memories:
        memory_store.add(
            documents=[mem["text"]],
            metadatas=[{
                "round": round_num,
                "importance": mem["importance"],
                "type": mem["type"],
            }],
            ids=[f"mem_{agent.name}_{round_num}_{hash(mem['text']) % 10000}"]
        )
    
    
    # ─────────────────────────────────────────────────
    # STEP 6: COMPRESS — If memory is getting too big
    # (Session 5: Compress & Isolate)
    # ─────────────────────────────────────────────────
    
    memory_count = memory_store.count()
    if memory_count > 50:  # threshold
        await compress_memories(agent, memory_store, gemini_client)
        # Strategy: summarize old low-importance memories into a single doc
        # Delete individual old memories, keep the summary
        # Result: agent still "knows" what happened but in fewer tokens
    
    
    return trade
```

## `server/memory.py` — Memory Management

```python
# Per-agent ChromaDB collection management

def create_agent_memory(agent_name: str) -> Collection:
    """Create a new ChromaDB collection for an agent's memories."""
    # Collection name: f"agent_{agent_name.lower()}_memories"
    # Uses Gemini embeddings for semantic search

def store_memory(collection, text, importance, event_type, round_num):
    """Store a single memory with metadata."""

def retrieve_memories(collection, query, n=10, min_importance=3):
    """Retrieve relevant memories using semantic search + importance filter."""

async def compress_memories(agent, collection, gemini_client):
    """
    Compress memories when count exceeds threshold.
    
    Strategy (instructor explains this):
    1. Get all memories, sorted by round
    2. Split into "old" (> 10 rounds ago) and "recent"
    3. Group old memories by type (price_change, news, trade, chat)
    4. For each group: ask Gemini to summarize into one concise memory
    5. Delete individual old memories, store summaries
    6. Keep all recent memories intact
    
    This demonstrates hierarchical compression from Session 5.
    """

def score_importance(event: str, event_type: str, magnitude: float) -> int:
    """
    Score memory importance 1-10.
    
    Rules:
    - Price change > 10% → importance 8-10
    - Price change 5-10% → importance 5-7
    - Price change < 5% → importance 2-4
    - Scandal/panic events → importance 8+
    - Own trade result → importance 6
    - Chat message → importance 3-5
    - Routine market movement → importance 1-2
    """
```

## Prompt Templates (instructor walks through these)

### System Prompt Template
```
You are {agent.name}, a stock trader in a simulated market.

PERSONALITY: {agent.personality}

TRADING STRATEGY: {agent.strategy}

RISK APPETITE: {agent.risk_level}/5 (1=very cautious, 5=reckless)

FOCUS SECTORS: {agent.favorite_sectors}

You make one trading decision per round. Think carefully about your
personality and strategy when analyzing the market. Stay in character.
```

### Analysis Prompt Template
```
=== ROUND {round_num} MARKET BRIEFING ===

CURRENT PRICES:
{for each company: "TICKER: $XX.XX (▲/▼ X.XX%)" }

YOUR PORTFOLIO:
Cash: ${cash}
Holdings: {for each holding: "TICKER: X shares (worth $XXX)"}
Total Value: ${total}

BREAKING NEWS:
{for each active event: "- [CATEGORY] headline (severity X/5)"}

MARKET INTELLIGENCE (from research):
{for each knowledge chunk: "- chunk text"}

YOUR MEMORIES:
{for each memory: "- [Round N] memory text (importance: X/10)"}

RECENT CHAT:
{for each chat: "- AgentName: message"}

Based on your personality and strategy, analyze the current market situation.
Think step-by-step:
1. What's happening in the market right now?
2. How do the news events affect your holdings and target sectors?
3. Do your memories suggest any patterns or warnings?
4. What does the research say about situations like this?
5. Given your risk appetite, what should you do?
```

### Decision Prompt Template
```
Based on your analysis:
{analysis_text}

Choose ONE action from these options:
{JSON list of available_actions}

Respond with ONLY a JSON object:
{
  "action": "BUY" | "SELL" | "HOLD" | "CHAT",
  "ticker": "NOVA",      // required for BUY/SELL
  "amount": 5,           // required for BUY/SELL
  "message": "...",      // required for CHAT
  "reasoning": "..."     // always required — this shows on the dashboard!
}
```

## Helper Functions

```python
def build_knowledge_query(prices, price_changes, events) -> str:
    """Turn current market state into a natural language query for RAG."""
    # e.g. "pharma stock MEDI dropping 12% after CEO scandal,
    #        defense stock IRON rising, what are historical patterns?"

def build_memory_query(prices, events, agent) -> str:
    """Build a query to find relevant personal memories."""
    # e.g. "past experiences with pharma scandals, previous false rumors,
    #        my trades in NOVA and MEDI"

def compute_available_actions(portfolio, prices) -> list[dict]:
    """What can the agent actually do given their portfolio?"""
    # Can buy X shares of each stock (cash / price)
    # Can sell up to N shares of each held stock
    # Can always HOLD
    # Can send 1 chat message

def parse_decision(raw_llm_output: str, available_actions) -> Trade:
    """Parse LLM JSON output into a validated Trade."""
    # Try JSON parse
    # Validate action is in available_actions
    # Validate amount doesn't exceed max
    # Fallback: HOLD with "Parse error" reasoning

def build_round_memories(prices, changes, events, trade, round_num) -> list[dict]:
    """Create memory entries from this round's events."""
    # Significant price moves → memory
    # Active events → memory
    # Own trade → memory
    # Chat messages → memory (lower importance)
    # Skip boring stuff (< 2% moves, no events)
```

## Performance: Running 40 Agent Brains per Round

Each agent brain makes 2 Gemini calls (analysis + decision). With 40 agents = 80 calls per round.

**Strategy:**
```python
async def run_all_agent_brains(agents, ...):
    # Process in batches of 8 to respect rate limits
    results = {}
    for batch in chunks(agents, 8):
        batch_results = await asyncio.gather(*[
            run_agent_brain(agent, ...) for agent in batch
        ])
        results.update(zip(batch, batch_results))
        # Brief pause between batches if needed
        await asyncio.sleep(0.5)
    return results
```

With Gemini Flash paid tier (1000 RPM): 80 calls should complete in ~8-10 seconds total. Round interval of 30 seconds gives plenty of headroom.

## Teaching Annotations
The code should have section comments that map to course sessions:
```python
# ══════════════════════════════════════════════
# SESSION 3: RAG — Retrieval Augmented Generation
# This is the "Select" in WSCI (Write, Select, Compress, Isolate)
# ══════════════════════════════════════════════
```

This way when the instructor walks through the code, every section has a clear label connecting it back to what students already learned.
