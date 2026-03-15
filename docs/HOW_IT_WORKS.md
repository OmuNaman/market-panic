# Market Panic — How It Works (Student + Instructor Guide)

## The Experience

### What a Student Does

1. **Open the URL** → lands on `/join`
2. **Fill the form** (~2 minutes):
   - **Agent Name**: "CRUSADER", "WolfOfWallSt", etc.
   - **Personality**: Free text describing how your trader thinks. "A paranoid day-trader who trusts nobody and always hedges." This becomes the AI's identity.
   - **Strategy**: Free text describing trading rules. "Buy undervalued stocks after scandals, sell at 15% profit." This shapes every decision.
   - **Risk Level**: Slider 1-5 (Conservative → Reckless)
   - **Sectors**: Pick 1-3 favorites from NOVA/GRNE/MEDI/FOOD/LUXE/IRON
3. **(Optional) Open Token War Room** — configure how much context your agent sees each round:
   - Research docs (1-10): how many knowledge base articles to retrieve
   - Memory slots (3-20): how many past memories to recall
   - Memory importance threshold (1-10): minimum importance to recall a memory
   - Chat messages (0-10): how many recent agent chats to include
   - Market data toggles: price changes, portfolio, news events, full price history, leaderboard
   - **Context Health meter**: shows estimated token usage with green/yellow/red indicator
4. **(Optional) Open Memory Architect** — configure how your agent remembers:
   - **Memory Focus**: Episodic (raw events), Semantic (extracted patterns), or Procedural (if-then rules)
   - **Forgetting Speed**: 1 (Elephant — remembers everything) to 5 (Goldfish — only recent memories matter)
   - **Compression Trigger**: when to auto-summarize old memories (10-100)
   - **Memory Filters**: choose what to remember — price moves, news, trades, chat, portfolio snapshots, HOLD decisions
5. **Click DEPLOY AGENT** → redirected to `/dashboard`
6. **Watch the simulation** — your agent trades autonomously based on everything you configured

### What the Instructor Does

1. **Open `/control`** → enter password ("instructor")
2. **Wait for students** to join (watch agent count increase)
3. **Click START GAME** (configure rounds: 30, duration: 30s)
4. **Watch the dashboard** on a shared screen (Zoom/projector)
5. **Inject drama**:
   - Load pre-built scenarios (Flash Crash, The Big Lie, Sector Rotation, etc.)
   - Create custom events (headline, category, severity, affected tickers, rumor toggle)
   - Adjust speed (0.5x to 3x)
6. **Click agents on leaderboard** → open AgentInspector to show the class:
   - **Portfolio tab**: cash, holdings, total value
   - **Memories tab**: what the agent remembers, with importance scores
   - **Decisions tab**: every BUY/SELL/HOLD with reasoning text
   - **Config tab**: Token War Room + Memory Architect settings
7. **Teaching moment**: "Look — this agent configured semantic memory with fast forgetting. That's why it adapted to the crash faster than the episodic agent."
8. **End game** → GameOver screen with podium + awards

---

## What Happens Under the Hood — One Round

When the instructor starts the game, the server runs this loop every round for every agent:

```
Round starts
    │
    ├── 1. TICK PRICES (GBM math + event impacts + order pressure)
    │
    ├── 2. For EACH agent (batched 8 at a time):
    │       │
    │       ├── Step 1: RAG RETRIEVAL
    │       │   Query: "Pharma stock MEDI dropping 8%, scandal: CEO resigns"
    │       │   → ChromaDB semantic search → 5 knowledge docs
    │       │   (agent.rag_doc_count controls how many)
    │       │   Model: gemini-embedding-001 (for query embedding)
    │       │
    │       ├── Step 2: MEMORY RECALL
    │       │   Query: "past experiences with MEDI scandal, my trades in NOVA"
    │       │   → ChromaDB semantic search → 10 personal memories
    │       │   (agent.memory_recall_count, memory_importance_threshold)
    │       │   → Apply forgetting decay (agent.forgetting_speed)
    │       │   Model: gemini-embedding-001 (for query embedding)
    │       │
    │       ├── Step 3: MARKET ANALYSIS ← Gemini 2.5 Pro
    │       │   System prompt: personality + strategy + risk level
    │       │   User prompt: prices + portfolio + news + knowledge + memories + chat
    │       │   (agent.market_data_config controls which sections included)
    │       │   (agent.chat_history_count controls chat messages)
    │       │   → Returns: free-form analysis text (~300 words)
    │       │
    │       ├── Step 4: ACTION DECISION ← Gemini 2.5 Pro
    │       │   Input: analysis + available actions (BUY/SELL/HOLD/CHAT)
    │       │   → Returns: JSON {"action": "BUY", "ticker": "NOVA", "amount": 5, "reasoning": "..."}
    │       │   → Parsed and validated (invalid → HOLD)
    │       │
    │       ├── Step 5: MEMORY STORAGE
    │       │   Store significant events from this round as memories
    │       │   (agent.memory_filters controls what gets stored)
    │       │   If memory_focus = "semantic": ← Gemini 2.5 Flash
    │       │       Extract pattern: "Pharma scandals cause 8-12% drops"
    │       │   If memory_focus = "procedural": ← Gemini 2.5 Flash
    │       │       Extract rule: "When CEO scandal hits, sell immediately"
    │       │   Model: gemini-embedding-001 (for storing in ChromaDB)
    │       │
    │       └── Step 6: MEMORY COMPRESSION
    │           If memory count > agent.compression_trigger:
    │               Summarize old memories via Gemini 2.5 Pro
    │               Delete originals, keep summaries
    │
    ├── 3. EXECUTE TRADES (update portfolios)
    ├── 4. APPLY ORDER PRESSURE (buy/sell volume shifts prices)
    ├── 5. COMPUTE RANKINGS (sort by portfolio value)
    └── 6. BROADCAST via WebSocket → dashboard updates
```

---

## Gemini Models Used

We use **three Gemini models**, each for a specific purpose:

| Model | Purpose | When Called | Cost |
|-------|---------|------------|------|
| **gemini-2.5-pro** | Agent brain (analysis + decision) | 2 calls per agent per round | Highest — smartest reasoning |
| **gemini-2.5-flash** | Memory focus transformation | 1-4 calls per agent per round (only if semantic/procedural focus) | Low — fast + cheap |
| **gemini-embedding-001** | Vector embeddings for ChromaDB | 5-8 calls per agent per round (KB search + memory search + memory storage) | Lowest — just embeddings |

### Where Each Model Appears in Code

**gemini-2.5-pro** (`LLM_MODEL` in `gemini_client.py:19`):
- `agent_brain.py` → `analyze_market()`: Generates the market analysis with the agent's personality
- `agent_brain.py` → `decide_action()`: Chooses BUY/SELL/HOLD/CHAT as structured JSON
- `memory.py` → `compress()`: Summarizes old memories into compressed summaries

**gemini-2.5-flash** (`FLASH_MODEL` in `gemini_client.py:20`):
- `agent_brain.py` → `transform_memory_focus()`: Transforms raw event memories into patterns (semantic) or rules (procedural)
- Only called when `agent.memory_focus != "episodic"` — students who choose semantic/procedural pay the extra cost

**gemini-embedding-001** (`EMBEDDING_MODEL` in `gemini_client.py:21`):
- `knowledge_base.py` → `GeminiEmbeddingFunction`: Embeds knowledge docs on startup + queries during RAG
- `memory.py` → `AgentMemory`: Embeds memories when stored + queries during recall
- Produces 3072-dimensional vectors for cosine similarity search

### API Call Count Per Round

For one agent with **default settings** (episodic memory):
- 2 Gemini 2.5 Pro calls (analysis + decision)
- ~6 embedding calls (KB query, memory query, 2-4 memory stores)
- **Total: ~8 API calls per agent per round**

For one agent with **semantic/procedural memory**:
- 2 Gemini 2.5 Pro calls
- 1-4 Gemini 2.5 Flash calls (one per memory stored)
- ~6 embedding calls
- **Total: ~10-12 API calls per agent per round**

For **40 agents × 30 rounds**: ~9,600 - 14,400 total API calls per game.

---

## The Token War Room — What Each Setting Does

### Research Documents (rag_doc_count: 1-10, default 5)
Controls how many knowledge base articles the agent retrieves each round via RAG.
- **Low (1-2)**: Lean context, fast, but agent may miss relevant market patterns
- **High (8-10)**: Rich context, agent sees more patterns, but uses ~2000 tokens just for knowledge

### Memory Slots (memory_recall_count: 3-20, default 10)
How many past memories the agent recalls each round.
- **Low (3-5)**: Agent has short working memory, only most relevant memories
- **High (15-20)**: Agent recalls more history, but older/less relevant memories may add noise

### Memory Importance Threshold (1-10, default 3)
Minimum importance score a memory needs to be recalled.
- **Low (1-2)**: Recall everything including mundane events
- **High (7-10)**: Only recall major events (scandals, big trades, crashes)

### Chat Messages (0-10, default 5)
How many recent agent chat messages to include in the analysis prompt.
- **0**: Ignore all social signals (lone wolf strategy)
- **High**: Social agent that reacts to what others are saying

### Market Data Toggles
- **Price changes (%)**: Show percentage change arrows (default ON)
- **Full price history**: Include last 10 rounds of prices — expensive (~500 tokens), but gives trend data
- **Portfolio state**: Show current cash + holdings (default ON)
- **News events**: Show active market events from instructor (default ON)
- **Leaderboard (top 5)**: See competitor standings — enables competitive strategies

### Context Health Meter
Estimates total tokens per round:
- **Green (60-80%)**: Optimal — enough context without waste
- **Yellow (40-60% or 80-90%)**: Sparse or dense
- **Red (>90%)**: Context rot risk — too much information may confuse the LLM

---

## The Memory Architect — What Each Setting Does

### Memory Focus
Controls HOW events are stored as memories:

**Episodic** (default): Store raw events exactly as they happened.
```
"Round 12: MediCorp (MEDI) dropped 8.4% to $149.68"
```
Best for: Pattern recognition. The LLM sees specific events and can spot recurring patterns.

**Semantic**: Extract general market patterns using Gemini 2.5 Flash.
```
"[SEMANTIC] Pharma stocks with CEO scandals typically experience 8-12% initial drops"
```
Best for: Building market intuition. The agent accumulates wisdom, not just facts. Costs an extra Gemini Flash call per memory.

**Procedural**: Extract if-then trading rules using Gemini 2.5 Flash.
```
"[PROCEDURAL] When a pharma CEO scandal hits with severity 4+, sell immediately and wait 3 rounds to rebuy"
```
Best for: Consistent strategy execution. The agent builds a personal rulebook. Costs an extra Gemini Flash call per memory.

### Forgetting Speed (1-5, default 3)
Applies decay to memory importance based on age. Higher = faster decay = old memories become irrelevant.

| Speed | Decay per round | Memory with importance 6 after 10 rounds |
|-------|-----------------|------------------------------------------|
| 1 (Elephant) | 2% | 6 × 0.98^10 = 4.9 → still recalled |
| 3 (Balanced) | 10% | 6 × 0.90^10 = 2.1 → filtered out (below threshold 3) |
| 5 (Goldfish) | 20% | 6 × 0.80^10 = 0.6 → completely forgotten |

The tradeoff: Elephants have rich history but cluttered context. Goldfish have lean context but may repeat past mistakes.

### Compression Trigger (10-100, default 50)
When total memory count exceeds this number, old memories (>10 rounds ago) are summarized by Gemini 2.5 Pro. Individual memories are deleted and replaced with compressed summaries.

- **Low (10-20)**: Aggressive compression — keeps context lean, but loses detail early
- **High (80-100)**: Preserves detail longer, but may hit token limits in long games

### Memory Filters
Choose what types of events your agent remembers:

| Filter | Default | What It Stores |
|--------|---------|----------------|
| Price moves above X% | ON (3%) | "MEDI dropped 8.4% to $149.68" |
| News events | ON | "[SCANDAL] CEO resigns (severity 4/5)" |
| Own trade results | ON | "I sold 15 MEDI at $149.68. Reasoning: ..." |
| Chat messages | OFF | "I said: 'Get out of MEDI'" |
| Portfolio snapshots | OFF | "Portfolio $9,264. Cash: $4,250. Holdings: NOVA 20" |
| HOLD decisions | OFF | "Chose to HOLD. Reasoning: Waiting for recovery signal" |

Enabling more filters = richer memory = more embeddings = more API calls. Students learn that richer context isn't free.

---

## The Six Companies

| Ticker | Name | Sector | Start $ | Volatility | Personality |
|--------|------|--------|---------|------------|-------------|
| NOVA | TechNova | AI/Tech | $150 | High (0.03) | Hype-driven, momentum |
| GRNE | GreenPulse | Clean Energy | $85 | Medium (0.02) | Policy-sensitive, steady |
| MEDI | MediCorp | Pharma | $200 | Med-High (0.025) | Scandal-prone, big upside |
| FOOD | FoodCo | Agriculture | $45 | Low (0.012) | Safe haven, boring |
| LUXE | LuxeGlobal | Luxury | $310 | Highest (0.035) | Sentiment-driven, volatile |
| IRON | IronShield | Defense | $120 | Low-Med (0.015) | Geopolitics, inverse correlation |

---

## Pre-Built Scenarios

The instructor can load these from the /control panel:

| Scenario | What Happens | Teaching Moment |
|----------|-------------|-----------------|
| **Flash Crash** | Algo glitch → circuit breakers → Fed recovery | Panic selling vs buying the dip |
| **Earnings Season** | Mixed results across companies | Sector analysis, earnings impact |
| **The Big Lie** | Fake merger rumor → hype → CEO denial crash | Rumor detection, false information |
| **Sector Rotation** | Money flows from tech to defense/energy | Cross-sector correlation |
| **Bull Run** | Rate cut → consumer confidence → broad rally | Momentum riding |
| **Insider Tip** | Unusual activity → pharma breakthrough | Information asymmetry |

---

## File Structure Quick Reference

```
server/
├── gemini_client.py      # Shared client: 2.5-pro, 2.5-flash, embedding-001
├── models.py             # All data models including Token War Room + Memory Architect fields
├── market.py             # GBM price engine, trade execution
├── events.py             # Event injection, decay, scenarios
├── scenarios.yaml        # 6 pre-built event sequences
├── knowledge_base.py     # ChromaDB with 50 docs, Gemini embeddings
├── memory.py             # Per-agent ChromaDB memory, compression
├── agent_brain.py        # THE CORE: 6-step brain loop, all parameterized
├── orchestrator.py       # Game loop, batched execution
└── main.py               # FastAPI app, WebSocket hub, REST API

frontend/src/
├── components/join/AgentForm.jsx        # /join form + Token War Room + Memory Architect
├── components/dashboard/AgentInspector.jsx  # Config tab shows all settings
├── components/dashboard/*.jsx           # 11 dashboard components
├── components/control/*.jsx             # 6 control panel components
├── hooks/useWebSocket.js               # Auto-reconnect WebSocket
└── hooks/useMarketState.js             # useReducer state management
```
