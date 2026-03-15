# Market Panic — Complete Technical Deep Dive

Everything about how this system works, from the math behind stock prices to the exact prompts sent to the LLM, to how memories are stored, retrieved, and compressed.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [The Six Companies & Price Engine](#2-the-six-companies--price-engine)
3. [The Event System](#3-the-event-system)
4. [The Knowledge Base (RAG)](#4-the-knowledge-base-rag)
5. [The Agent Brain — The 6-Step Loop](#5-the-agent-brain--the-6-step-loop)
6. [Step 1: RAG Retrieval](#6-step-1-rag-retrieval)
7. [Step 2: Memory Recall](#7-step-2-memory-recall)
8. [Step 3: Market Analysis (The System Prompt + Analysis Prompt)](#8-step-3-market-analysis)
9. [Step 4: Action Decision (Structured Output)](#9-step-4-action-decision)
10. [Step 5: Memory Storage](#10-step-5-memory-storage)
11. [Step 6: Memory Compression](#11-step-6-memory-compression)
12. [The Memory System In Detail](#12-the-memory-system-in-detail)
13. [The Orchestrator (Game Loop)](#13-the-orchestrator-game-loop)
14. [Batch Execution & Rate Limiting](#14-batch-execution--rate-limiting)
15. [WebSocket Protocol](#15-websocket-protocol)
16. [REST API](#16-rest-api)
17. [Frontend Architecture](#17-frontend-architecture)
18. [Gemini Client & Models](#18-gemini-client--models)
19. [Error Handling & Fallbacks](#19-error-handling--fallbacks)
20. [File Reference](#20-file-reference)

---

## 1. System Overview

Market Panic is a **single-server application** where one FastAPI process does everything:

```
Student Browser (/join)          Instructor Browser (/control)
        │                                │
        │ POST /api/agents/create        │ WebSocket /ws/instructor
        ▼                                ▼
┌─────────────────────────────────────────────┐
│              FastAPI Server                 │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Market   │  │ Event    │  │ Knowledge │  │
│  │ Engine   │  │ Engine   │  │ Base      │  │
│  │ (GBM)    │  │          │  │ (ChromaDB)│  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │        │
│       ▼              ▼              ▼        │
│  ┌──────────────────────────────────────┐   │
│  │         ORCHESTRATOR                  │   │
│  │  For each round:                      │   │
│  │    1. Tick prices (GBM)               │   │
│  │    2. Apply events                    │   │
│  │    3. Run ALL agent brains (Gemini)   │   │
│  │    4. Execute trades                  │   │
│  │    5. Compute rankings                │   │
│  │    6. Broadcast via WebSocket         │   │
│  └──────────────────────────────────────┘   │
│       │                                      │
│       ▼                                      │
│  ┌──────────────────────────────────────┐   │
│  │    AGENT BRAIN (per agent, per round) │   │
│  │    1. RAG retrieval (knowledge base)  │   │
│  │    2. Memory recall (personal history)│   │
│  │    3. Analyze market (Gemini call #1)  │   │
│  │    4. Decide action (Gemini call #2)   │   │
│  │    5. Store memories                  │   │
│  │    6. Compress if needed              │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  WebSocket /ws/dashboard ───────────────────┤
└─────────────────────────────────────────────┘
        │
        ▼
Dashboard Browsers (everyone watches)
```

**Key insight**: Students don't write code. They fill a form with personality text and strategy text. The server takes those words and injects them into the LLM's system prompt. Different words = different agent behavior. **This is context engineering.**

---

## 2. The Six Companies & Price Engine

### Companies

| Ticker | Name | Sector | Starting Price | Volatility (σ) | Personality |
|--------|------|--------|---------------|-----------------|-------------|
| NOVA | TechNova | AI/Tech | $150.00 | 0.03 (high) | Hype-driven, momentum, AI news sensitive |
| GRNE | GreenPulse | Clean Energy | $85.00 | 0.02 (medium) | Policy-sensitive, steady, regulation driven |
| MEDI | MediCorp | Pharma | $200.00 | 0.025 (medium-high) | Scandal-prone, patent cliffs, big upside |
| FOOD | FoodCo | Agriculture | $45.00 | 0.012 (low) | Safe haven, boring, great in downturns |
| LUXE | LuxeGlobal | Luxury | $310.00 | 0.035 (highest) | Sentiment-driven, celebrity-linked, volatile |
| IRON | IronShield | Defense | $120.00 | 0.015 (low-medium) | Geopolitics play, inverse market correlation |

### Geometric Brownian Motion (GBM)

Every round, each stock price is updated using the GBM formula:

```
S(t+1) = S(t) × exp((μ - 0.5σ²)Δt + σ√(Δt) × Z)
```

Where:
- `S(t)` = current price
- `μ` = 0.001 (drift — slight upward bias, like real markets)
- `σ` = volatility per company (see table above)
- `Δt` = 1/252 (one trading day)
- `Z` = random number drawn from standard normal distribution

**In plain English**: Each round, the price randomly moves up or down. Higher σ = bigger swings. LUXE (σ=0.035) swings roughly 3x more than FOOD (σ=0.012) per round.

### Event Impact (Multiplicative with Decay)

After GBM, active events modify prices:

```python
for event in active_events_for_ticker:
    decay = max(0, 1 - (current_round - event.round_injected) / event.duration_rounds)
    new_price *= (1 + event.impact × decay)
```

Example: A severity-4 scandal on MEDI (impact = -0.12):
- Round 0 (just injected): price × (1 + (-0.12) × 1.0) = price × 0.88 → **-12% drop**
- Round 1: price × (1 + (-0.12) × 0.67) = price × 0.92 → **-8% effect**
- Round 2: price × (1 + (-0.12) × 0.33) = price × 0.96 → **-4% effect**
- Round 3: event expired, no more impact

### Order Pressure

After trades execute, buy/sell volume shifts prices slightly:

```python
net_pressure = (buy_volume - sell_volume) / total_volume
new_price *= (1 + net_pressure × 0.02)
```

If 30 agents buy NOVA and 5 sell, that's net positive pressure → NOVA drifts up ~2%. This creates feedback loops where popular stocks get more popular (momentum).

### Price Floor

Prices can never go below $1.00. This prevents negative prices from extreme events.

### Trade Execution

- **Market orders only** — no limit orders, no shorts
- Each agent starts with **$10,000 cash**
- BUY: `cost = price × shares`, deducted from cash
- SELL: `revenue = price × shares`, added to cash
- If agent can't afford the requested amount, it buys the max affordable
- Portfolio value = cash + sum(shares × current_price) for all holdings

---

## 3. The Event System

### Event Structure

```python
class MarketEvent:
    id: str                    # unique identifier
    headline: str              # "BREAKING: MediCorp CEO resigns amid scandal"
    category: str              # earnings, scandal, rumor, regulation, partnership, panic, recovery
    affected_tickers: list     # ["MEDI"] or ["ALL"] for market-wide
    severity: int              # 1-5
    is_true: bool              # false = rumor (may be false information)
    duration_rounds: int       # how many rounds the effect lasts (default 3)
    round_injected: int        # which round it was injected
```

### Severity → Price Impact Mapping

| Severity | Impact Magnitude | Example |
|----------|-----------------|---------|
| 1 | ±2% | Minor news, small price move |
| 2 | ±5% | Notable news, moderate impact |
| 3 | ±8% | Significant event, big move |
| 4 | ±12% | Major event, very large swing |
| 5 | ±18% | Crisis-level, extreme volatility |

The sign (+ or -) depends on category:
- **Negative**: scandal, panic, adverse_regulation → negative impact
- **Positive**: earnings, partnership, recovery, regulation → positive impact
- **Rumor**: same magnitude, but `is_true=false` — the information might be wrong

### Pre-Built Scenarios

Six scenarios in `scenarios.yaml`, each a sequence of timed events:

1. **Flash Crash**: Algo glitch → circuit breakers → Fed statement → recovery
2. **Earnings Season**: Mixed results across companies over 4 rounds
3. **The Big Lie**: Fake merger rumor → confirmation → CEO denial crash
4. **Sector Rotation**: Money flows from tech to defense/energy
5. **Bull Run**: Rate cut → consumer confidence → broad rally
6. **Insider Tip**: Unusual activity → pharma breakthrough → sector rally

Each event has a `round_offset` — when the instructor loads "The Big Lie" at round 10:
- Round 10: "RUMOR: TechNova merger talks with MediCorp"
- Round 11: "Anonymous sources confirm merger imminent"
- Round 13: "BREAKING: CEO denies — no talks underway" (crash)

---

## 4. The Knowledge Base (RAG)

### What It Is

A ChromaDB vector database loaded at server startup with **50 documents** about the simulated market. This is the "shared world knowledge" that every agent can query.

### Document Categories

| Category | Count | Examples |
|----------|-------|---------|
| Company Profiles | 6 | "TechNova (NOVA) is an AI/Tech company trading around $150. It is highly sensitive to AI hype cycles..." |
| Sector Analyses | 6 | "Pharma is a high-risk, high-reward sector. Drug approvals can double stock prices overnight..." |
| Historical Patterns | 12 | "When a company faces a scandal, the stock typically drops 10-15% in the first round, then partially recovers..." |
| Trading Strategies | 10 | "Strategy: Buy the Dip — When a fundamentally strong stock drops 8%+..." |
| Cross-Company Relationships | 8 | "IRON vs Market — IronShield consistently moves inversely to broad market sentiment..." |
| Red Herrings | 8 | "Market folklore: Some traders believe stock performance correlates with lunar cycles..." |

### How Embedding Works

Every document is embedded using **Gemini `gemini-embedding-001`** (3072-dimensional vectors). When an agent needs knowledge:

1. The current market state is converted to a natural language query
2. That query is embedded into a 3072-dim vector
3. ChromaDB finds the 5 most similar documents by cosine similarity
4. Those documents are injected into the agent's prompt

### Fallback

If Gemini embedding fails (rate limit, network error), the system falls back to **keyword matching** — it counts how many query words appear in each document and returns the highest-scoring ones. Less accurate but always works.

---

## 5. The Agent Brain — The 6-Step Loop

This is the core of the entire system. Every round, for every agent, the server runs this loop:

```
┌─────────────────────────────────────────────────────┐
│              AGENT BRAIN (per agent, per round)      │
│                                                      │
│  ┌──────────────┐     ┌──────────────┐              │
│  │ Knowledge    │     │ Agent        │              │
│  │ Base (shared)│     │ Memory       │              │
│  │ 50 docs      │     │ (personal)   │              │
│  └──────┬───────┘     └──────┬───────┘              │
│         │                    │                       │
│    Step 1: RAG          Step 2: Recall               │
│    retrieve 5 docs      retrieve 10 memories         │
│         │                    │                       │
│         ▼                    ▼                       │
│  ┌──────────────────────────────────────────┐       │
│  │ Step 3: ANALYZE (Gemini Call #1)          │       │
│  │                                           │       │
│  │ System Prompt: agent personality/strategy  │       │
│  │ User Prompt: prices + portfolio + events   │       │
│  │            + knowledge + memories + chat   │       │
│  │                                           │       │
│  │ → Returns: market analysis text            │       │
│  └────────────────┬─────────────────────────┘       │
│                   │                                  │
│                   ▼                                  │
│  ┌──────────────────────────────────────────┐       │
│  │ Step 4: DECIDE (Gemini Call #2)           │       │
│  │                                           │       │
│  │ Input: analysis + available actions        │       │
│  │ Output: JSON { action, ticker, amount,     │       │
│  │                reasoning }                 │       │
│  │                                           │       │
│  │ → Returns: Trade object                    │       │
│  └────────────────┬─────────────────────────┘       │
│                   │                                  │
│              Step 5: STORE                           │
│              Save this round to memory               │
│                   │                                  │
│              Step 6: COMPRESS (if >50 memories)      │
│              Summarize old memories                   │
│                                                      │
│  Output: Trade (BUY/SELL/HOLD/CHAT)                  │
└─────────────────────────────────────────────────────┘
```

---

## 6. Step 1: RAG Retrieval

**File**: `server/agent_brain.py` → `retrieve_knowledge()`

### What Happens

The system looks at the current market state and builds a natural language search query:

```python
# If MEDI dropped 12% and there's a scandal event:
query = "Pharma stock MEDI dropping 12.0%, scandal: MediCorp CEO resigns amid scandal"

# If nothing interesting is happening:
query = "current market conditions, trading strategies, sector analysis"
```

### How the Query is Built

1. **Big movers** (>3% change): "AI/Tech stock NOVA rising 5.2%"
2. **Active events**: "scandal: MediCorp CEO resigns"
3. **Default**: "current market conditions" (if nothing notable)

### What Comes Back

ChromaDB returns the 5 most relevant documents. For the MEDI scandal query, you'd get:
- "When a company faces a scandal, the stock typically drops 10-15%..."
- "Pharma is a high-risk, high-reward sector..."
- "MEDI and FOOD — In healthcare scares, both can move..."
- "Strategy: Buy the Dip — When a fundamentally strong stock drops 8%+..."
- "MediCorp (MEDI) is a pharmaceutical company..."

These 5 text chunks go into Step 3's prompt as "MARKET INTELLIGENCE."

---

## 7. Step 2: Memory Recall

**File**: `server/agent_brain.py` → `recall_memories()`

### What Happens

Each agent has their own ChromaDB collection of personal memories. The system builds a query from:

1. **Current events + affected tickers**: "past experiences with MEDI scandal"
2. **Current holdings**: "my trades in NOVA, NOVA price movements"
3. **Favorite sectors**: "memories about AI/Tech"

### What Comes Back

Up to 10 memories with importance ≥ 3, sorted by relevance:
```
- [Round 5] MEDI dropped 8.2% after a rumor (RUMOR - may be false!) — importance 6
- [Round 7] I bought 10 MEDI at $185.50. Reasoning: scandal overblown — importance 6
- [Round 8] MediCorp (MEDI) rose 4.1% to $193.20 — importance 5
```

These go into Step 3's prompt as "YOUR MEMORIES."

---

## 8. Step 3: Market Analysis

**File**: `server/agent_brain.py` → `analyze_market()`

This is where context engineering happens. Two prompts are sent to Gemini.

### The System Prompt (WHO the agent is)

This is built from the student's form submission. The exact text they typed becomes the agent's identity:

```
You are CRUSADER, a stock trader in a simulated market.

PERSONALITY: A paranoid day-trader who trusts nobody and always hedges.
Never puts more than 30% in one stock. Sells at the first sign of trouble.

TRADING STRATEGY: Buy undervalued stocks after scandals when everyone
is panic selling. Sell at 15% profit, never hold through bad news.
Cut losses at -8%.

RISK APPETITE: 4/5 (1=very cautious, 5=reckless)

FOCUS SECTORS: NOVA, MEDI

You make one trading decision per round. Think carefully about your
personality and strategy when analyzing the market. Stay in character.
```

### The Analysis Prompt (WHAT the agent sees)

Everything the agent knows gets assembled into one structured prompt:

```
=== ROUND 12 MARKET BRIEFING ===

CURRENT PRICES:
  NOVA: $138.46 (▼ 2.15%)
  GRNE: $86.02 (▲ 0.31%)
  MEDI: $149.68 (▼ 8.42%)
  FOOD: $43.85 (▲ 0.12%)
  LUXE: $301.29 (▼ 1.05%)
  IRON: $123.48 (▲ 1.85%)

YOUR PORTFOLIO:
  Cash: $4,250.00
  Holdings:
  NOVA: 20 shares (worth $2,769.20)
  MEDI: 15 shares (worth $2,245.20)
  Total Value: $9,264.40

BREAKING NEWS:
  - [SCANDAL] MediCorp CEO resigns amid fraud investigation (severity 4/5)
  - [PARTNERSHIP] IronShield wins NATO contract (severity 3/5)

MARKET INTELLIGENCE (from research):
  - When a company faces a scandal, the stock typically drops 10-15%
    in the first round, then partially recovers over 3-5 rounds...
  - Pharma is a high-risk, high-reward sector...
  - MEDI and FOOD — In healthcare scares, both can move...
  - Strategy: Buy the Dip — When a fundamentally strong stock drops 8%+...
  - MediCorp (MEDI) is a pharmaceutical company trading around $200...

YOUR MEMORIES:
  - [Round 5] MEDI dropped 8.2% after a rumor (importance: 6/10)
  - [Round 7] I bought 10 MEDI at $185.50 (importance: 6/10)
  - [Round 10] NOVA rose 3.5% on AI chip news (importance: 5/10)

RECENT CHAT:
  - Oracle: "The pharma storm hasn't peaked yet"
  - Alice: "Defense is the play right now"

Based on your personality and strategy, analyze the current market situation.
Think step-by-step:
1. What's happening in the market right now?
2. How do the news events affect your holdings and target sectors?
3. Do your memories suggest any patterns or warnings?
4. What does the research say about situations like this?
5. Given your risk appetite, what should you do?
```

### What Gemini Returns

A free-form analysis text (typically 200-400 words):

```
Looking at the current situation, MEDI just dropped 8.42% on the CEO scandal.
This is significant — severity 4/5.

From my memories, I've seen MEDI drop before on rumors (Round 5), and the
knowledge base says scandals typically cause 10-15% drops before recovery.
MEDI is already down from $200 to $149, that's a 25% decline. But this is
a real scandal, not a rumor.

My strategy says cut losses at -8%. MEDI is already past that threshold.
I need to sell my MEDI position to limit damage.

NOVA is also down 2.15% — could be contagion from broad market sentiment.
The knowledge base says tech and pharma can correlate on AI drug discovery
narrative. My NOVA position is still within tolerance.

IRON is up 1.85% on the NATO contract — the knowledge base confirms defense
stocks move inversely to market panic. But my strategy focuses on NOVA and
MEDI, not defense.

Decision: Sell MEDI to cut losses, hold NOVA, consider buying the dip later
if MEDI stabilizes.
```

---

## 9. Step 4: Action Decision

**File**: `server/agent_brain.py` → `decide_action()`

### Available Actions Computation

Before asking Gemini to decide, the system calculates what the agent CAN actually do:

```json
[
  {"action": "BUY", "ticker": "NOVA", "max_shares": 30, "price": 138.46},
  {"action": "BUY", "ticker": "GRNE", "max_shares": 49, "price": 86.02},
  {"action": "BUY", "ticker": "FOOD", "max_shares": 96, "price": 43.85},
  {"action": "BUY", "ticker": "IRON", "max_shares": 34, "price": 123.48},
  {"action": "SELL", "ticker": "NOVA", "max_shares": 20, "current_value": 2769.20},
  {"action": "SELL", "ticker": "MEDI", "max_shares": 15, "current_value": 2245.20},
  {"action": "HOLD"},
  {"action": "CHAT", "max_length": 100}
]
```

Note: can't buy MEDI or LUXE — not enough cash ($4,250) for LUXE ($301) and MEDI is already held.

### The Decision Prompt

```
You are CRUSADER. Risk appetite: 4/5.
You must choose ONE action and respond with ONLY valid JSON.

Based on your analysis:
[the full analysis text from Step 3]

Choose ONE action from these options:
[the available actions JSON above]

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "action": "BUY" | "SELL" | "HOLD" | "CHAT",
  "ticker": "NOVA",
  "amount": 5,
  "message": "...",
  "reasoning": "..."
}

Rules:
- For BUY: include ticker and amount (must not exceed max_shares shown above)
- For SELL: include ticker and amount (must not exceed your holdings)
- For HOLD: just include reasoning
- For CHAT: include a short message and reasoning
- reasoning is ALWAYS required — it shows on the dashboard!
```

### What Gemini Returns

Raw JSON:
```json
{
  "action": "SELL",
  "ticker": "MEDI",
  "amount": 15,
  "reasoning": "Cutting losses on MEDI — CEO scandal is severity 4, my strategy says exit at -8% and MEDI is down 25% from start. Selling all 15 shares to preserve capital for a potential buy-the-dip opportunity later."
}
```

### Parsing & Validation

The `parse_decision()` function:
1. Strips any markdown code blocks (```json ... ```) that Gemini might add
2. Parses JSON
3. Validates the action is one of BUY/SELL/HOLD/CHAT
4. For BUY: checks the ticker exists and amount ≤ max_shares
5. For SELL: checks the agent holds that ticker and amount ≤ held shares
6. If anything fails → defaults to HOLD with "Parse error" reasoning

---

## 10. Step 5: Memory Storage

**File**: `server/agent_brain.py` → `store_round_memories()` + `build_round_memories()`

### What Gets Stored

After each round, the system creates memory entries from significant events:

**1. Significant price moves (>3% change)**:
```
"Round 12: MediCorp (MEDI) dropped 8.4% to $149.68"
→ importance: 5 (5-10% range), type: "price_change"
```

**2. New events (only when first seen)**:
```
"Round 12: [SCANDAL] MediCorp CEO resigns amid fraud investigation (severity 4/5, confirmed true)"
→ importance: 9 (severity 4 × 3 = 12, mapped to 9), type: "news"
```

**3. Own trades**:
```
"Round 12: I sold 15 MEDI at $149.68. Reasoning: Cutting losses..."
→ importance: 6 (fixed for trades), type: "trade"
```

**4. Chat messages**:
```
"Round 12: I said: 'MEDI is toast, get out now'"
→ importance: 4 (fixed for chat), type: "chat"
```

### What Does NOT Get Stored

- Price moves < 3% (noise)
- Events already seen in previous rounds (no duplicates)
- HOLD actions (nothing interesting happened)

### Importance Scoring Rules

```
Event Type         | Magnitude      | Importance Score
-------------------|----------------|------------------
scandal/panic/crash| any            | 8-10
news               | >10% move      | 9
news               | 5-10% move     | 6
news               | <5% move       | 3
price_change       | >10%           | 8
price_change       | 5-10%          | 5
price_change       | <5%            | 2
trade              | any            | 6
chat               | any            | 4
```

Higher importance = more likely to be retrieved in future rounds (Step 2 filters for importance ≥ 3).

---

## 11. Step 6: Memory Compression

**File**: `server/memory.py` → `AgentMemory.compress()`

### When It Triggers

After Step 5 stores new memories, the system checks: `if memory.count() > 50: compress()`

### The Compression Algorithm

1. **Get all memories**, sorted by round
2. **Split into "old" (>10 rounds ago) and "recent"**
3. **Group old memories by type** (price_change, news, trade, chat)
4. **For each group with 3+ memories**: ask Gemini to summarize
5. **Delete the individual old memories**, keep the summary
6. **Keep all recent memories intact**

### The Compression Prompt

Sent to Gemini for each group:
```
Summarize these trading memories into 2-3 concise sentences
that capture the key patterns and lessons:

- [Round 1] TechNova (NOVA) rose 3.5% to $155.25
- [Round 3] MediCorp (MEDI) dropped 5.2% to $189.60
- [Round 5] MediCorp (MEDI) dropped 8.2% to $183.50
- [Round 7] TechNova (NOVA) rose 4.1% to $162.30
- [Round 8] MediCorp (MEDI) rose 4.1% to $193.20
```

### What Gemini Returns

```
"NOVA showed consistent upward momentum with gains in Rounds 1 and 7.
MEDI experienced significant volatility with sharp drops in Rounds 3
and 5 followed by a recovery in Round 8, suggesting mean-reversion
behavior after sell-offs."
```

### The Stored Compressed Memory

```
text: "[COMPRESSED SUMMARY] NOVA showed consistent upward momentum..."
round: 8 (last round of the group)
importance: 8 (max importance from the original memories)
type: "compressed_price_change"
```

### Why Compression Matters

Without compression:
- Round 30 agent has 90+ individual memories
- Each memory recall query returns noisy, granular entries
- The prompt gets bloated with low-value detail

With compression:
- Old rounds are summarized into key patterns
- Recent rounds keep full detail
- Prompt stays focused and relevant
- **This is hierarchical memory** — recent = detailed, old = summarized

---

## 12. The Memory System In Detail

### Architecture

Each agent gets their own ChromaDB collection:
```
ChromaDB (in-memory)
├── market_knowledge          ← shared, 50 docs, read-only
├── agent_crusader_memories   ← CRUSADER's personal memories
├── agent_naman_memories      ← NAMAN's personal memories
├── agent_sreedath_memories   ← Sreedath's personal memories
└── ...
```

### Embedding Model

All collections use **Gemini `gemini-embedding-001`** (3072-dimensional vectors) via a custom ChromaDB embedding function. Every time a memory is stored or queried, the text is embedded by calling the Gemini API.

### Store Operation

```python
memory.store(
    text="Round 12: I sold 15 MEDI at $149.68",
    round_num=12,
    importance=6,
    event_type="trade"
)
```

This:
1. Generates an ID: `mem_CRUSADER_12_a3f8b2c1` (agent + round + hash)
2. Embeds the text via Gemini → 3072-dim vector
3. Stores in ChromaDB with metadata: `{round: 12, importance: 6, type: "trade"}`

### Retrieve Operation

```python
memories = memory.retrieve(
    query="past experiences with MEDI scandal",
    n_results=10,
    min_importance=3
)
```

This:
1. Embeds the query via Gemini
2. Finds the 10 most similar memories by cosine similarity
3. Filters to importance ≥ 3
4. Returns list of `{text, round, importance, type}`

### Why Semantic Search Matters

Traditional keyword search for "MEDI scandal" would only find memories containing those exact words. Semantic search finds memories like:
- "Round 5: I bought MEDI after the CEO rumor turned out false" (no word "scandal" but semantically related)
- "Round 10: Pharma sector rally lifted MEDI 5%" (related to MEDI context)

The embeddings capture meaning, not just keywords.

---

## 13. The Orchestrator (Game Loop)

**File**: `server/orchestrator.py`

### Game State Machine

```
WAITING → RUNNING → PAUSED → RUNNING → FINISHED
                                    ↑
                                    └── or → FINISHED (end early)
```

### One Round Execution

```python
async def _run_round(round_num):
    # 1. Broadcast round transition
    broadcast({"type": "round_transition", "from": round_num-1, "to": round_num})

    # 2. Tick prices (GBM + event impacts)
    active_events = events.get_active(round_num)
    new_prices = market.tick(active_events, round_num)
    price_changes = market.get_price_changes()

    # 3. Broadcast any new events
    for event in active_events:
        if event.round_injected == round_num:
            broadcast({"type": "news_event", ...})

    # 4. Run ALL agent brains (batched Gemini calls)
    decisions = await run_all_agent_brains(agents, prices, ...)

    # 5. Execute trades (update portfolios)
    for agent in agents:
        trade = decisions[agent.name]
        if trade.action in ("BUY", "SELL"):
            execute_trade(agent, trade, prices)

    # 6. Apply order pressure (buy/sell volume shifts prices)
    market.apply_order_pressure(round_trades)

    # 7. Compute rankings (sort by portfolio value)
    rankings = get_rankings(agents, prices)

    # 8. Broadcast everything to dashboard
    broadcast({"type": "market_update", prices, rankings, ...})
    for trade in round_trades:
        broadcast({"type": "trade_executed", ...})
```

### Speed Control

The instructor can change game speed:
- **0.5x**: 60 seconds between rounds
- **1x**: 30 seconds (default)
- **1.5x**: 20 seconds
- **2x**: 15 seconds
- **3x**: 10 seconds

This only affects the pause between rounds — the actual Gemini calls take however long they take.

---

## 14. Batch Execution & Rate Limiting

**File**: `server/agent_brain.py` → `run_all_agent_brains()`

### The Problem

With 40 agents, each making 2 Gemini calls (analysis + decision) = **80 API calls per round**. Gemini has rate limits.

### The Solution: Batched Concurrent Execution

```python
batch_size = 8

for i in range(0, len(agents), batch_size):
    batch = agents[i : i + batch_size]

    # Run 8 agents concurrently
    results = await asyncio.gather(*[
        run_agent_brain(agent, ...) for agent in batch
    ])

    # Brief pause between batches
    await asyncio.sleep(0.5)
```

With 40 agents:
- Batch 1: agents 1-8 (concurrent) → ~15s
- 0.5s pause
- Batch 2: agents 9-16 (concurrent) → ~15s
- 0.5s pause
- Batch 3: agents 17-24 → ...
- Batch 4: agents 25-32 → ...
- Batch 5: agents 33-40 → ...

Total: ~5 batches × 15s + 4 × 0.5s ≈ **77 seconds per round** with Gemini 2.5 Pro.

### Failure Handling

If any agent's brain call fails (timeout, rate limit, parse error):
- That agent defaults to HOLD
- Other agents in the batch are unaffected
- The error is logged
- Dashboard shows the agent's status as "error"

---

## 15. WebSocket Protocol

### Two Connection Types

1. **`/ws/dashboard`** — read-only, receives all broadcasts
2. **`/ws/instructor`** — bidirectional, receives broadcasts AND sends commands (requires password query param)

### Server → Dashboard Messages

```json
{"type": "game_status", "status": "waiting|running|paused|finished"}

{"type": "agent_joined", "name": "Alice", "personality": "...", "strategy": "..."}

{"type": "market_update", "round": 12, "prices": {...}, "price_changes": {...},
 "price_history": {...}, "rankings": [...], "active_events": [...]}

{"type": "trade_executed", "agent": "Alice", "action": "BUY", "ticker": "NOVA",
 "amount": 5, "price": 138.46, "reasoning": "..."}

{"type": "news_event", "headline": "...", "category": "scandal", "severity": 4}

{"type": "round_transition", "from": 11, "to": 12}

{"type": "agent_inspection", "name": "Alice", "memories": [...],
 "decisions": [...], "portfolio": {...}}

{"type": "game_over", "final_rankings": [...], "highlights": {...}}
```

### Instructor → Server Messages

```json
{"type": "start_game", "config": {"total_rounds": 30, "round_duration": 30}}
{"type": "pause_game"}
{"type": "resume_game"}
{"type": "end_game"}
{"type": "set_speed", "multiplier": 2}
{"type": "inject_event", "event": {"headline": "...", "category": "scandal", ...}}
{"type": "inject_scenario", "scenario_name": "flash_crash"}
{"type": "remove_agent", "name": "Bob"}
{"type": "inspect_agent", "name": "Alice"}
```

### Reconnection Handling

When a dashboard reconnects (page refresh), the server sends:
1. Current game status
2. All existing agents (agent_joined messages)
3. Full market state with rankings
4. Last 50 trades (activity feed)
5. Last 20 events (news ticker)

This ensures the dashboard fully recovers state after any disconnect.

---

## 16. REST API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents/create` | POST | Create agent from /join form |
| `/api/agents/count` | GET | Number of registered agents |
| `/api/agents` | GET | List all agents with basic info |
| `/api/agents/{name}` | GET | Full agent inspection data |
| `/api/agents/{name}` | DELETE | Remove an agent |
| `/api/market/state` | GET | Current prices, round, status |
| `/api/market/history` | GET | Full price history for charts |
| `/api/events/scenarios` | GET | List available scenarios |
| `/api/knowledge/search?q=...` | GET | Search knowledge base |
| `/api/health` | GET | Health check |

### Agent Creation (POST /api/agents/create)

Request:
```json
{
  "name": "CRUSADER",
  "personality": "A paranoid day-trader who trusts nobody...",
  "strategy": "Buy undervalued stocks after scandals...",
  "risk_level": 4,
  "favorite_sectors": ["NOVA", "MEDI"]
}
```

What happens server-side:
1. Validate name uniqueness
2. Create `AgentState` with $10,000 portfolio
3. Create ChromaDB collection `agent_crusader_memories`
4. Broadcast `agent_joined` to all dashboards
5. Return 201 with `{"name": "CRUSADER", "status": "ready"}`

---

## 17. Frontend Architecture

### Three Pages, One React App

```
/join       → JoinPage → AgentForm component
/dashboard  → DashboardPage → 11 dashboard components
/control    → ControlPage → 6 control components + password gate
```

### State Management

Single `useMarketState` hook using React's `useReducer`:

```javascript
const initialState = {
  gameStatus: 'waiting',
  round: 0,
  prices: {},
  priceHistory: {},
  rankings: [],
  news: [],
  trades: [],
  inspectedAgent: null,
  gameOver: null,
}
```

Every WebSocket message dispatches to the reducer, which updates the relevant state slice.

### WebSocket Hook

`useWebSocket` auto-detects ws:// vs wss:// and reconnects with exponential backoff (1s → 2s → 4s → max 10s).

### Dashboard Components

| Component | Purpose |
|-----------|---------|
| TopBar | Logo, round counter, game status, connection indicator |
| PriceCharts | Chart.js line charts for all 6 tickers |
| Leaderboard | Animated ranking with Framer Motion |
| LeaderboardRow | Individual agent row (click to inspect) |
| NewsTicker | Horizontal scrolling news headlines |
| ActivityFeed | Vertical feed of BUY/SELL trades |
| MarketStats | Agents count, mood, biggest mover, active events |
| AgentInspector | Slide-out panel: portfolio, memories, decisions |
| RoundOverlay | "ROUND 12" full-screen flash between rounds |
| GameOver | Podium, final rankings, highlight awards |
| SoundEngine | Web Audio API synthesized sounds |

---

## 18. Gemini Client & Models

**File**: `server/gemini_client.py`

### Models Used

| Purpose | Model | Why |
|---------|-------|-----|
| Agent brain (analysis + decision) | `gemini-2.5-pro` | Smartest reasoning for trading decisions |
| Embeddings (KB + memory) | `gemini-embedding-001` | 3072-dim vectors, high quality semantic search |
| Memory compression | `gemini-2.5-pro` | Needs good summarization ability |

### Client Architecture

Single shared `genai.Client` instance, initialized lazily on first use:

```python
async def generate(prompt, system=None, model="gemini-2.5-pro"):
    client = get_client()  # singleton
    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config={"system_instruction": system} if system else None,
    )
    return response.text

def embed(texts, model="gemini-embedding-001"):
    client = get_client()
    result = client.models.embed_content(model=model, contents=texts)
    return [e.values for e in result.embeddings]
```

### API Call Count Per Round (2 agents)

| Operation | Calls | Purpose |
|-----------|-------|---------|
| KB retrieval embedding | 2 | Embed search queries for knowledge base |
| Memory retrieval embedding | 2 | Embed search queries for agent memories |
| Analysis generation | 2 | Gemini 2.5 Pro: analyze market |
| Decision generation | 2 | Gemini 2.5 Pro: pick action |
| Memory storage embedding | 4-8 | Embed new memories being stored |
| **Total per round** | **~12-16** | |

With 40 agents: ~240-320 API calls per round.

---

## 19. Error Handling & Fallbacks

### Gemini Call Fails

- Agent brain catches all exceptions
- Defaults to `HOLD` with reasoning explaining the error
- Agent status set to "error" on dashboard
- Other agents unaffected

### JSON Parse Fails

- `parse_decision()` strips markdown code blocks
- If JSON still invalid → HOLD with "Parse error"
- If action invalid (e.g., "YOLO") → HOLD
- If amount exceeds max → capped to max
- If ticker not held for SELL → HOLD

### ChromaDB Embedding Fails

- `GeminiEmbeddingFunction` returns zero vectors (3072 zeros)
- Knowledge base falls back to keyword search
- Memory retrieval returns empty list (agent proceeds without memories)

### Network Disconnect

- Server keeps running, agents default to HOLD
- Dashboard auto-reconnects with exponential backoff
- On reconnect, full state is re-sent (rankings, trades, events)

### Agent Joins Mid-Game

- Starts with $10,000 cash, no holdings
- Fresh empty memory collection
- Joins next round normally

---

## 20. File Reference

```
server/
├── gemini_client.py      # Shared Gemini client (generate + embed)
├── models.py             # Pydantic models, 6 company definitions
├── market.py             # GBM price engine, trade execution, rankings
├── events.py             # Event engine: inject, decay, scenarios
├── scenarios.yaml        # 6 pre-built event sequences
├── knowledge_base.py     # ChromaDB with 50 documents, Gemini embeddings
├── memory.py             # Per-agent ChromaDB memory, compression
├── agent_brain.py        # THE CORE: 6-step brain loop
├── orchestrator.py       # Game loop, state machine, batch execution
├── main.py               # FastAPI app, WebSocket hub, REST API
└── requirements.txt      # Python dependencies

frontend/
├── src/
│   ├── App.jsx           # React Router (/join, /dashboard, /control)
│   ├── main.jsx          # Entry point
│   ├── styles/global.css # Full design system
│   ├── hooks/
│   │   ├── useWebSocket.js    # Auto-reconnect WebSocket
│   │   └── useMarketState.js  # useReducer state management
│   ├── utils/
│   │   ├── colors.js     # Ticker color palette
│   │   └── formatters.js # Price/number formatting
│   ├── pages/
│   │   ├── JoinPage.jsx
│   │   ├── DashboardPage.jsx
│   │   └── ControlPage.jsx
│   └── components/
│       ├── join/AgentForm.jsx
│       ├── dashboard/ (11 components)
│       └── control/ (6 components)
├── vite.config.js        # Dev proxy to backend
└── package.json
```
