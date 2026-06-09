# Build Walkthrough — Claude trigger, roles, comments, live updates

What we just added to the prototype and how each piece works, plus how to turn it on and the path to production. Everything below is already written into `858-pm-app/` — this walks you through running and understanding it.

---

## What's new
1. **Claude is the trigger.** A "Start a plan with Claude" box on the home page. You describe an event in one sentence; Claude reads your task template library and writes the whole plan into Supabase.
2. **Roles / access on a webpage.** Christina + Fern = master (full control). Nic, Juan, Chris, Marty = view everything, comment on anything, edit only their own tasks.
3. **Comments** on every task — in-app now, and ready to receive comments from Slack.
4. **Near-live updates** — already on; anyone with the page open sees changes within ~a second.

---

## Turn it on (15 min, one time)
1. **Run the new SQL.** Supabase → SQL Editor → run `supabase/02-comments.sql`.
2. **Add your Claude key** to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...` (from console.anthropic.com → API Keys).
3. **Enable real-time** for the `comments` table too (Database → Replication), alongside tasks/workstreams/guests/seating_tables.
4. `npm run dev` → open http://localhost:3000.

---

## How each piece works

### 1. Claude as the trigger — `app/api/generate/route.js`
- The home page POSTs your sentence to `/api/generate`.
- The route sends Claude (a) a system prompt with your **template library** (`lib/templateLibrary.js`, generated from your real 71 tasks) and (b) your sentence.
- Claude must answer through a **tool** called `create_plan` — that forces a clean, structured result (project name, workstreams, tasks with owners/dates), no guessing about format.
- The route writes that result into Supabase: one project → its workstreams → their tasks.
- You land on the new project's board. **That write is the trigger** — the dashboard, comments, and (later) Slack all flow from it.

To test: on the home page, edit the sentence and hit **Generate plan**. A new project appears, populated.

### 2. Roles — `lib/roles.js` + the "Acting as" switcher
- `lib/roles.js` defines who is master vs member and the rule `canEditTask` (members can edit a task only if they own it).
- In the prototype, the current person is chosen with the **Acting as** dropdown (top right) — a stand-in for logging in. The board reads it and:
  - **Masters** see the Claude box, "+ Add task", "+ Add workstream", and can edit every task.
  - **Members** see everything, can comment on every task, but their status/date controls are locked except on tasks they own.
  - **JG** is a member who additionally can build/edit the **seating chart** (canEditSeating in lib/roles.js) for assigned-seating events; other members see seating read-only.
- Demo it live: switch from Christina (master) to Nic (member) and watch the controls lock down.

### 3. Comments — `comments` table + thread UI
- Each task has a **💬 comments** toggle. Anyone signed in can post; comments save to Supabase and appear for everyone in real time.
- Comments carry a `source` field. App comments show plainly; Slack-originated ones get a **"via Slack"** badge — so when the Slack wiring is on, those messages land right here in the thread.

### 4. Near-live updates — Supabase real-time
- Every page subscribes to changes on its tables and reloads on any change. So if Nic has the plan open and Christina moves a date, Nic sees it within ~a second — no refresh, no stale copy. Open two browser windows to see it.

---

## The Slack layer (commenter + completer) — no Zapier needed
**The webpage is the primary place to edit and comment** (status, dates, add tasks, comment threads — all native to the board). Slack is a *second* channel for people who live there; anything done in Slack syncs to the page and vice versa. Two directions:

**App → Slack (notify):** Supabase **Database Webhook** on the `tasks` table fires a Supabase **Edge Function** that posts to a Slack Incoming Webhook ("@Nic — 'Client prep call' needs review").

**Slack → App (comment & complete):**
- *Comment:* a Slack message/reply hits a small **Next.js route** (e.g. `/api/slack`) that inserts a row into `comments` with `source = 'slack'` — it shows up in the task thread live.
- *Complete (no typing):* a ✅ reaction or a "Mark complete" button hits the same route, which sets the task `status = 'done'`. No login, no Zapier.

(When you're ready I'll write `/api/slack` and the Edge Function — it's the next route after this one.)

---

## Prototype vs production
- **Auth:** the "Acting as" switcher stands in for login. For production, swap it for **Supabase Auth** (Google or email) and read the signed-in user instead of the dropdown. The `members` table in `02-comments.sql` is there for that.
- **Security:** the schema ships with row-level security OFF so the prototype just runs. Before anyone outside the team uses it, turn RLS **on** and add policies that mirror `lib/roles.js`: everyone can read; masters can write anything; members can update only rows where `owner` includes their name; anyone can insert comments. I can generate those policies when you're ready.

---

## Quick test script for your own confidence
1. Generate a plan with Claude from a one-line prompt → it populates.
2. As **Christina**, change a status and a date, add a task → all save.
3. Switch **Acting as → Nic** → his controls lock except his own tasks; he can still comment everywhere.
4. Open a second window as **Christina**, change something → it appears in Nic's window within a second.

---

## Attachments & staying iterative (v3)
- **Attachments:** `attachments` table + a public Supabase **Storage** bucket named `attachments`. Each task can hold uploaded files (PDF/image/doc) and links (dossiers). Anyone signed in can attach; it syncs live like comments. Files: `supabase.storage.from('attachments').upload(...)` → public URL saved in the table.
- **Add an activation / tasks the easy way:** `/api/extend` takes a sentence + the project id, has Claude pull the right tasks from the template library, and appends them (reusing a workstream when one fits, else creating a new one). Manual `+ Add task` / `+ Add workstream` stay for one-offs.
- **Why this is "iterative":** nothing here requires a rebuild. New event format? Tell Claude or add a workstream. New file to share? Drop it on the task. As you tag new tasks into the library, future plans generate them automatically.

---

## The learning library (v4) — forever vs one-off
- **`library_tasks` table** is the persistent template. `04-library.sql` creates it and seeds your 71 tasks. `lib/serverLibrary.js` loads it for `/api/generate` and `/api/extend` (falls back to the bundled `templateLibrary.js` if empty).
- **Default = one-off.** A task added to an event lives only on that event until someone promotes it.
- **Promote:** per task, masters get **☆ Save to library forever** / **Make one-off**; per workstream, **★ Save workstream to library** (upsert on `workstream,title`, so no dupes).
- **Result:** the library compounds. Recurring tasks ("get a mic") become defaults Claude reproduces every time; event-specific tasks ("second mic for Q&A") stay one-offs. That's the feedback loop that makes generation better each event — and it's all data, no code changes.
