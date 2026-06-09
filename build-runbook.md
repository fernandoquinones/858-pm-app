# Build Runbook — 858 Project Tool (multifunction, with seating module)

*Follow-along instructions to build the real web app: a multifunction project manager where Christina can create workstreams and add tasks on the fly, with luncheon seating as one module. Stack: Next.js + Supabase + Vercel + Slack/Zapier.*

**Who does this:** you, working alongside Claude (paste the prompts where noted). A developer could pick this up at any phase. Total to a working internal version: ~1–2 focused days.

**Mental model:** Supabase = the one true copy of all data (projects, tasks, guests). Next.js = the screens. Vercel = the public URL. Claude = writes/edits the screen code. Zapier = the Slack bridge.

---

## Phase 0 — Accounts & tools (≈15 min)

1. Create free accounts: **Supabase** (supabase.com), **Vercel** (vercel.com), and a **GitHub** account (github.com) — GitHub stores the code and is how Vercel auto-deploys.
2. Install on your Mac:
   - **Node.js** (LTS) — from nodejs.org, or `brew install node`. Verify: `node -v` (want v18+).
   - **Git** — `git --version` (macOS will offer to install if missing).
   - **Claude Code** (optional but ideal for this workflow) — lets Claude write files directly into the project.
3. Pick a project name. This runbook uses `858-pm`.

---

## Phase 1 — Database first (Supabase) (≈30 min)

The schema is the foundation. It's deliberately generic so "add a task" or "add a workstream" is just inserting a row — no rebuild required. Seating is modeled as its own tables that hang off a project.

1. In Supabase, **New project** → name `858-pm`, set a DB password (save it), pick a region near you. Wait ~2 min for it to provision.
2. Left sidebar → **SQL Editor** → **New query**. Paste this and **Run**:

```sql
-- PROJECTS: one row per event/initiative
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,                       -- e.g. 'luncheon','summit','client'
  event_date date,
  created_at timestamptz default now()
);

-- WORKSTREAMS: groupings within a project (Seating, Comms, Client, etc.)
create table workstreams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

-- TASKS: the heart of it. Add a task = insert a row. Fully dynamic.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  workstream_id uuid references workstreams(id) on delete set null,
  title text not null,
  owner text,                      -- 'Fernando','Christina','Juan'...
  due_date date,
  status text default 'todo',      -- todo | prog | review | done
  notes text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SEATING MODULE: tables + guests, scoped to a project
create table seating_tables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  capacity int default 8,
  is_host boolean default false
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  company text,
  title text,
  tier int,                        -- 1, 2, null
  dietary text,
  status text default 'confirmed', -- confirmed | noshow | waitlist
  table_id uuid references seating_tables(id) on delete set null
);

-- ACTIVITY LOG: the change history Nic asked for
create table activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  actor text,
  action text,
  detail text,
  created_at timestamptz default now()
);

-- keep updated_at fresh on task edits
create or replace function touch_updated() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger tasks_touch before update on tasks
  for each row execute function touch_updated();
```

3. **Turn on real-time** (this is what kills version drift): Supabase → **Database → Replication** (or **Realtime**), enable it for the `tasks`, `guests`, and `seating_tables` tables.
4. **Access for the test:** Supabase → **Authentication → Policies**. For a fast internal proof you can keep Row Level Security off, or add a permissive policy. *Before sharing outside the team, turn RLS on and add real policies — do not skip this for production.*
5. Grab your keys: **Project Settings → API** → copy the **Project URL** and the **anon public key**. You'll paste them in Phase 3.

---

## Phase 2 — Scaffold the app (Next.js) (≈10 min)

In Terminal:

```bash
cd ~/Documents              # or wherever you keep projects
npx create-next-app@latest 858-pm
#   choose: TypeScript = No (simpler), App Router = Yes, Tailwind = Yes, others default
cd 858-pm
npm install @supabase/supabase-js
npm run dev                 # open http://localhost:3000 — you should see the starter page
```

You now have a live app running on your machine. Leave `npm run dev` running; it hot-reloads as files change.

---

## Phase 3 — Connect the app to the database (≈10 min)

1. In the project root, create a file named `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=paste_your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste_your_anon_key
```

2. Create `lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

3. Restart `npm run dev` so it picks up the env file. The app can now read and write your database.

---

## Phase 4 — Build the screens (with Claude) (≈half day)

This is where your existing workflow shines: describe the screen, let Claude write the code, paste it into the project. Build in this order, testing each before moving on.

**Screen A — Task board (the multifunction core).** Prompt Claude with something like:

> "In my Next.js + Supabase app (client in `lib/supabase.js`), build a page `app/project/[id]/page.js` that loads workstreams and tasks for a project. Group tasks under their workstream. Each task row shows title, owner, due date, and a status dropdown (todo/prog/review/done) that updates Supabase on change. Add an **'+ Add task'** button per workstream that inserts a new task row, and an **'+ Add workstream'** button. Use Tailwind. Write every change to the `activity` table."

That single screen delivers "Christina project-manages and adds tasks as we go."

**Screen B — Seating module.** Prompt Claude:

> "Add a `app/project/[id]/seating/page.js` that loads `seating_tables` and `guests` for the project. Render each table as a card with its guests. Let me click a guest then click another seat to move/swap them (update `guests.table_id`). Add a 'mark no-show' action that sets the guest status to 'noshow' and frees the seat, and a waitlist area to seat a replacement. Tier 1/2 badges and dietary flags."

(The `luncheon-seating-demo.html` you already have is the visual target — point Claude at it.)

**Screen C — Home / project list.** A simple page listing projects with a "New project" button.

After each screen: refresh the browser, click around, confirm it reads/writes Supabase (check the **Table Editor** in Supabase to see rows change).

---

## Phase 5 — Real-time sync (the whole point) (≈30 min)

This is what makes two people editing safe. Prompt Claude:

> "On the task board and seating pages, subscribe to Supabase real-time changes for the relevant tables and update the UI live when a row changes, so two people on the same page see each other's edits without refreshing."

Reference pattern Claude will use:

```js
useEffect(() => {
  const ch = supabase.channel('tasks-live')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => reloadTasks())
    .subscribe()
  return () => supabase.removeChannel(ch)
}, [])
```

**Test it:** open the app in two browser windows, change a task date in one, watch it update in the other. That's the version-drift problem solved — the demo's "single source of truth" made real.

---

## Phase 6 — Put it online (Vercel) (≈15 min)

1. Push the code to GitHub:

```bash
git init && git add -A && git commit -m "858 PM tool v1"
# create an empty repo on github.com called 858-pm, then:
git remote add origin https://github.com/YOURNAME/858-pm.git
git push -u origin main
```

2. On Vercel → **Add New → Project** → import the `858-pm` repo.
3. In the import screen, add the two **Environment Variables** from your `.env.local` (URL + anon key).
4. **Deploy.** In ~1 minute you get a URL like `858-pm.vercel.app` — the single link the whole team opens. Every future `git push` auto-redeploys.

> Note: Vercel's free Hobby tier is non-commercial; move to **Pro (~$20/mo)** for a real business tool. Supabase free pauses after a week idle and has no backups — **Pro ($25/mo)** for always-on + backups before you rely on it.

---

## Phase 7 — Slack layer (Zapier) (≈30 min)

Do this only after Phases 1–6 work. Two flows:

**Out (notify):** Zapier → new Zap → Trigger: *Supabase – New/Updated Row* on `tasks` (filter: status = `review`) → Action: *Slack – Send Channel Message*: "@{owner} — '{title}' needs sign-off." Same pattern for seating no-shows.

**In (complete from Slack, no login):** Zapier → Trigger: *Slack – New Reaction/Reply* in `#luncheon-seating` → Action: *Supabase – Update Row* setting the task `status` to `done`. This is the JG/Juan "done in Slack, no SSO" path from the demo.

> Zapier free = 100 tasks/mo, single-step only — fine to prove one ping. Paid (~$29/mo) for real multi-step volume.

---

## Phase 8 — Load the real data

1. Create one **project** row (e.g., the next real luncheon).
2. Add your real **workstreams** and **tasks** — either by hand in the app's "+ Add task", or bulk-import: drop a CSV into Supabase's **Table Editor → Import**.
3. For seating: import the guest list CSV into `guests`, create the `seating_tables`.

*(This is where your real task list comes in — once you send it, I'll shape the workstreams/tasks and a ready-to-import CSV so you skip the manual entry.)*

---

## Where Claude vs. a developer fits

- **You + Claude can do Phases 0–6** comfortably — it's mostly prompting Claude for screens and pasting code, which is your current workflow, now backed by a real database instead of a file.
- **A developer is worth it** for: turning on proper auth/RLS before any external access, the Zapier/Slack hardening, and Nic's "biannual true-up." Budget for that when you go past the internal proof.

## Decision gates (don't over-build)

- After **Phase 5**, you've proven the core (shared DB + live sync). Show the team. If they use it, continue.
- Add the **generated-plan / template-library** feature (type a sentence → full plan) only after the basics stick — it needs a tagged library of past tasks first, which is Christina's task-tagging work.

---

*Fastest path to a demoable real version: Phases 0–6, internal only, sample or one real project. That's the ~1–2 day target and it directly answers "can we get off the file."*
