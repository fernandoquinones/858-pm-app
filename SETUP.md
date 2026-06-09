# 858 Project Tool — Prototype Setup

The real app: Next.js + Supabase, seeded with your actual Create plan. Everything's written — you just create a free Supabase project and paste two keys. ~15 minutes.

When it's running you'll have: a multifunction project board (your 13 workstreams, 61 tasks, add tasks/workstreams on the fly, owners, due dates, statuses) and a seating board — both **saving to a real database and syncing live between you and Christina.**

---

## What you need first
- **Node.js 18+** — check with `node -v`. If missing, install from nodejs.org.
- A **Supabase** account (free) — supabase.com.

---

## Step 1 — Create the Supabase project
1. supabase.com → **New project**. Name it `858-pm`, set a database password (save it), pick a nearby region. Wait ~2 min.

## Step 2 — Create the tables
1. Left sidebar → **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this folder, paste the whole thing in, click **Run**. (You should see "Success".)

## Step 3 — Load your real data
1. New query again. Open `supabase/seed.sql`, paste, **Run**. This loads the CFO Luncheon project, your 13 workstreams, 61 tasks, 5 tables, and a sample guest list.

## Step 4 — Turn on real-time sync
1. Sidebar → **Database → Replication** (newer projects: **Database → Publications**).
2. Enable the publication for these tables: `tasks`, `workstreams`, `guests`, `seating_tables`.
   *(This is what makes two people see each other's edits instantly.)*

## Step 5 — Get your keys
1. Sidebar → **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.

## Step 6 — Plug in the keys
1. In this folder, duplicate `.env.local.example` and rename the copy to `.env.local`.
2. Paste your two values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ....
   ```

## Step 7 — Run it
In Terminal:
```bash
cd "path/to/858-pm-app"      # this folder
npm install                  # one time, ~1 min
npm run dev
```
Open **http://localhost:3000**. You'll see the project list → click **CFO Luncheon** → the live board.

---

## Try the two things that matter
1. **It persists:** change a task's status or date, refresh the page — it stuck (it's in the database, not the file).
2. **It syncs:** open `http://localhost:3000` in two browser windows side by side. Change something in one — it updates in the other within a second. **That's the version-drift problem solved.**

Also try: **+ Add task** inside any workstream, and **+ Add workstream** at the bottom — that's the "add as we go" capability. The seating board (top-right link) does move/swap, no-show, and seat-from-waitlist.

---

## Notes & what's next
- **Security:** the schema ships with row-level security **off** so the prototype just works. Before anyone outside the team touches it, turn RLS on and add policies (or I can add Supabase auth).
- **Not built yet (next milestones):** Slack/Zapier notifications, the "type a sentence → generate a plan" feature, and deploying to Vercel for a shareable URL. The build-runbook in the parent folder covers all three.
- **Reset the data:** re-run `seed.sql` after a `truncate` if you want a clean slate (ask me and I'll give you the reset script).

If anything errors on `npm run dev`, copy the message to me and I'll fix it.

---

## v2 additions — Claude generate, roles, comments

A few extra one-time steps unlock the new pieces:

**More tables.** In Supabase SQL Editor, run `supabase/02-comments.sql` (adds the comments table). Your existing data is untouched.

**Claude API key.** In `.env.local`, add:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Get it at console.anthropic.com → API Keys. This is server-side only — never prefix it with `NEXT_PUBLIC`.

**Restart** `npm run dev` so it picks up the new key.

Now the home page has a **✨ Start a plan with Claude** box (describe an event → Claude builds the whole plan into the database), every task has a **💬 comments** thread, and the **Acting as** switcher (top right) lets you demo the access tiers. See `BUILD-WALKTHROUGH.md` for how each piece works and the production auth path.

---

## v3 additions — attachments + iterative "add to plan"

**Run more SQL.** In Supabase SQL Editor, run `supabase/03-attachments.sql`.

**Create a Storage bucket.** Supabase → **Storage → New bucket** → name it exactly **`attachments`** → toggle it **Public**. (This is where uploaded files/PDFs/images live; the app saves their link.)

**Enable real-time** for the `attachments` table too (Database → Replication).

Now, inside any task (click **💬 · 📎**): upload a file/PDF/image, or paste a **link** (e.g. a Notion dossier) with a label. And on the project board, masters get **✨ Add to this plan with Claude** — type "Add a GRIP Meetings activation" and Claude appends those tasks from your library. "+ Add task" and "+ Add workstream" remain for one-offs.

### The easiest way to stay iterative
1. **New activation or batch of tasks → tell Claude** ("Add a bird-circles activation"). It pulls the tagged tasks from your library and appends them.
2. **One-off task or workstream → "+ Add" buttons** on the board.
3. **The library grows:** when you run something new, those tasks become part of the template (re-export the CSV / add rows), so next time Claude generates them automatically. That feedback loop is what makes it better every event.

---

## v4 — the library that learns (save forever vs one-off)

**Run more SQL.** In Supabase SQL Editor, run `supabase/04-library.sql`. It creates the `library_tasks` table and seeds it with your current 71-task template, so the library starts full.

**Enable real-time** for `library_tasks` too.

Now the template library lives in the database, and Claude reads from it (the generate + add-to-plan boxes pull the live library, falling back to the bundled copy only if the table is empty).

**How the choice works (masters):** every task added to an event is a **one-off by default** — it stays only on that event. Open a task and you'll see **☆ Save to library forever** — click it to make that task a default for its workstream/activation going forward (and **Make one-off** to undo). Each workstream also has **★ Save workstream to library** to promote all its tasks at once.

So: *"every presentation needs a mic"* → save that task to the library forever. *"this one needs a second mic for Q&A"* → leave it as a one-off on this event. Next time you generate or add a presentation activation, the mic comes back automatically; the second mic doesn't.

---

## v5 — live Slack (second channel)
Optional, best done after deploying. Run `supabase/05-slack.sql`, add `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` / `SLACK_CHANNEL_ID` to `.env.local`, and follow **SLACK-SETUP.md** to create the Slack app and point it at `/api/slack/events` and `/api/slack/interactions`. Then: set a task to "Needs review" → it posts to Slack with a Mark-complete button; a ✅ reaction, the button, or a thread reply all sync back to the web app.
