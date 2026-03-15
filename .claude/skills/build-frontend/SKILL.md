---
name: build-frontend
description: Build the Market Panic React frontend — the /join form page, /dashboard live simulation view, and /control instructor panel. Single React app with React Router, deployed as static files served by FastAPI on Railway.
---

# Frontend Build Skill

## One React App, Three Pages
```
/join       → AgentForm — student creates their agent
/dashboard  → Live simulation — everyone watches
/control    → Instructor panel — game controls + event injection
```

React Router handles routing. Vite builds to `frontend/dist/`, FastAPI serves as static files.

## Tech Setup
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom chart.js react-chartjs-2 framer-motion
```

`vite.config.js`:
```js
export default {
  build: { outDir: 'dist' },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } } }
}
```

## App.jsx — Router Shell
```jsx
<BrowserRouter>
  <Routes>
    <Route path="/join" element={<JoinPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/control" element={<ControlPage />} />
    <Route path="/" element={<Navigate to="/join" />} />
  </Routes>
</BrowserRouter>
```

---

## PAGE 1: /join — Agent Creation Form

### Purpose
First thing students see. Must feel like they're entering a game, not filling a Google Form. Dark, glowing, exciting.

### Layout
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│            🔥 MARKET PANIC 🔥                           │
│          "Create Your Trader"                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Agent Name: [________________]                  │   │
│  │                                                  │   │
│  │  Personality:                                    │   │
│  │  [textarea — "Describe your trader's             │   │
│  │   personality in a few sentences..."]            │   │
│  │                                                  │   │
│  │  Trading Strategy:                               │   │
│  │  [textarea — "How should your agent trade?       │   │
│  │   e.g. 'Buy tech dips, sell on hype...'"]       │   │
│  │                                                  │   │
│  │  Risk Appetite:                                  │   │
│  │  [—●————————] Cautious ←→ Reckless               │   │
│  │   1  2  3  4  5                                  │   │
│  │                                                  │   │
│  │  Favorite Sectors (pick 1-3):                    │   │
│  │  [NOVA] [GRNE] [MEDI] [FOOD] [LUXE] [IRON]     │   │
│  │   Tech   Energy Pharma  Agri  Luxury Defense    │   │
│  │                                                  │   │
│  │         [ 🚀 DEPLOY AGENT ]                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  "32 agents already in the market..."                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Component: `AgentForm.jsx`
- **Agent Name**: text input, required, max 20 chars, validate uniqueness via API
- **Personality**: textarea, required, placeholder with example ("A paranoid day-trader who trusts nobody and always hedges...")
- **Trading Strategy**: textarea, required, placeholder with example ("Buy undervalued stocks, sell at 15% profit, avoid hype...")
- **Risk Level**: styled slider 1-5, labels "Cautious" to "Reckless", default 3
- **Sectors**: 6 toggle buttons showing ticker + sector name, glow cyan when selected, 1-3 required
- **Submit button**: large, cyan glow, "DEPLOY AGENT" text
- **Live agent counter**: polls `GET /api/agents/count` every 5s, shows "32 agents in the market"
- **Validation**: inline errors with helpful messages, all fields required
- **On submit**: POST to `/api/agents/create`, on success → brief "Agent deployed!" animation → redirect to `/dashboard`
- **If game not started**: "Your agent is ready! Waiting for the instructor to start..."
- **If game in progress**: "Joining mid-game with $10,000 — good luck!"
- **Prevent duplicates**: after submitting, store agent name in sessionStorage, if they revisit /join show "You already have an agent! → Go to Dashboard"

### Style
- Centered form card, max-width 560px
- Dark background with subtle radial gradient from center
- Form card: var(--bg-secondary), 1px border var(--border-subtle), subtle glow
- Inputs: dark bg (--bg-tertiary), cyan border on focus, mono font for name
- Sector buttons: pill-shaped, outlined, glow on select
- The "MARKET PANIC" title: JetBrains Mono, 3rem, letter-spacing 0.15em, cyan text-shadow
- Mobile-friendly: must work on phone screens too (students might be on mobile)

---

## PAGE 2: /dashboard — Live Simulation

### Layout (same as previous dashboard spec)
```
┌─────────────────────────────────────────────────────────┐
│  <TopBar />                                             │
├──────────────────────┬──────────────────────────────────┤
│  <PriceCharts />     │  <Leaderboard />                 │
│  60% width           │  40% width                       │
├──────────────────────┴──────────────────────────────────┤
│  <NewsTicker />                                         │
├──────────────────────┬──────────────────────────────────┤
│  <ActivityFeed />    │  <MarketStats />                  │
└──────────────────────┴──────────────────────────────────┘

<AgentInspector />    <!-- slide-out on click -->
<RoundOverlay />      <!-- between rounds -->
<GameOver />          <!-- final results -->
```

### State Management
Single `useMarketState` hook — `useReducer` holds all state:
- round, totalRounds, gameStatus (waiting/running/paused/finished)
- prices, priceHistory, agents, rankings
- news, trades, activeEvents
- selectedAgent, muted

`useWebSocket` connects to `wss://marketpanic.up.railway.app/ws/dashboard` (detect protocol from window.location). All server pushes update state via reducer dispatch.

### Dashboard Components (each in `components/dashboard/`)

**TopBar.jsx** — "MARKET PANIC" logo, round counter + progress bar, connection dot, mute button

**PriceCharts.jsx** — Tabbed per company + "ALL", Chart.js line with dark theme, cyan gradient fill, event markers as vertical lines

**Leaderboard.jsx + LeaderboardRow.jsx** — Framer Motion `layout` for animated reorder. Each row: rank, name, portfolio $, last action badge (BUY green, SELL pink, HOLD gray, CHAT purple), status dot. Click → AgentInspector. Top 3 get gold/silver/bronze accent.

**NewsTicker.jsx** — Horizontal CSS scroll, category icons, severity color, glow on new items

**ActivityFeed.jsx** — Scrollable, newest first, color-coded actions, reasoning text, max 50 items, Framer Motion fade-in

**MarketStats.jsx** — 2×3 grid: volume, volatility, mood, active agents, biggest mover, most traded

**AgentInspector.jsx** — Slide-out 420px from right, Framer Motion. Sections: agent identity (name + personality + strategy text from form), portfolio bar, memory log (importance-colored), decision history, brain stats. **This is key for teaching** — students see their personality text translated into actual memories and decisions.

**RoundOverlay.jsx** — Full-screen "ROUND N" for 1.5s, top/bottom movers

**GameOver.jsx** — Podium top 3, full leaderboard, highlight cards (Best Trade, Worst Trade, Memory Champion, Chatterbox), confetti on #1

**SoundEngine.jsx** — Web Audio context, synthesized sounds (tick, trade, news, panic, gameover), mute toggle

### Responsive Design
Dashboard must work on:
- **Big screen** (instructor shares screen): full grid layout, information-dense
- **Student laptop** (1366×768 typical): slightly compressed but all panels visible
- **Phone** (some students might watch on mobile): stack panels vertically, hide MarketStats, simplified leaderboard

---

## PAGE 3: /control — Instructor Panel

### Access Control
Simple password gate: prompt on load, check against env var `CONTROL_PASSWORD`. Store in sessionStorage. Not real security — just prevents students from accidentally finding it.

### Layout
```
┌──────────────────────────────────────────────────────────┐
│  MARKET PANIC — CONTROL              [Connected ●] [R:12]│
├────────────────────────────┬─────────────────────────────┤
│  <GameControls />          │  <LiveStats />              │
│  START / PAUSE / END       │  Agents, round, response    │
│  Speed: 1x 2x 3x          │  times, mood                │
├────────────────────────────┴─────────────────────────────┤
│  <ScenarioLoader />                                      │
│  Pre-built scenario cards                                │
├──────────────────────────────────────────────────────────┤
│  <EventInjector />                                       │
│  Custom event builder                                    │
├────────────────────────────┬─────────────────────────────┤
│  <AgentManager />          │  <EventTimeline />          │
└────────────────────────────┴─────────────────────────────┘
```

### Components (each in `components/control/`)

**GameControls.jsx** — START (green, 64px), PAUSE (amber), RESUME (green), END (red + confirmation modal). Speed toggles: 1×/2×/3×. State-aware: only show relevant buttons.

**LiveStats.jsx** — Agent count, round progress, avg Gemini response time, market mood, active events

**ScenarioLoader.jsx** — 6 cards: Flash Crash, Earnings Season, The Big Lie, Sector Rotation, Bull Run, Insider Tip. Click → preview events → confirm → inject.

**EventInjector.jsx** — Category dropdown, headline text, ticker toggles, severity slider 1-5, "Is Rumor?" switch, INJECT button.

**AgentManager.jsx** — All agents with status, portfolio value, response time. Remove button with confirmation.

**EventTimeline.jsx** — Chronological event log, category icon, impact, rumor badge.

### Style
Same dark theme, but spacious. Big touch targets (64px buttons). Instructor is on laptop, possibly trackpad, talking to class. Prioritize usability.

---

## Build & Deployment
```bash
# Local dev
cd frontend && npm run dev         # → localhost:5173 (proxies API to :8000)
cd server && uvicorn main:app      # → localhost:8000

# Production build
cd frontend && npm run build       # → frontend/dist/
# FastAPI serves frontend/dist/ as static files
# Railway runs: uvicorn server.main:app --host 0.0.0.0 --port $PORT
```

## WebSocket URL Detection
```js
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;
```
This automatically works both in local dev (ws://localhost:8000) and production (wss://marketpanic.up.railway.app).
