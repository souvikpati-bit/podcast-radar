# Podcast Ecosystem Radar

A dashboard plus a Monday-morning email for Aditya, who hosts an English podcast for startup founders. It watches up to 15 YouTube podcast channels and ranks: **6 topics to cover**, **up to 7 guests to book** for the chosen topic, and **up to 5 sponsors to pitch**. Aditya makes every decision. The system never contacts a guest or a sponsor.

Live: https://podcast-radar-alpha.vercel.app

## How it works

1. **Refresh** (daily cron + "Refresh data now"): fetches recent uploads per channel (YouTube Data API v3, never `search.list`), reads the video text with Gemini Flash (keyword fallback), and scores everything in `lib/scoring.js` (weights in `config/scoring.json`).
2. The result is saved as a **snapshot** in Neon. The dashboard and the email both read that same snapshot, so numbers never differ.
3. **Fallback chain**: live data, then the last good snapshot, then bundled demo data. The banner always says which one you are seeing.
4. **Monday brief** (cron): sends the email via Resend and stores it for `/briefs/<date>`. Idempotent per week.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
npm test && npm run lint && npm run build
```

### Environment variables (set in `.env.local` and in Vercel for **Production**, then **redeploy**)

| Variable | What it is | If missing |
|---|---|---|
| `YOUTUBE_API_KEY` | Google Cloud, YouTube Data API v3 (restrict the key to that API) | demo data + banner |
| `GEMINI_API_KEY` | Google AI Studio | keyword fallback |
| `GEMINI_MODEL` | a Flash model, default `gemini-2.5-flash` | default |
| `DATABASE_URL` | Neon Postgres connection string | demo data only |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend; start with `onboarding@resend.dev` | "Send brief" explains |
| `BRIEF_TO_EMAIL` | recipient (free Resend only delivers to your own Resend account email) | no email |
| `ADMIN_KEY` | Settings login | settings locked |
| `CRON_SECRET` | protects cron routes | cron returns 401 |
| `APP_URL` | links inside the email | Vercel URL |
| `SHOW_SPONSOR_NAMES` | `true` or `false` | true |

The database tables are created automatically on first use (`migrations/001_init.sql`).

## Cron (Vercel Hobby, UTC)

- `30 20 * * *` runs `/api/cron/refresh` (about 02:00 IST). It also retries a missing or failed brief for the current week.
- `0 0 * * 1` runs `/api/cron/brief` (05:30 IST Monday; Hobby may drift up to an hour, still before 07:00). It refreshes first if data is older than 12 hours.

Both routes need `Authorization: Bearer $CRON_SECRET` (Vercel adds it automatically).

## Adding a channel

Log in at `/settings`, type a `@handle`, channel URL or channel ID, press **Check channel**, confirm the name and picture, then add. Set the host name so the host is never listed as a guest.

## Rules enforced by tests

Gemini Flash is the only AI (a test scans the source for any other AI SDK or URL); no secret uses `NEXT_PUBLIC_`; guest and brand names must appear in the video text; hidden likes are missing, not zero; the brief never sends twice; admin and cron routes return 401 without credentials.

## Docs

`CLAUDE.md` (context), `DECISIONS.md`, `GLOSSARY.md`, `PROGRESS.md`, `COMPONENTS_MAP.md`.
