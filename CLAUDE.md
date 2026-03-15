# Market Panic — Capstone Simulation

## What This Is
A live multi-agent stock market simulation for a **context engineering bootcamp capstone** (Session 8). Deployed on **Railway** as a single web app. 30-40 students join via URL, create their agent by filling a form (name, personality, strategy, risk level, sectors), and watch all agents compete in a live simulated market on a dashboard — all in the browser. The instructor controls events, pacing, and drama from a control panel. Students write zero code.

**After the simulation hooks them**, the instructor switches to VS Code and walks through the code behind it — showing how RAG, memory, compression, and tool use power every agent's brain. This is the "reveal" moment.

## The Three URLs (One Deployment)
```
marketpanic.up.railway.app/join       → Student form (create your agent)
marketpanic.up.railway.app/dashboard  → Live simulation dashboard (everyone watches)
marketpanic.up.railway.app/control    → Instructor control panel (private)
```

## Who Does What
- **Students**: Open `/join` in browser → fill form → open `/dashboard` → watch their agent trade. Zero setup, zero code, zero installs.
- **Instructor**: Opens `/control` to manage game. Shares screen on Zoom showing `/dashboard`. Later switches to VS Code to walk through the code.
- **Server**: Runs ALL agent brains. Takes each student's personality/strategy/risk text, feeds it to Gemini Flash, makes trading decisions for every agent every round.

## Architecture
```
market-panic/
├── server/                    # Python FastAPI — the entire backend
│   ├── main.py                # FastAPI app, serves frontend, API routes, WebSocket hub
│   ├── market.py              # Price engine (GBM), order book, trade execution
│   ├── orchestrator.py        # Game loop, round management, agent decision collection
│   ├── events.py              # Event injection, decay, scenarios
│   ├── agent_brain.py         # THE CORE: LLM-powered agent decision-making
│   ├── memory.py              # ChromaDB memory per agent — store, retrieve, compress
│   ├── knowledge_base.py      # Shared ChromaDB knowledge base (50 pre-loaded docs)
│   ├── models.py              # Pydantic models
│   ├── scenarios.yaml         # Pre-built event sequences
│   ├── requirements.txt
│   ├── .env                   # GEMINI_API_KEY (not committed)
│   └── Procfile               # Railway: web: uvicorn server.main:app --host 0.0.0.0 --port $PORT
│
├── frontend/                  # React + Vite — builds to static files, served by FastAPI
│   ├── src/
│   │   ├── App.jsx            # Router: /join, /dashboard, /control
│   │   ├── main.jsx
│   │   ├── styles/
│   │   │   └── global.css     # Design system, fonts, animations
│   │   ├── pages/
│   │   │   ├── JoinPage.jsx       # Student agent creation form
│   │   │   ├── DashboardPage.jsx  # Live simulation view
│   │   │   └── ControlPage.jsx    # Instructor control panel
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── TopBar.jsx
│   │   │   │   ├── PriceCharts.jsx
│   │   │   │   ├── Leaderboard.jsx
│   │   │   │   ├── LeaderboardRow.jsx
│   │   │   │   ├── NewsTicker.jsx
│   │   │   │   ├── ActivityFeed.jsx
│   │   │   │   ├── MarketStats.jsx
│   │   │   │   ├── AgentInspector.jsx
│   │   │   │   ├── RoundOverlay.jsx
│   │   │   │   ├── GameOver.jsx
│   │   │   │   └── SoundEngine.jsx
│   │   │   ├── control/
│   │   │   │   ├── GameControls.jsx
│   │   │   │   ├── EventInjector.jsx
│   │   │   │   ├── ScenarioLoader.jsx
│   │   │   │   ├── AgentManager.jsx
│   │   │   │   ├── LiveStats.jsx
│   │   │   │   └── EventTimeline.jsx
│   │   │   └── join/
│   │   │       └── AgentForm.jsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   └── useMarketState.js
│   │   └── utils/
│   │       ├── colors.js
│   │       └── formatters.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── railway.json               # Railway build config
├── CLAUDE.md
└── docs/
    └── MASTER_PROMPT.md
```

## Deployment: Railway
- **Single service**: FastAPI serves both the API and the built React frontend
- **Build step**: `cd frontend && npm install && npm run build` → outputs to `frontend/dist/`
- **FastAPI mounts**: `app.mount("/", StaticFiles(directory="frontend/dist", html=True))`
- **WebSocket**: Railway supports WebSockets natively on the same port
- **Environment variables**: `GEMINI_API_KEY` set in Railway dashboard
- **Procfile**: `web: uvicorn server.main:app --host 0.0.0.0 --port $PORT`
- **railway.json**: build command, start command, Python + Node.js buildpacks

## Tech Stack
- **Backend**: Python 3.11, FastAPI, uvicorn, WebSockets
- **LLM**: Google Gemini Flash only (all agent brains + embeddings)
- **Database**: ChromaDB (in-memory on Railway — resets each deploy, that's fine)
- **Frontend**: React 18 + Vite, Chart.js (react-chartjs-2), Framer Motion
- **Deployment**: Railway (single service)

## How Agent Brains Work (Server-Side, THE Teaching Core)
Every round, the server runs each agent's brain — this is the code the instructor walks through:

```
For each agent, every round:
  1. RETRIEVE (RAG)      → query knowledge base with current market context
  2. RECALL (Memory)     → retrieve relevant past memories for this agent
  3. ANALYZE (Prompting) → feed everything to Gemini with agent's personality/strategy
  4. DECIDE (Tool Use)   → LLM picks an action: BUY/SELL/HOLD/CHAT
  5. STORE (Memory)      → save this round's events + decision to agent's memory
  6. COMPRESS (if needed) → summarize old memories when count exceeds threshold
```

The agent's personality, strategy text, risk level, and sector preferences — all from the student's form — go into the system prompt. Different students' agents behave differently because their personality/strategy prompts are different. **This is context engineering in action.**

## Design System — "Neon Trading Floor"
Shared across all 3 pages.

### Colors (CSS Custom Properties)
```css
--bg-primary: #0a0a0f;
--bg-secondary: #12121a;
--bg-tertiary: #1a1a2e;
--bg-elevated: #22223a;
--border-subtle: #2a2a3e;
--border-glow: rgba(0, 240, 255, 0.15);
--text-primary: #e8e8f0;
--text-secondary: #8888a0;
--text-muted: #555570;
--accent-cyan: #00f0ff;
--accent-pink: #ff2d7a;
--accent-green: #00e676;
--accent-amber: #ffab00;
--accent-purple: #b388ff;
--glow-cyan: 0 0 20px rgba(0, 240, 255, 0.3);
--glow-pink: 0 0 20px rgba(255, 45, 122, 0.3);
--glow-green: 0 0 20px rgba(0, 230, 118, 0.3);
--ease-snappy: cubic-bezier(0.22, 1, 0.36, 1);
```

### Typography
- **Numbers/data**: JetBrains Mono 400/700, tabular-nums
- **Labels/headings**: DM Sans 500/700
- **NO**: Inter, Roboto, Arial, system fonts, serif fonts

### Visual Rules
- Dark theme ONLY — no light mode anywhere
- Glowing borders on interactive elements
- Price flashes green ▲ / pink ▼ with scale animation
- Pulsing status dots for agent states
- NO generic AI-look: no shadcn defaults, no white cards, no purple gradients

## The /join Page — Student Agent Creation
Beautiful, themed form — NOT a boring Google Form. This is the first thing students see.
- Dark theme, same design system as dashboard
- Fields: agent name, personality (textarea), trading strategy (textarea), risk slider (1-5), favorite sectors (toggle 6 company buttons)
- Submit → agent appears on dashboard with "spawning..." animation
- After submit → auto-redirect to /dashboard
- If game hasn't started yet: "Your agent is ready! Waiting for the game to begin..."
- If game is running: agent joins mid-game with $10,000

## Code Conventions
- Python: type hints, Pydantic models, async/await
- React: functional components + hooks, React Router for pages
- CSS custom properties for theming, one global.css
- Framer Motion for animations (leaderboard, panels, overlays)
- Chart.js via react-chartjs-2
- WebSocket with auto-reconnect
- No localStorage — all state server-side or in React memory

## Critical Constraints
- Student experience: open URL → fill form → watch dashboard. NOTHING ELSE.
- Must handle 40 agents, each making LLM calls every round. Gemini Flash rate limits matter — batch or stagger calls.
- Railway free tier: check memory/CPU limits. ChromaDB in-memory is fine.
- WebSocket must work through Railway's proxy (it does natively)
- If a student joins mid-game, they start with $10,000 and jump in next round
- Dashboard must work on any screen size students might have (laptop, tablet, even phone on Zoom)
- The /control page should have basic auth or a password — students shouldn't access it
