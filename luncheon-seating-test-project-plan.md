# Luncheon Seating — Test Project Plan

*A step-by-step plan to stand up a small, real test of the project-plan tool, scoped to luncheon seating only. Combines guest/table assignment **and** the task plan that produces it. Written so each tool's job is clear before any building starts.*

Prepared for: Fernando · For working session with Christina · Validation framing per Nic
Date: June 9, 2026

---

## 1. Why "luncheon seating" is the right test

A luncheon's seating is the smallest slice that exercises every part of the eventual system without the whole event template library behind it:

- It has **tasks** (build guest list → confirm RSVPs → draft seating chart → finalize → print cards) with owners, dates, and statuses — the project-plan side.
- It has **data** (guests, tables, seat assignments) that multiple people touch and that must stay accurate — the database side.
- It needs **updates to reach people** (a ping when someone's RSVP changes a table) — the Slack side.

If a small tool can hold all three for one luncheon, accurately, with two people editing at once, it answers the core question from the call: *can we get off the back-and-forth Claude HTML file and onto something with a real, shared source of truth?* That's the thing to prove before spending on a full build.

---

## 2. The stack, tool by tool (plain English)

This is the stack you were asked to understand — **Next.js + Supabase + Vercel**, plus the Slack layer. Think of it as four jobs, each handled by one tool.

### Supabase — the source of truth (the database)
This is the most important piece and the one that fixes your current pain. Supabase is a hosted **database** (Postgres) with an auto-generated API on top. It stores two things, exactly as the architecture you sketched on the call described:

1. **The data** — your guests, tables, seat assignments, and tasks. One copy, lives in the cloud.
2. **A live connection** — when Christina changes a date or marks a task done, it writes to Supabase instantly, and your screen updates too. This is the "real-time sync" that the Claude HTML file can't do. There is no "save to files," no divergent versions, no telling Claude what changed — the database *is* the latest version.

It also handles logins if you ever want them, file storage, and "fire an event when a row changes" (which is how Slack pings get triggered).

*Cost:* Free tier is real and enough for a test — 500 MB database, 50K users, real-time included. Caveats for a test: free projects **pause after 1 week of inactivity** and have **no backups**. For anything you'd rely on, the Pro plan is **$25/month per project**, which adds backups and keeps it always-on. ([Supabase pricing](https://supabase.com/pricing))

### Next.js — the interface (the dashboard people see)
Next.js is the **framework you build the dashboard in**. It's the React dashboard Christina already works in, but as a proper web app instead of an HTML file. It draws the seating grid, the task list, the buttons. When you click "mark complete," Next.js is what sends that change to Supabase and shows the result. Plain version: **Supabase holds the data; Next.js is the screen that shows and edits it.**

*Cost:* Free — it's open-source software, not a subscription. You only pay to *host* it (see Vercel).

### Vercel — the host (the public web address)
Vercel is **where the app lives so people can open it.** You hand it your Next.js code and it gives back a single URL — `yourproject.vercel.app` — that the whole team opens. Always current, no files to send. It also auto-redeploys whenever the code changes, so updates go live in a minute.

*Cost:* The free "Hobby" tier is generous but is **personal/non-commercial only** — a business tool should be on **Pro at ~$20/month**. Fine to *test* on free; budget Pro for real use. ([Vercel pricing](https://vercel.com/pricing))

### Claude — the builder and the plan generator (two different roles)
Claude plays two roles, and it's worth separating them because the call kept blurring them:

- **Build-time:** Claude writes and edits the Next.js code — adding a tab, a field, a workflow — the "vibe coding" you do now. The difference is the *data* no longer lives inside Claude's file; it lives in Supabase. So Claude can change how the tool *looks and works* without ever touching or risking the live seating data.
- **Run-time (optional, later):** the feature you demoed — type "CFO Summit, four tech stands, sponsored breakfast" and get a generated plan. That requires the **task template library** (every past task, tagged by type) to exist in Supabase first. **Leave this out of the seating test.** Prove storage + sync + Slack first; add generation once there's a library to generate from.

### Slack + Zapier — the notification layer (how updates reach people)
Slack is where Juan and JG actually live, so it's the interface for *them* — not a dashboard they have to log into. Two directions:

- **Out:** when something changes in Supabase (RSVP flips, task assigned), a message posts to Slack — "Juan, table 3 needs your sign-off."
- **In (the part you care about):** the person replies/reacts in Slack to mark something done, and that writes back to the database — **no Google sign-in, no separate tool.** That write-back is the **Zapier** job: Zapier is the glue that connects Slack to Supabase without custom code. This directly answers your "remove the SSO friction" note.

*Cost:* Zapier free is **100 tasks/month, single-step Zaps only** — enough to test one or two pings, not enough for real volume. Paid starts ~$29/month. ([Zapier pricing](https://zapier.com/pricing))

---

## 3. How the pieces fit (the loop)

```
                    ┌─────────────┐
   you/Christina →  │   Next.js   │  ← the dashboard (a URL on Vercel)
   edit a task /    │  dashboard  │
   assign a seat    └──────┬──────┘
                           │ reads + writes
                           ▼
                    ┌─────────────┐
                    │  Supabase   │  ← the one true copy: guests, tables,
                    │ (database)  │     seats, tasks. Syncs to everyone live.
                    └──────┬──────┘
                           │ row changes fire an event
                           ▼
                    ┌─────────────┐
   Juan / JG    ←   │   Zapier    │  → posts to Slack, and writes Slack
   on their phone   │  ↔ Slack    │     replies back into Supabase
                    └─────────────┘
```

The thing that's different from today: **the data sits in the middle and everyone points at it.** No version drift, because there's only one version.

---

## 4. Step-by-step build plan (the test)

Ordered so each step produces something checkable before the next. Steps 1–3 prove the core (accurate, shared data); 4–5 add the team-facing layer. Stop after any step if the value isn't there — that's the point of testing small.

**Step 0 — Define the skeleton first (you + Christina, working session).**
Before any tool, write down the data model on paper. For the luncheon: a *Guests* list (name, org, RSVP status, dietary, table #), a *Tables* list (table #, capacity, host), and a *Tasks* list (task, owner, due date, status). This is the "manicured foundation" — the build is cheap; getting the structure right is the whole game. Deliverable: a one-page schema. *(I can draft this from the call notes if you want a starting point.)*

**Step 1 — Stand up Supabase.**
Create a free project, create the three tables from Step 0, hand-enter one real luncheon's worth of guests and tables as test data. Checkpoint: the data exists in the cloud and you can see it.

**Step 2 — Build the dashboard (Next.js, deployed to Vercel).**
A single screen with two panels: a **seating view** (tables + who's at each, drag or dropdown to assign) and a **task view** (the seating to-do list with owners/dates/status). Wired to Supabase so edits save instantly. Deploy to Vercel → one URL. Checkpoint: open the URL, assign a guest to a table, refresh — it stuck.

**Step 3 — Prove real-time sync (the actual test of the core problem).**
You and Christina open the same URL at once. She moves a guest; it appears on your screen without a refresh. You change a task date; she sees it. Checkpoint: **this is the version-control problem solved.** If this works, the core thesis is validated.

**Step 4 — One Slack ping out.**
Wire a single Zapier automation: when a task's status changes to "needs review," post a Slack message to the relevant person. Checkpoint: change a status, watch the Slack message appear. Tests the *out* direction with the team.

**Step 5 — One Slack write-back in.**
Wire the reverse: someone reacts ✅ or replies "done" in Slack, Zapier writes it to Supabase, the dashboard updates. Checkpoint: complete a task entirely from Slack, no login. Tests the "no SSO friction" idea Juan/JG would actually use.

**Step 6 — Show the team, decide.**
Demo the URL + the Slack flow. Ask the validation questions from the call: does Juan actually open it? Does the Slack flow get used? Is the data staying accurate with two editors? Decision gate below.

---

## 5. What this test is meant to prove (and the decision gate)

Nic's framing — *"infinite minus one non-optimal paths… don't spend time/money before validating"* — built into the gates:

| If after the test… | Then… |
|---|---|
| Sync works + team uses the Slack flow | Greenlight the real build; decide build-vs-hire (Fiverr/dev) for the full template-library version. |
| Sync works but nobody opens the dashboard | Drop the dashboard ambition; **Slack-first updates** are the product. Much cheaper. |
| Sync works but Slack write-back is clunky | Keep dashboard for you/Christina, skip the team-facing layer for now. |
| Two-editor data still drifts | The architecture isn't the fix — re-examine before any spend. |

This is the **"V1 within a week"** Nic asked for. Steps 0–3 alone (no Slack) are a 1-week target and answer the most urgent question — data accuracy with multiple editors.

---

## 6. The fork you'll hit, and the honest trade-off

You surfaced **Airtable + Softr + Zapier** on the call. It's worth naming because for *this test specifically* it may be faster:

- **Next.js + Supabase + Vercel** (this plan): more control, scales to the full generated-plan vision, but you/Claude build the interface. This is the path to understand because it's where the real product lives.
- **Airtable + Softr + Zapier**: Airtable is the database, Softr turns it into a web app with near-zero code, Zapier does Slack. You could stand up Steps 1–3 in a day or two with no real coding — but it's harder to bend to the "type a sentence, get a generated plan" endgame, and you're renting more locked-in tools.

**Recommendation:** if the goal is purely *validate that a shared database + sync + Slack solves the pain this month,* the no-code stack is the faster honest test. If the goal is *learn the stack we'll actually build on,* do Steps 0–3 in Supabase/Next/Vercel. Given your stated next step was understanding Next/Supabase/Vercel, this plan assumes the latter — but flag it with Christina, because a one-week proof might not need a code build at all.

---

## 7. Rough cost to run the test

Everything below has a real free tier; you can run the entire test at **$0**. Budget for "real use" is small:

| Tool | Test (free) | Real use |
|---|---|---|
| Supabase | Free (pauses after 1 wk idle, no backups) | $25/mo (Pro) |
| Vercel | Free Hobby (non-commercial only) | ~$20/mo (Pro) |
| Next.js | Free (open source) | Free |
| Zapier | Free (100 tasks/mo, 1-step) | ~$29/mo |
| **Total** | **$0** | **~$45–75/mo** |

---

## 8. Open questions to settle in the working session

- **Skeleton ownership:** who owns the schema and the task tagging long-term? (Christina flagged as likely owner of library curation.)
- **Notion's role:** is Notion still the nucleus/source of truth, or does Supabase become it for project data? Affects whether we pull from Notion or replace it.
- **Where Neon Deer fits** in pulling project-plan/Notion data together.
- **How structural changes happen post-build** — can you keep prompting Claude to add tabs/fields against the live app, or does that eventually need a developer (Nic's biannual true-up idea)?

---

*Next concrete action: a 60-min working session with Christina to lock Step 0 (the schema). Once that's set, Steps 1–3 are a one-week target.*
