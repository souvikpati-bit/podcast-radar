# CLAUDE.md: Podcast Ecosystem Radar

## Goal
Dashboard + Monday-morning email for Aditya (English startup-founder podcast, 2 eps/week). Watches ~10 YouTube podcast channels and ranks: 6 topics, up to 7 guests for a chosen topic, up to 5 sponsors. Aditya decides everything; the system never contacts a guest or sponsor.

## Stack
Next.js (App Router, plain JS) on Vercel; GitHub; Neon Postgres (`@neondatabase/serverless`, plain SQL in `migrations/`, parameterised queries only); YouTube Data API v3 (REST via fetch); Gemini Flash (REST via fetch); Resend (REST via fetch); Vercel Cron; gsap + @gsap/react. Tests: `node --test`.

## Non-negotiable rules
1. Live external data where possible; fallback chain live -> last good snapshot (Neon) -> bundled demo data. Banner always says which.
2. All AI = Gemini Flash only. Never Anthropic/OpenAI SDK or URL in source (a test enforces it).
3. Vercel public URL, GitHub repo, Components Map lanes: Aditya, GitHub, Vercel, YouTube Data API v3, Neon, Code (Next.js server), Gemini API, Review Gate (Aditya), Resend.
4. Monitored channels configurable in Settings, no code edits.
5. Monday brief arrives before Aditya records (cron `0 0 * * 1` UTC = 05:30 IST).
6. Free tiers only. Stop and ask before anything needing a card.
7. Secrets only in `.env.local` / Vercel env. Never `NEXT_PUBLIC_`. Never log keys. All env reads go through `lib/env.js`.
8. Never call `search.list` (100 units).

## Conventions
Plain JS, ES modules, no TypeScript. Pure functions in `lib/scoring.js`, weights in `config/scoring.json`. Times computed in UTC, shown in IST. Parameterised SQL only. Escape all YouTube/Gemini text before HTML. Explain every step in plain language; terms go in GLOSSARY.md. Small commits, `git tag mN` per milestone.

## Current milestone
M0 done (scaffold, CI). Log in PROGRESS.md.

## Next action
M1: channel config + YouTube fetch + migrations + demo data.
