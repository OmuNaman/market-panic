# UI Design Rules — Market Panic

Applies to all three pages: /join, /dashboard, /control.

## Absolute Prohibitions
- NO white/light backgrounds — dark theme only, everywhere
- NO default component libraries unstyled (no raw shadcn, MUI, Ant Design)
- NO placeholder data — always realistic market numbers
- NO Chart.js default colors — use defined palette
- NO serif fonts
- NO rounded-corner white cards with drop shadows
- NO purple→blue gradients
- NO generic AI-generated aesthetic

## Required Visual Signatures
- Glowing borders on interactive: `border: 1px solid var(--accent-cyan); box-shadow: var(--glow-cyan)`
- Monospace font (JetBrains Mono) for ALL numbers, prices, stats
- Subtle noise texture on root background (2-3% opacity)
- Status dots: pulsing CSS animation (scale 1→1.3→1, 2s interval)
- All motion: Framer Motion with ease `[0.22, 1, 0.36, 1]`
- Price changes: ▲ green / ▼ pink with scale animation
- Panel borders: 1px solid var(--border-subtle)
- Hover: border brightens + glow appears, not background color change

## Per-Page Rules

### /join Page
- Must feel like entering a game, not filling a form
- Centered card, max-width 560px, dark with subtle glow
- Large "MARKET PANIC" title with cyan text-shadow
- Mobile-friendly — students might be on phones
- Sector toggle buttons: pill-shaped with glow on select

### /dashboard Page
- Information readable from Zoom screen-share (lower res than direct view)
- Price numbers: 2-3rem, high contrast
- Leaderboard: readable at a glance
- Avoid tiny text — Zoom compression kills small fonts

### /control Page
- Big touch targets: 64px+ button height
- Spacious layout — less density than dashboard
- Clear state: buttons dim when disabled, glow when active
- Destructive actions need confirmation modal
