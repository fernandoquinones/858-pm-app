# Server-side CREATE scanner — setup

The scanner lives at `/api/scan/run` and is triggered by Vercel Cron (8am/1pm/5pm ET).
It reads Nic's + JG's calendars via Google, uses the Anthropic API to build the matrix,
and writes to Supabase. No Claude sandbox, so the org egress allowlist doesn't apply.

## Environment variables to add in Vercel (Settings → Environment Variables, Production)

| Var | Where it comes from |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth client (step 1) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client (step 1) |
| `GOOGLE_REFRESH_TOKEN` | OAuth Playground (step 2) |
| `CRON_SECRET` | the value printed in chat (gates the endpoint; Vercel Cron sends it automatically) |
| `ANTHROPIC_API_KEY` | already set |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | already set |

## Step 1 — Google Cloud OAuth client (~5 min)

1. Go to https://console.cloud.google.com → create/select a project (e.g. "858 Ops").
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **Internal** (since 858partners.com is a Google Workspace). Internal = no test-user limit and refresh tokens that DON'T expire in 7 days. (If "Internal" is greyed out, you're not a Workspace admin — use External + add yourself as a test user, but then re-mint the token if it stops working.)
   - App name "858 Ops", your email, save.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Type: **Web application**.
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
   - Create → copy the **Client ID** and **Client secret** → these are `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Step 2 — Mint the refresh token (~3 min)

1. Go to https://developers.google.com/oauthplayground
2. Click the **gear icon** (top right) → check **"Use your own OAuth credentials"** → paste your Client ID + Secret.
3. In the left scope box, paste: `https://www.googleapis.com/auth/calendar.readonly`
4. Click **Authorize APIs** → sign in as **fernando@858partners.com** → allow.
5. Click **Exchange authorization code for tokens**.
6. Copy the **Refresh token** → this is `GOOGLE_REFRESH_TOKEN`.

(This works because Nic's and JG's calendars are already shared to fernando@ with "See all event details" — your token can read them.)

## Step 3 — Deploy + test

1. Add all the env vars above in Vercel, then **redeploy** (env changes need a new deploy).
2. Manual test: visit `https://858-pm-app.vercel.app/api/scan/run?secret=<CRON_SECRET>` in your browser.
   - Success looks like: `{"ok":true,"project":"CREATE 2026","events":{"nic":N,"jg":M},"updated":21,"flags":4}`
   - Then open the Client Hub — the matrix + flags are populated.
3. The Vercel Cron (in `vercel.json`) then runs it automatically at 8am/1pm/5pm ET.

## Notes

- **Vercel plan:** 3 crons/day requires a **Pro** plan. On Hobby, Vercel allows fewer/daily-only crons — if the deploy warns, drop to one daily cron (or ping the endpoint from an external scheduler). The endpoint itself works regardless; only the auto-schedule is plan-limited.
- **DST:** cron times are UTC (12/17/21 = 8am/1pm/5pm EDT). In winter (EST) they'd land at 7am/12pm/4pm; adjust `vercel.json` to 13/18/22 if you want to hold ET.
- Once this is confirmed working, disable the recurring Claude task (`create-meeting-scan`) so only one scheduler writes; keep it as a manual "scan now."
