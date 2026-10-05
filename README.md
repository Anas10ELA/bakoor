# Bakoor

Bakoor is a prayer-centered time-management expert system. It turns task
duration and energy, prayer times, adhkar, day boundaries, and fixed commitments
into an exact proposal. The user can approve the proposal or freely rearrange
its flexible blocks before adopting the day plan.

## Features

- Builds a day plan around prayer times, fixed commitments, meals, commute,
  and the user's preferred start/end of day.
- Offers full, balanced, and minimum-effort plans, matching task energy needs
  to estimated energy windows and protecting a configurable time buffer.
- Supports recurring habits, minimum versions for difficult days, focus
  sessions, actual-time tracking, daily reviews, and recovery after interruptions.
- Includes Arabic and English interfaces, light and dark themes, and a local
  demo mode that works without signing in.
- Stores authenticated tasks, plans, habits, goals, and reviews in Base44.

Prayer times are requested from the AlAdhan API, with bundled fallback times
when the service is unavailable. Plan placement and task suggestions are
rule-based; this project does not call a generative AI model.

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173/?demo=1` to explore the seeded demo day without an
account. Authenticated users store their tasks, blocks, habits, goals, and
reviews in Base44.

## Base44 resources

```bash
pnpm base44 whoami
pnpm base44 types generate
pnpm base44 entities push
pnpm base44 auth password-login enable
pnpm base44 auth push
```

All user-owned entities use owner-only row-level security.

