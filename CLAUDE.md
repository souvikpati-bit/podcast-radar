# CLAUDE.md: Podcast Ecosystem Radar

Read `HANDOFF.md` first for the full picture (state, architecture, decisions, findings, next steps). This file is the short working brief. It contains no secrets and must stay that way.

## Goal
Weekly intelligence system for **Aditya**, host of a podcast for independent startup founders in India (English audience). It watches about ten podcasts and shows: **6 topics** covered by the most shows at once, **up to 7 founders** to track (media-round founders first), and **up to 5 sponsors**, as a dashboard plus a **Monday-morning email**. Aditya decides everything; the system never contacts a guest or a sponsor. Exam: MESA C4 "Problem Statement 20".

## Exam rules (non-negotiable)
1. Live external data wherever possible, but always show some data: fallback chain **live -> last good snapshot (Neon) -> bundled demo data**; the banner always says which.
2. **All AI = Gemini Flash only. Never the Claude API** or any other AI SDK/URL (`tests/no-other-ai.test.js` enforces).
3. Deploy on **Vercel** with a public URL; code on GitHub; submit a **Components Map**.
4. The set of monitored shows is **configurable without touching code** (Settings page, stored in Neon).
5. The brief arrives **every Monday morning** (cron `0 0 * * 1` UTC = 05:30 IST).
6. Free tiers only; ask before anything needing a card or paid plan.

## Rules for working here
- Secrets only in `.env.local` and Vercel env vars. Never in chat, code, logs or docs. Never `NEXT_PUBLIC_` for a secret. All env reads go through `lib/env.js`.
- Never call YouTube `search.list` (100 units). Hidden likes/comments are `null`, never 0.
- A guest, brand or company is kept only if it literally appears in the episode text (validated in `lib/extract.js`).
- Parameterised SQL only. Escape all YouTube/Gemini/RSS text before HTML or email.
- Be mindful of quota: YouTube 10,000 units/day (a refresh is about 32 units; daily budget target about 100), Gemini free tier (a refresh is a handful of calls). Report units used.
- User preferences: plain-language explanations; no mobile-layout work; Hindi shows allowed; no manual feed links (RSS reinforcement is automatic); nothing is hidden from lists automatically (guests leave only via the "Confirmed: remove from list" button).
- Make small commits, run `npm run lint && npm test && npm run build` before pushing; check CI and the Vercel deployment after pushing.

## Stack
Next.js 16 App Router, plain JavaScript (ES modules, no TypeScript), React 19. Neon Postgres (`@neondatabase/serverless`, SQL in `migrations/001_init.sql`, applied automatically by `lib/db.js`). YouTube Data API v3, Gemini (model `gemini-flash-latest`) and Resend via `fetch`. GSAP 3.15 + `@gsap/react` (SplitText, ScrollTrigger, Flip registered in `lib/gsap.js`). Tests: `node --test` with in-memory Postgres (`@electric-sql/pglite`). Cron: `vercel.json`.

## Fill in from the repo

**Commands** (run in this folder)
- `npm install`, `npm run dev` (http://localhost:3000), `npm test` (50 tests), `npm run lint`, `npm run build`
- Real-API checks: `node --env-file=.env.local scripts/check-channel.js @handle`, `node --env-file=.env.local scripts/analyze-overlap.mjs`
- Deploy: push to `main` (Vercel auto-deploys, CI runs) or `npx vercel@latest deploy --prod --yes`. `gh` is authenticated (with `workflow` scope). No global Vercel CLI; use `npx vercel@latest`.

**Where things are**
- Live site: https://podcast-radar-alpha.vercel.app . Repo: https://github.com/souvikpati-bit/podcast-radar . Neon project `podcast-radar`.
- `app/` pages (`/`, `/briefs`, `/briefs/[date]`, `/settings`) and API routes (`app/api/*`: login, logout, refresh, channels, actions, actions/export, brief/send, cron/refresh, cron/brief).
- `components/` UI. `components/MotionRoot.jsx` holds all GSAP motion. `components/Dashboard.jsx` is a server component (topics, founders, sponsors).
- `lib/` logic: `pipeline.js` (staged refresh: init, fetch, extract, reinforce, score), `extract.js`, `scoring.js`, `brief.js`, `discover.js` + `rss.js` (RSS reinforcement), `youtube.js`, `gemini.js`, `snapshot.js`, `channels.js`, `auth.js`, `env.js`.
- `config/` all tunable numbers: `scoring.json` (windows, weights, thresholds), `pipeline.json` (fetch/extract limits, prompt version `v2`), `discovery.json` (auto-reinforcement), `taxonomy.json`, `default-channels.json` (seed only).
- Show list: Neon table `channels`. Snapshots: `seed_snapshot`. Briefs: `briefs` (unique `week_start`).

**Current algorithm (see `config/scoring.json`)**
- Only guest-interview episodes count. Topics/guests window 60 days, sponsors 90, lookback up to 180 days for rarely-posting shows (min 6 episodes per show), max 25 episodes per show.
- Topics: need 5+ episodes (relaxes to 3, 2, 1); ranked by number of shows covering them in the last 30 days, then score (performance 40%, engagement 20%, coverage 25%, recency 15%); probability `(hits+1)/(n+2)`; labels ride / crowded-counter-programme / emerging; trend rising/cooling/new/steady; 4-week sparkline.
- Founders: independent of topics; only role = founder (unknown role allowed); media round = 2+ shows within 30 days; formula 0.4 media-willingness + 0.3 recency, scaled to 100%; tags New voice / Heavily booked.
- Sponsors: 2+ shows or a paid flag; reach 35%, recency 25%, paid 25%, frequency 15%; own-company brands excluded.
- All probabilities are clamped to 3 to 97% and labelled "model estimate from the data".

**Status (2026-10-12)**
- Built and live: everything in HANDOFF.md section 2. CI green. 50 tests pass. The Monday cron fired once (brief for week 2026-10-12 sent at 05:56 IST).
- Key finding: zero founders are on a media round across the monitored shows (and across 19 candidate shows tested); the dashboard says so honestly.
- Unverified: whether the Monday email arrived/looks right, Lighthouse scores, accessibility, visual check of Settings/briefs after the redesign.

## Next action
Follow HANDOFF.md section 9: (1) check the Monday email, (2) update `COMPONENTS_MAP.md` for the submission, (3) Lighthouse, (4) re-inspect Settings and briefs pages, then the rest of the list. Submission needs: public URL, GitHub repo link, Components Map.
