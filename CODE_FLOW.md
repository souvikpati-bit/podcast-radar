# Code flow: Podcast Ecosystem Radar

How the code builds the page, in plain language. Part 1 covers a visitor opening the page. Part 2 covers where the data comes from.

## 1. What happens when someone opens the page

```
Browser asks for  /
   │
   ▼
app/layout.js            fonts, page frame, security headers (set in next.config)
   │
   ▼
app/page.js              the main page, built on the server each time
   ├─ getDashboardData()      lib/snapshot.js   → latest saved results
   ├─ isAdminPage()           lib/session.js    → is Aditya logged in?
   ├─ actionMap()             lib/actions.js    → his Review Gate choices (only if logged in)
   └─ listChannels()          lib/channels.js   → the 10 tracked shows
   │
   ▼
Page is assembled from components:
   TopBar          navigation links
   Hero            the radar picture + headline (topics become the dots)
   Banner          says whether data is live, saved, or demo
   Marquee         scrolling list of show names
   BlockTabs       the five clickable blocks, one panel visible at a time
     ├─ Topics    → TopicsPanel   (Dashboard.jsx)
     ├─ Founders  → GuestsPanel   (Dashboard.jsx)
     ├─ Sponsors  → SponsorsPanel (Dashboard.jsx)
     ├─ Shows     → ChannelManager (list, login box, add/remove)
     └─ How it works → Method
   MotionRoot      all the animation, added after the page loads
```

**Data fallback.** `lib/snapshot.js` tries three sources in order: the last live result saved in the Neon database, then an older saved copy, then the built-in demo data (`lib/demo.js`). The banner tells you which one you are seeing.

**Adding or removing a show.** In `ChannelManager`, the login box posts to `/api/login`. After that, Add and Remove post to `/api/channels`. That route checks the admin cookie, then calls `lib/channels.js` to save to the database. The list is capped at 10 (`config/pipeline.json`, `maxChannels`).

## 2. How the data gets there

This runs on a schedule, so the page never waits for it.

```
Vercel cron (vercel.json)
   daily 02:00 IST  → /api/cron/refresh
   Monday 05:30 IST → /api/cron/brief
   │
   ▼
lib/pipeline.js  runs five steps in order:
   1 init       open a run record
   2 fetch      YouTube shows: lib/youtube.js (uploads list + view counts)
                podcast-feed shows: lib/rss.js (episode lists)
   3 extract    lib/extract.js asks Gemini (lib/gemini.js) for guests, roles,
                topics and brands in each episode. Every name is then checked
                against the episode text, so nothing is invented.
   4 reinforce  lib/discover.js fills thin shows from podcast feeds automatically
   5 score      lib/scoring.js ranks topics, founders and sponsors
                (numbers come from config/scoring.json)
   │
   ▼
Result saved as a snapshot in Neon  →  this is what app/page.js reads
   │
   ▼
Monday only: lib/brief.js builds the email and sends it through Resend,
and keeps a copy in the database
```

## 3. Folder guide

| Folder | What lives there |
|---|---|
| `app/` | The pages (`/` and `/settings`) and the API routes |
| `components/` | The visible pieces of the page |
| `lib/` | All the logic: fetching, AI, scoring, email, database |
| `config/` | The numbers you can tune, plus the default list of shows |
| `migrations/` | The database tables, created automatically |
| `tests/` | 50 automatic checks |

All secrets (keys) are read in one place, `lib/env.js`. All AI calls go through `lib/gemini.js`, which only uses Gemini Flash.
