# Slack — the second channel (setup)

This turns on the live two-way Slack integration: the app pings a channel when a task needs attention, and people can **✅ react**, click **Mark complete**, or **reply in the thread to comment** — all syncing back to the web app. The webpage stays the primary place to work; Slack is the second door.

You need a Slack workspace where you can add an app. ~20 minutes. The app must be reachable at a public URL, so do this **after** deploying to Vercel (or use a tunnel like ngrok for local testing).

---

## 1. Create the Slack app
1. Go to **api.slack.com/apps → Create New App → From scratch**. Name it "858 Project Tool", pick your workspace.
2. **OAuth & Permissions → Bot Token Scopes**, add exactly these **4** (private-channel set): `chat:write`, `groups:read`, `groups:history`, `reactions:read`. **Do NOT add** `channels:join` (invite the bot manually instead), the `channels:*` scopes (those are for public channels — your rooms are private), or `users:read` (optional polish only). Install the app to the workspace.
3. Copy the **Bot User OAuth Token** (`xoxb-…`) → `.env.local` as `SLACK_BOT_TOKEN`.
4. **Basic Information → Signing Secret** → `.env.local` as `SLACK_SIGNING_SECRET`.
5. In Slack, create/choose a channel (e.g. `#project-plans`), invite the app to it, and copy its **Channel ID** (channel details → bottom) → `.env.local` as `SLACK_CHANNEL_ID`.

## 2. Point Slack at your routes
Use your deployed base URL (e.g. `https://858-pm.vercel.app`).
- **Event Subscriptions** → enable → Request URL: `https://YOUR-URL/api/slack/events`. Slack will verify it (the route answers the handshake automatically). Under **Subscribe to bot events**, add: `reaction_added`, `message.groups`.
- **Interactivity & Shortcuts** → enable → Request URL: `https://YOUR-URL/api/slack/interactions`.
- Reinstall the app if Slack prompts you.

## 3. Add the keys + run the SQL
- `.env.local`: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID` (see `.env.local.example`).
- Run `supabase/05-slack.sql` (creates the `slack_links` mapping table).
- Redeploy / restart.

---

## How it flows
- **App → Slack:** when any task is set to **Needs review**, `/api/slack/notify` posts a message to the channel with a **Mark complete** button, and stores that message's id mapped to the task (`slack_links`).
- **Slack → App (no typing):** a ✅ reaction on that message, or clicking **Mark complete**, sets the task to **done** in Supabase — which updates everyone's web view live.
- **Slack → App (comment):** replying in the message's thread posts a comment on that task, tagged **via Slack**, visible in the task's thread on the page.

## Notes
- Every Slack request is signature-verified (`lib/slackVerify.js`) so only real Slack calls are accepted.
- Want pings for other moments (seating no-show, task assigned)? Call `/api/slack/notify` with that `taskId` from anywhere — same plumbing.
- This is the no-Zapier path: it's your own routes talking to Slack directly. (You could also drive `/api/slack/notify` from a Supabase Database Webhook instead of the app, if you'd rather not depend on the browser firing it.)

---

## Per-event rooms (you already have the channels)
Each event/project connects to **its own existing Slack channel** — pings for that event go only to that room. Library stays shared across all events; the channel is per event.

**Connect a room:** open a project → the **"Connect this event to its Slack room"** card → pick the existing channel → **Connect room**. **First invite the bot to that channel in Slack** (`/invite @858 Project Tool`), then pick it and Connect — the app posts a confirmation. To move it later, use **Change room**. (`SLACK_CHANNEL_ID` in `.env.local` is now just an optional fallback for events with no room linked.)

How routing works: `/api/slack/notify` looks up the project's `slack_channel_id` and posts there; the message id is stored per channel in `slack_links`, so a ✅ reaction, the Mark-complete button, or a thread reply in *that* room updates *that* event's task. Different events, different rooms, no cross-talk.

> Prefer the app to spin up a brand-new channel per event instead of linking an existing one? That path also exists (`/api/slack/create-channel`) and just needs the `channels:manage` scope — but since your rooms already exist, connecting is the default.
