# CLAUDE.md: Podcast Ecosystem Radar

## Goal
Dashboard + Monday email for Aditya (English startup podcast). Watches up to 15 YouTube channels; ranks 6 topics, up to 7 guests per topic, up to 5 sponsors. Aditya decides everything; nothing ever contacts a guest or sponsor.

## Stack
Next.js App Router (plain JS) on Vercel; Neon via `@neondatabase/serverless` (plain SQL in `migrations/`, parameterised only); YouTube Data API v3, Gemini Flash, Resend (all via fetch); Vercel Cron; gsap + @gsap/react. Tests: `node --test` (pglite for in-memory Postgres).

## Non-negotiable rules
1. Fallback chain live -> last good snapshot -> demo, banner always says which.
2. Gemini Flash is the only AI. No other AI SDK/URL (test enforces).
3. Free tiers only; ask before anything needing a card.
4. Secrets only in `.env.local`/Vercel; never `NEXT_PUBLIC_`; all env reads in `lib/env.js`; never log keys.
5. Never call `search.list`. Hidden likes are null, never 0.
6. Guest/brand names must appear in the video text (validated in code).
7. Crons: `30 20 * * *` refresh, `0 0 * * 1` brief (UTC). Brief idempotent per week.

## Layout
`lib/` logic (scoring, pipeline, extract, brief, auth), `app/api/*` routes, `components/`, `config/` (scoring, pipeline, taxonomy, default channels), `tests/`.

## Status
M0-M10 done. CI workflow is parked in `ci-pending/ci.yml` (move to `.github/workflows/` after `gh auth refresh -s workflow`).

## Next action
User adds keys (YOUTUBE_API_KEY, GEMINI_API_KEY, DATABASE_URL, RESEND_API_KEY, BRIEF_TO_EMAIL), redeploys, presses Refresh in Settings.
