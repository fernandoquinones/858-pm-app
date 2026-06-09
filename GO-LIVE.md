# 858 Project Tool — GO LIVE

Do these in order. Each step has a ✅ checkpoint. End state: a shareable web URL, Claude building plans, live sync, and per-event Slack rooms. Budget ~45–60 min. (✓ The app already passes a clean production build, so there's nothing to fix in the code.)

If anything errors, copy the message to me and I'll fix it.

---

## 0) Accounts you'll need (all free to start)
GitHub, Supabase, Vercel, Anthropic (console.anthropic.com), and admin on your Slack workspace. Install **Node 18+** locally only if you want to run it on your machine too (optional once it's on Vercel).

---

## 1) Put the code on GitHub
From the `858-pm-app` folder in Terminal:
```bash
cd "858-pm-app"
git init && git add -A && git commit -m "858 project tool"
```
Create an empty repo at github.com (e.g. `858-pm-app`), then:
```bash
git remote add origin https://github.com/YOURNAME/858-pm-app.git
git branch -M main && git push -u origin main
```
✅ Code shows up in the GitHub repo. (`.env.local` is gitignored — keys never get pushed.)

---

## 2) Supabase — database, files, live sync
1. supabase.com → **New project** (name `858-pm`, save the DB password, nearby region). Wait ~2 min.
2. **SQL Editor → New query** → run these files from `supabase/`, **in this order**:
   - `schema.sql`
   - `02-comments.sql`
   - `03-attachments.sql`
   - `04-library.sql`  ← seeds your 71-task library
   - `05-slack.sql`
   - `06-project-slack.sql`
   - `seed.sql`  ← optional: loads a sample CFO Luncheon to demo. Skip for a clean slate.
3. **Storage → New bucket** → name exactly **`attachments`** → make it **Public**.
4. **Database → Replication** → enable for: `tasks`, `workstreams`, `comments`, `attachments`, `guests`, `seating_tables`, `library_tasks`.
5. **Project Settings → API** → copy the **Project URL** and **anon public key**.
✅ Tables exist, `library_tasks` has ~71 rows, the `attachments` bucket is public.

---

## 3) Anthropic key
console.anthropic.com → **API Keys** → create one (`sk-ant-…`). Keep it handy.
✅ You have the key.

---

## 4) Deploy to Vercel → your live URL
1. vercel.com → **Add New → Project** → import the `858-pm-app` repo.
2. Before deploying, add **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `ANTHROPIC_API_KEY` = your Anthropic key
3. **Deploy.** In ~1–2 min you get a URL like `https://858-pm.vercel.app`.
✅ Open the URL → you see the home page. Click **Generate plan** with a sentence → a new project appears. Open two windows and edit one → the other updates live.

> Note: Vercel Hobby is non-commercial; for real business use switch the project to **Pro (~$20/mo)**. Supabase free pauses after a week idle and has no backups — **Pro ($25/mo)** for always-on + backups.

---

## 5) Slack — per-event rooms (you already have the channels)
1. api.slack.com/apps → **Create New App → From scratch** → your workspace.
2. **OAuth & Permissions → Bot Token Scopes**: `chat:write`, `reactions:read`, `channels:history`, `channels:read`, `groups:read`, `channels:join`, `users:read`. **Install to Workspace.**
3. Copy the **Bot User OAuth Token** (`xoxb-…`) and the **Signing Secret** (Basic Information).
4. Add both to **Vercel → Project → Settings → Environment Variables**: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`. **Redeploy** (Vercel → Deployments → Redeploy) so they take effect.
5. **Event Subscriptions** → enable → Request URL: `https://YOUR-URL/api/slack/events` (it auto-verifies). **Subscribe to bot events**: `reaction_added`, `message.channels`.
6. **Interactivity & Shortcuts** → enable → Request URL: `https://YOUR-URL/api/slack/interactions`. Reinstall if prompted.
✅ Slack shows the Request URLs as **Verified**.

### Connect each event to its room
In the app, open a project → **"Connect this event to its Slack room"** → pick the existing channel → **Connect room**. (The bot joins it and posts a hello.)
✅ Set a task to **Needs review** → a message with a **Mark complete** button posts in that room. React ✅ or click the button → the task flips to done on the webpage. Reply in the thread → it appears as a comment "via Slack".

---

## 6) Go-live smoke test (2 min)
1. **Generate** a real upcoming event from a sentence.
2. **Connect** its Slack room.
3. Set a task to **Needs review** → confirm the Slack ping → ✅ react → confirm it's done on the page.
4. Drop a **dossier link** and a **file** on a task.
5. Switch **Acting as → Nic** → confirm he's view + comment only; **JG** → confirm he can edit the seating chart.
6. Share the URL with the team.
🎉 Live.

---

## 7) Before you widen access (important)
The prototype ships with database security (RLS) **off** so setup is painless — fine for your internal team behind a shared URL, but anyone with the link could write. **Before sharing beyond the core team**, ask me to:
- Turn on **Supabase Auth** (Google/email login) so the "Acting as" switcher becomes real sign-in, and
- Turn on **RLS policies** that mirror `lib/roles.js` (read for all; masters write anything; members edit only their own; comments open).

That's the one hardening step between "team prototype" and "open it up." I can generate those policies whenever you're ready.
