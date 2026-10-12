# HANDOFF: Podcast Ecosystem Radar

Written 2026-10-12 from what was actually built and what is in the repo. Anything not checked is marked **unverified**. No secrets appear in this file (env var names only).

---

## 1. PROJECT

**What:** an AI-powered weekly intelligence system for **Aditya**, who hosts a podcast for independent startup founders (about 2 episodes a week, about 9,000 monthly listeners, India-based, audience in English). It watches about ten podcasts in his ecosystem and answers three questions:

1. **Which founders are on a media round?** (the same founder on 2+ shows within the same month: available, media-willing, easiest to book now)
2. **Which topics are being covered by several shows at the same time?** (themes to ride, or to counter-programme against)
3. **Which brands are being mentioned or promoted across shows?** (companies already spending on podcast ads)

These feed his booking outreach, content calendar and sponsor pitch list. A dashboard plus an email every **Monday morning before he records**. The system **never contacts a guest or a sponsor**; Aditya decides everything.

**Exam rules (from "Problem Statement 20", MESA C4 final exam; PDF is in `C:\Users\Souvik PI\Desktop\MESA_AI\`):**
- Use **live external data** wherever possible, but the system must show **some data at submission** (fallback chain: live, then last good snapshot in Neon, then bundled demo data).
- **All AI = Gemini Flash only. Never the Claude API** (or any other AI API). A test enforces this.
- **Deploy on Vercel** with a working public URL. Submit URL + GitHub repo link + **Components Map**.
- The set of monitored shows is **configurable without touching code**.
- The brief arrives **every Monday morning**.
- Free tiers only; stop and ask before anything needing a card or paid plan.

**Working agreement with the user (preferences stated during the session):**
- Never ask for or show keys in chat. Keys go only in `.env.local` and Vercel env vars.
- Be mindful of API quota and credits; report units used.
- Hindi channels are allowed; target is India-based startup/business shows with founder guests; global shows only as a fallback.
- No manual feed links: the system must reinforce thin data by itself (RSS auto-discovery).
- Guests are **independent of topics**. A guest stays on the list until the user presses "Confirmed: remove from list" (nothing is hidden automatically).
- The user said **mobile-phone layout does not matter** ("don't spend credits on it"). A major mobile overflow bug was fixed anyway; no further phone work wanted.
- Explain in plain language; the user is a student with no coding background.

---

## 2. CURRENT STATE

- **Live URL:** https://podcast-radar-alpha.vercel.app (Vercel project `hypersonic2/podcast-radar`, auto-deploys from `main` on GitHub push)
- **Repo:** https://github.com/souvikpati-bit/podcast-radar (public; branch `main`)
- **Git:** latest commit `77ca66b` ("Redesign: radar hero, stat strip..."). Tags `m0` to `m10` exist (from the original milestone plan). Working tree was clean after that commit.
- **CI:** `.github/workflows/ci.yml` (lint, test, build) is active; the last three runs passed (verified with `gh run list`).
- **Tests:** 50 pass (`npm test`), lint clean, `next build` green (verified before the last commit).
- **Database (Neon):** project `podcast-radar` (id `polished-shadow-19417389`, AWS US East 2, free plan). Tables are created automatically on first use from `migrations/001_init.sql`.
- **Monday cron has fired once for real:** `briefs` row for week 2026-10-12 has status `sent` with `sent_at` 2026-10-12 00:26 UTC (05:56 IST). So the Vercel cron works. (Whether it landed in the inbox, and how it looks, is **unverified**.) An earlier manual send went out for week 2026-10-05.

### Pages
| URL | What it is |
|---|---|
| `/` | Public dashboard: radar hero, this-week stat strip, ticker of shows, 01 Topics, 02 Founders to track, 03 Sponsors, 04 How it is calculated, footer. Shows Review Gate buttons only when logged in. |
| `/briefs` | Archive list of past Monday briefs |
| `/briefs/[date]` | One brief exactly as emailed (stored HTML in a sandboxed iframe) |
| `/settings` | Admin only (login with ADMIN_KEY): run refresh with progress, send brief, resend brief, CSV of Review Gate, manage shows (add by YouTube @handle/URL/ID or podcast RSS link, with preview and host name), confirmed-guests list ("put back"), impact counts, System health (YouTube units today, Gemini calls, emails, missing keys, failed channels, automatic-reinforcement notes, recent runs) |
| `/_not-found`, `/icon.svg`, `/opengraph-image` | 404 page, favicon, social image |

### API routes (all under `app/api/`)
| Route | Method | Auth | Purpose |
|---|---|---|---|
| `login`, `logout` | POST | none / cookie | Admin session cookie (HttpOnly, SameSite=Strict) |
| `refresh` | POST | admin | One step of the staged refresh (client loops until done) |
| `channels` | POST | admin | actions: `preview`, `add`, `preview-feed`, `add-feed`, `remove`, `host` |
| `actions` | POST | admin | Review Gate status (topic/guest/sponsor); re-scores immediately for guests |
| `actions/export` | GET | admin | Review Gate CSV |
| `brief/send` | POST | admin | Send (or force resend) this week's brief |
| `cron/refresh` | GET | `Authorization: Bearer CRON_SECRET` | Daily refresh + retry a failed/missing brief |
| `cron/brief` | GET | `Authorization: Bearer CRON_SECRET` | Monday brief (refresh first if data > 12 h old) |

### Features working (verified unless stated)
- Staged, resumable refresh pipeline; fallback chain live -> snapshot -> demo with a banner stating which.
- Founder-only guest ranking with role and company; media round = 2+ shows within 30 days; "New voice" / "Heavily booked" tags.
- Topics ranked by number of shows covering them in the last 30 days; ride / crowded-counter-programme / emerging stance; trend (rising/cooling/new/steady); 4-week sparkline.
- Sponsors: need 2+ shows or a paid flag; Indian sponsor wording recognised; own-company brands excluded.
- Automatic RSS reinforcement and show discovery (see section 3).
- Review Gate (shortlist/dismiss/contacted/booked-as-"Confirmed"/sponsored), CSV export, impact counts.
- Monday email (Resend, HTML inline styles + plain text), idempotent per week, retry on failure.
- Settings login with throttling (5 failures / 15 min / IP), constant-time compare.
- Security headers, SSRF guard on feed URLs, parameterised SQL only.
- Redesign: GSAP intro timeline (SplitText headline, radar rings draw, blips pop, count-ups), ScrollTrigger reveals, scroll-linked radar sweep, cursor glow on founder cards, magnetic buttons; reduced-motion and no-JS safe.

### The ten monitored shows (stored in Neon `channels`; defaults in `config/default-channels.json`)
YouTube: Raj Shamani, Indian Silicon Valley (Jivraj Singh Sachar), YourStory, Business Today, Prime Venture Partners.
RSS (podcast feeds): The Neon Show, First Principles (The Ken), The Indian Startup Show, Paisa Vaisa with Anupam Gupta, Entrepreneur's Live Interviews.
Chosen by measured founder-episode counts over 180 days (see section 4).

---

## 3. ARCHITECTURE

**Stack:** Next.js 16 App Router, **plain JavaScript** (no TypeScript), React 19, ES modules. Neon Postgres via `@neondatabase/serverless` (plain SQL, parameterised). GSAP 3.15 + `@gsap/react` (SplitText, ScrollTrigger, Flip registered once in `lib/gsap.js`). YouTube, Gemini, Resend are called with plain `fetch` (no SDKs). Tests use `node --test` and an in-memory Postgres (`@electric-sql/pglite`, dev dependency). Node 24 locally, Node 22 in CI.

### Folder structure
```
app/                    pages and API routes (see section 2)
components/             UI: Hero (radar), StatStrip, Marquee, Dashboard (topics/founders/sponsors, server component),
                        ProbRing, Sparkline, Banner, Method, TopBar, ReviewGate, SettingsPanel, LoginForm,
                        MotionRoot (all GSAP motion; client)
config/                 scoring.json, pipeline.json, discovery.json, taxonomy.json, default-channels.json
lib/                    all logic (below)
migrations/001_init.sql idempotent schema (applied automatically by lib/db.js ensureSchema)
scripts/                analyze-overlap.mjs (useful), check-channel.js (real API check), probe.mjs/probe2.mjs (throwaway probes)
tests/                  *.test.js (50 tests)
public/ , components-map.svg   Components Map diagram
vercel.json             the two cron jobs
.github/workflows/ci.yml
```

### Key files in `lib/`
| File | Role |
|---|---|
| `env.js` | The ONLY place env vars are read. Reports missing keys instead of crashing. Forces `GEMINI_MODEL` to contain "flash". |
| `db.js` | Neon client, `safeQuery`, `ensureSchema` (reads `migrations/001_init.sql`), test hook `__setTestClient` |
| `youtube.js` | YouTube Data API v3 client: channels.list, playlistItems.list, videos.list only (never `search.list`). Key sent in `x-goog-api-key` header. Counts quota units. Hidden likes stay `null`. |
| `rss.js` | Tolerant RSS parser (no deps), `assertPublicUrl` (SSRF guard), `fetchFeed` (25 MB cap) |
| `discover.js` | Automatic RSS reinforcement helpers: Apple podcast directory search (`itunes.apple.com`, no key), `findFeedForShow`, `assessFeed`, `discoverNewShows` |
| `gemini.js` | Gemini REST client: JSON response schema, retry on bad JSON once, back-off on 429/5xx |
| `extract.js` | Gemini extraction (guests with role+company, topics, brands) + keyword fallback + code-side validation (a name/brand/company must literally appear in the episode text). Prompt version `v2`. |
| `taxonomy.js` | Topic names: seed list in `config/taxonomy.json`; new specific themes can be added (max 30), persisted in `topics_taxonomy` |
| `guests.js` | Guest name merging (alias table, prefixes, spelling variants); ambiguous pairs logged, not merged |
| `text.js` | Normalisation, description cleaning, sponsor wording regex, brand denylist helper, HTML escape |
| `pipeline.js` | Staged refresh (init, fetch, extract, reinforce, score), runs logging, snapshot save, `rescoreAndSave` (free re-score), `loadDataset` |
| `scoring.js` | Pure scoring: topics, `guestRanking`, sponsors, `buildResults`. Weights/thresholds in `config/scoring.json` |
| `snapshot.js` | Fallback chain and demo snapshot; `getDashboardData` |
| `brief.js` | Build payload (Gemini opening with template fallback), render HTML + text email, send via Resend, idempotent claim per week, retry logic |
| `auth.js`, `login.js`, `session.js` | Admin cookie token (HMAC of ADMIN_KEY), cron secret check, login throttle |
| `actions.js` | Review Gate storage, CSV with formula-injection guard, impact counts |
| `channels.js` | Show storage and validation (YouTube and RSS), default seeding (only if no channels and no live snapshot yet) |
| `health.js`, `format.js`, `demo.js`, `gsap.js` | System health queries, IST formatting and week start, demo data, GSAP registration |

### Data flow (RSS/YouTube to email)
1. **Trigger:** Vercel Cron `30 20 * * *` (daily, about 02:00 IST) calls `/api/cron/refresh`; `0 0 * * 1` (Monday 00:00 UTC = 05:30 IST) calls `/api/cron/brief`. Both need `Authorization: Bearer CRON_SECRET` (Vercel adds it). Defined in `vercel.json`. The Settings button runs the same pipeline step by step through `/api/refresh`.
2. **Fetch** (`pipeline.js` `stepFetch`, 3 channels per call): for YouTube shows, upload playlist -> video details (90 days; 180 days for shows with fewer than 12 long videos). For shows with a `feed_url`, read the podcast RSS (episodes of 10+ minutes within 180 days; no YouTube quota). If a show has both, YouTube is read first and feed episodes that duplicate a YouTube video (same words, within 7 days) are dropped. Stored in `videos` + `video_stats`.
3. **Extract** (`stepExtract`): videos without a `v2` extraction go to Gemini in batches of 20 (cap 160 per run when Gemini is available; keyword fallback otherwise). Output validated against the episode text, stored in `extractions` (guests, guest_info {name, role, company}, topics, brands, method).
4. **Reinforce** (`stepReinforce`, once per refresh): (a) delete auto-added shows with fewer than 6 guest episodes (and remember them in `discovery_rejects`); (b) any monitored YouTube show with fewer than 6 guest episodes gets its podcast feed looked up in Apple's free directory and attached; (c) if the overall picture is thin (fewer than 10 shows, or under 150 guest episodes in 60 days while under 10 shows), discover up to 3 new active, long-form India startup shows. If anything changed, a free RSS-only fetch pass runs, then extraction again.
5. **Score** (`stepScore`): `loadDataset` merges guest names, drops hosts, drops brands equal to a guest's company, applies denylist; `buildResults` ranks; the result is saved as a snapshot in `seed_snapshot` (an empty result is never saved).
6. **Brief** (`brief.js`): reads the same snapshot, builds payload, Gemini writes a 3 to 4 sentence opening from the supplied numbers (template if Gemini fails), renders HTML + text, claims the week atomically in `briefs` (unique `week_start`), sends via Resend (Idempotency-Key), stores the HTML for `/briefs/[date]`.
7. **Retry:** the daily cron retries this week's brief if it is missing, failed, or a stale draft.

### Where things are stored
- **Show list:** Neon table `channels` (editable in Settings). Defaults only seed an empty database.
- **Snapshots, briefs, runs, extractions, actions, taxonomy, rejects:** Neon (see `migrations/001_init.sql`).
- **Cron jobs:** `vercel.json` (repo root).

---

## 4. DECISIONS AND WHY

| Decision | Why |
|---|---|
| Next.js JS + Vercel + Neon + Resend + Gemini | Fixed by the exam brief; all free tier |
| YouTube via uploads playlist, never `search.list` | 1 unit per call vs 100; about 6 to 8 units per show |
| API keys in headers, never in URLs | Keys never appear in logs or error text |
| Gemini model `gemini-flash-latest` | `gemini-2.5-flash` is listed for this key but returns 404 on generate; the alias works and is still Flash. A test forbids other AI SDKs/URLs. |
| Code-side validation of every name/brand/company | Enforces "never invent a name"; descriptions are untrusted text and are delimited in the prompt |
| Staged, resumable pipeline | Fits serverless time limits; Settings loops steps; cron loops server-side |
| Snapshots + demo fallback | App never blank; banner states what is shown; empty results never overwrite a good snapshot |
| `week_start` unique + atomic claim + Resend Idempotency-Key | Brief can never be sent twice by accident; "Resend brief" is explicit |
| Custom admin cookie (HMAC of ADMIN_KEY), throttled | Simple, no extra service; rejected: no-auth settings |
| Resend with `onboarding@resend.dev` | No domain available; free plan only delivers to the Resend account's own email, so `BRIEF_TO_EMAIL` is that address |
| Podcast RSS as reinforcement | Cheap, quota-free, show notes carry guests and sponsor reads; rescued shows that went quiet on YouTube |
| Apple directory (iTunes search) for feed discovery | Free, no key; validated by actually reading the feed |
| Windows: topics/guests 60 days, sponsors 90, lookback to 180 for rarely-posting shows, per-show cap 25 episodes | 30 days was too thin; user capped lookback at 6 months ("topics might not be relevant" beyond); cap stops one prolific show dominating |
| Only guest-interview episodes count | User: topics must come from conversations with business guests, not solo videos or news |
| Founder-only guests (role read by Gemini; unknown role gets the benefit of the doubt) | Aditya hosts founders; problem statement asks for founders ahead of the curve |
| Guests independent of topics | User request; probability keeps media-willingness and recency weights, scaled to 100% (topic fit removed) |
| Media round = 2+ shows within 30 days | Problem statement says "same month" |
| Topics ranked by simultaneous show count, then score | Problem statement: topics covered across multiple shows at once; probability still shown |
| Sponsors need 2+ shows or a paid flag | Reduce one-off mentions; "mentioned or promoted across shows" |
| Guest confirm button ("Confirmed: remove from list") | User: nothing should disappear automatically; they tell us when a guest agreed |
| Removed automatic "hide guests recommended last week" | User rejected it |
| Ten shows chosen by measured founder-episode counts | `analyze-overlap.mjs` plus a v2 re-read of all shows |
| Design: editorial "signal room" (dark, one lime accent, Instrument Serif + Geist + Geist Mono) | Research: Unseen Studio (huge type), Linear (layered dark surfaces, hairlines), Rephonic/Podscribe (entity-centred records) |
| No Lenis smooth scrolling | Risk of touch-scroll jank |
| Per-topic `Flip` highlight removed | Topic selection no longer exists (guests independent) |
| GitHub repo public | Needed for exam review; no secrets committed (scanned) |

**Tried and failed / rejected:**
- Per-topic guest lists (built, then removed on the user's request).
- Automatic exclusion of previously recommended guests (built, then removed on the user's request).
- Guessing YouTube handles for shows (many wrong or inactive); web research + page lookups worked better.
- Rephonic could not be viewed (bot check); I did not bypass it.
- PageSpeed Insights API rate-limited (HTTP 429), so no Lighthouse numbers.
- Vercel marketplace Neon install: not done (needs account/terms); user created the Neon project by hand.
- Radar text labels removed (overlapped); blips keep rank numbers matching the topic rows.
- Initial CI push blocked until `gh auth refresh -s workflow`; fixed.

---

## 5. ENVIRONMENT (names only)

Set **locally** in `podcast-radar/.env.local` (git-ignored) and in **Vercel (Production)**. After changing a Vercel variable you must **redeploy**. No secret starts with `NEXT_PUBLIC_`.

| Name | Used for | Local | Vercel |
|---|---|---|---|
| `YOUTUBE_API_KEY` | YouTube Data API v3 (key restricted to that API in Google Cloud project "My First Project", id `swift-habitat-511214-r4`) | yes | yes |
| `GEMINI_API_KEY` | Gemini Flash (Google AI Studio) | yes | yes |
| `GEMINI_MODEL` | Model name; currently `gemini-flash-latest` | yes | yes |
| `DATABASE_URL` | Neon connection string | yes | yes |
| `RESEND_API_KEY` | Resend key named "podcast-radar", sending access only | yes | yes |
| `RESEND_FROM` | Sender (`onboarding@resend.dev`) | yes | yes |
| `BRIEF_TO_EMAIL` | Recipient (the Resend account email; free tier limit) | yes | yes |
| `ADMIN_KEY` | Settings login (value is in `.env.local`) | yes | yes |
| `CRON_SECRET` | Protects cron routes | yes | yes |
| `APP_URL` | Links inside the email | yes | yes |
| `SHOW_SPONSOR_NAMES` | `true`/`false`; false masks brand names server-side | yes | yes |
| `VERCEL_OIDC_TOKEN` | Added automatically to `.env.local` by `vercel link`; not used by the app | yes | n/a |

`.env.example` documents the names. `lib/env.js` is the only reader.

---

## 6. HOW TO

**Run locally** (from `podcast-radar/`):
```
npm install
npm run dev            # http://localhost:3000 (needs .env.local; works with demo data if keys are missing)
npm test               # 50 tests, no network needed
npm run lint
npm run build
```
In the Claude desktop app the preview server is defined in the workspace file `Agent_Workspace/.claude/launch.json` as `podcast-radar` (port 3100). Use `npx vercel@latest ...` (no global Vercel CLI); `gh` is installed and authenticated with the `workflow` scope.

**Test the cron / brief manually:**
```
# refresh (uses ~32 YouTube units + a few Gemini calls)
curl -H "Authorization: Bearer <CRON_SECRET>" https://podcast-radar-alpha.vercel.app/api/cron/refresh
# Monday brief (idempotent: a week already sent returns "already")
curl -H "Authorization: Bearer <CRON_SECRET>" https://podcast-radar-alpha.vercel.app/api/cron/brief
```
Without the header both return 401. Or log in at `/settings` and press "Refresh data now" / "Send brief now" / "Resend brief". To run the pipeline from a script against the real database: `node --env-file=.env.local <script>` importing `lib/pipeline.js` (`runRefreshToCompletion`, `rescoreAndSave`).

**Deploy:** push to `main`; Vercel builds automatically and CI runs. Manual: `npx vercel@latest deploy --prod --yes`. Vercel env: `npx vercel@latest env add NAME production --value <value> --force --yes` (do not pipe values through PowerShell `|`: it adds a trailing newline that Vercel rejects for `CRON_SECRET`).

**Update the show list:** `/settings` -> "Add a show" (YouTube @handle, channel URL, channel ID, or a podcast RSS link) -> Check -> confirm -> add; set the host name so the host is never listed as a guest. Remove with the Remove button. Max 15 (auto-discovery stops adding at 10). `config/default-channels.json` only seeds an empty database.

**Useful scripts:** `scripts/analyze-overlap.mjs` (find which podcast feeds share founders; uses Gemini, about 8 calls), `scripts/check-channel.js` (real YouTube check for one channel).

---

## 7. KNOWN ISSUES AND FINDINGS

**Key finding: no founder is on a media round.** Tested three ways:
1. On the monitored YouTube shows (guest names merged): 0 of 80 guests on 2+ shows within 30 days; 2 of 203 within 180 days.
2. `scripts/analyze-overlap.mjs`: 91 candidate podcast feeds found via Apple's directory, 19 active long-form shows read (154 episodes, 8 Gemini calls): 0 founders on 2+ shows within 30 days. (The largest feeds, such as Raj Shamani's, were skipped then because of a 6 MB feed cap, since raised to 25 MB.)
3. After the final v2 re-read of the ten chosen shows: `mediaRounds = 0`.
The dashboard states this honestly ("No founder is on a media round yet") and shows the strongest single-show founders instead.

Other issues and limits:
- **Sponsor evidence is weak.** Only text is visible: spoken ad reads are invisible. Few brands are flagged paid. Many "brands" are companies merely discussed.
- **Probabilities are heuristics.** Guest/sponsor "probability" is a weighted index, not a calibrated chance. Topic probability is `(hits+1)/(n+2)` on mature videos. RSS episodes have no view counts, so the views part of the topic score is dropped for them (can leave some topics at 50%).
- **Business Today** is a news channel; its guests are mostly analysts (filtered out by the founder rule), so it contributes few founders.
- **Keyword fallback is poor** (it can invent plausible-looking junk names; a stop-list reduces this). It only runs if Gemini fails.
- **Stale `running` rows** can remain in the `runs` table if a refresh is interrupted (no timeout cleanup). One such row existed at the time of writing. Harmless but untidy.
- **Old data:** 237 rows of prompt-version `v1` extractions are unused (v2 is current).
- **Email deliverability:** sent from `onboarding@resend.dev` to a single address; may land in spam; cannot send to other recipients without a verified domain.
- **Auth:** admin session token cannot be revoked except by rotating `ADMIN_KEY`.
- **Docs drift:** `DECISIONS.md` (D4 still says guests per topic) and `PROGRESS.md` (milestone log) are outdated; `COMPONENTS_MAP.md` has not been updated for RSS/auto-reinforcement/topic-independent guests (the SVG diagram is current).
- **Throwaway scripts:** `scripts/probe.mjs`, `scripts/probe2.mjs` are one-off probes and can be deleted.
- Mobile layout was only partly polished (overflow fixed; no further phone work wanted).

---

## 8. NOT YET VERIFIED

- **Whether the Monday email arrived and how it renders** (phone, desktop, dark mode, spam folder). The database says it was sent at 05:56 IST on 2026-10-12; nobody has opened it.
- **Content of that cron-sent brief:** it was built from the data at that moment (before the final show change); not inspected.
- **Lighthouse scores** (target Performance 85+, Accessibility 95+, Best Practices 95+): not measured (PageSpeed API returned 429). Could try `npx lighthouse` locally or the PSI API with a key.
- **Keyboard/screen-reader accessibility** of the redesign, and contrast: not audited.
- **Settings and briefs pages visually after the redesign:** the shared CSS changed; those pages were not re-inspected in a browser. Functionally they were exercised through the API only.
- **Animation behaviour with real scrolling on all sections** after the last edits: desktop sections were viewed with final states visible; mobile was caught mid-animation once. No-JS and reduced-motion paths were not re-tested after the redesign.
- **Auto-discovery on live data** has never added a real show (live data is not thin by its own thresholds); it is proven by tests and a dry run against Apple's directory only.
- **Gemini free-tier limits** (daily/minute) under heavier use: only observed to work for about 20 calls per refresh.
- **Whether `gemini-flash-latest` stays stable** (it is an alias).

---

## 9. NEXT STEPS (prioritised)

1. **Check the email** in the inbox (and spam) for 2026-10-12 and 2026-10-05; report how it looks. Fix rendering if needed. Consider verifying a domain in Resend if delivery to other addresses is needed.
2. **Update `COMPONENTS_MAP.md`** to include the Podcast RSS + Apple directory lane, auto-reinforcement, founder roles, and the changes from the first version; make sure `components-map.svg` is what gets submitted (or export it as an image/PDF).
3. **Lighthouse run** (local `npx lighthouse` or PSI with a key) and fix anything under target.
4. **Look at Settings and `/briefs` in a browser** after the redesign; fix visual regressions.
5. **Improve the media-round signal:** consider adding more large Indian founder shows (up to 15 allowed) or re-running `scripts/analyze-overlap.mjs` periodically; the honest "none" message is already in place.
6. **Sponsor quality:** consider showing "Likely advertiser" brands separately, or a stricter list; improve detection using show-note sponsor segments.
7. **Housekeeping:** delete `scripts/probe*.mjs`, clean stale `running` rows (add a timeout), refresh `DECISIONS.md`, `PROGRESS.md`, `README.md` so they match the code.
8. **Optional:** revoke-able admin sessions; per-show weights.

### Submission checklist
- [ ] **Public URL** works: https://podcast-radar-alpha.vercel.app (verified 200 with the new design)
- [x] **GitHub repo** link: https://github.com/souvikpati-bit/podcast-radar (public, CI green)
- [ ] **Components Map**: `components-map.svg` exists; `COMPONENTS_MAP.md` needs updating (see step 2). Mention the changes from the first version: exactly 6 topics, Review Gate shortlist, fallback chain (live -> snapshot -> demo), the two crons in UTC (`30 20 * * *`, `0 0 * * 1`), RSS lane, founder-only guests.
- [x] Gemini Flash only (test `tests/no-other-ai.test.js`)
- [x] Show list configurable without code (Settings)
- [x] Monday brief scheduled and fired once (unverified in inbox)
- [x] Live data with fallback (demo data bundled)
- [ ] Lighthouse and email render checks (section 8)

---

## 10. FIRST MESSAGE FOR THE NEW SESSION

Paste this:

> I'm continuing the Podcast Ecosystem Radar project in `C:\Users\Souvik PI\Desktop\Agent_Workspace\podcast-radar`. Before doing anything, read `HANDOFF.md` and `CLAUDE.md` in that folder completely. Then tell me in five lines what the project is, what is live, and what you plan to do first. Rules: never ask me to paste keys in chat (keys live only in `.env.local` and Vercel), never print secrets, be careful with API quota (YouTube 10,000 units/day, report units used), do not touch mobile layout, and ask before anything that needs a card or a paid plan. Start with the "Next steps" list in HANDOFF.md section 9.

---

## Addendum (2026-10-13): Trends block, login block, dashboard blocks
- Main page is now seven clickable blocks (01 Login, 02 Topics, 03 Trends, 04 Founders, 05 Sponsors, 06 Shows, 07 How it works); Settings has four. Component: `components/BlockTabs.jsx`.
- Show list max is 10 (`config/pipeline.json` maxChannels); add/remove is on the main page and in Settings after login (`components/ChannelManager.jsx`).
- Trends: `lib/trends.js` + `config/trend-articles.json` fetch Wikipedia daily page views over 16 weeks, baseline = 16-week average (no key, polite pacing, failures never break a refresh) and are stored in the snapshot as `results.trends`; each topic also has `weeklyShows` (distinct shows covering it per week, last 12 weeks; counting shows not episodes because high-volume shows such as Business Today have no older history stored). Chart: `components/TrendChart.jsx`. `scripts/rescore.mjs` re-scores and refreshes trends with no YouTube/Gemini quota.
- Google Trends is NOT used: the official API is alpha-by-application and scraping is unreliable. Wikipedia page views are the stand-in.
- Removed from the front page at the user's request: the intro paragraph, the scrolling show ticker, and the media-round stat.
- Components Map was redrawn: `components-map.pdf/png/svg`. `CODE_FLOW.md` explains the code flow.
- Founders are now two tiers: 7 top picks (`results.guests`) and up to 8 'More to consider' (`results.moreGuests`, config `counts.moreGuests`), ranked in one order; the Monday email still uses the top picks. The new tier shows after the next re-score or refresh. Sponsors are unchanged for now (data supports about 9 real ones; a 'likely advertisers first' layout was proposed, not built).
