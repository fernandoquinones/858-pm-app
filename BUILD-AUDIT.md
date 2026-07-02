# 858 Hub — Build Audit & Progress Report
_Last updated: June 11, 2026_

The single source of truth for everything built, in flight, decided, and next. Pairs with DAILY-LOG.md (daily progress) and SESSION-*.md (per-session detail).

**What this is:** what began as an event project-planning tool has become the first module of the **858 Hub** — a company operating system. Stack: Next.js (Vercel) · Supabase (database) · Slack · Claude API · Granola + Attio + Drive (connectors). Live: https://858-pm-app.vercel.app

---

## 1. Pushed live since the start

**Core events module (the foundation)**
- Web app live for the whole team via one link; 858-branded.
- Create events two ways: structured (pick activations → pulls from the task library, no AI) and "describe to Claude" (AI generation).
- Tasks grouped by workstream; owners; multi-select activation tags; comments; file & link attachments; seating view.
- Roles: masters (Christina, Fernando) full edit; members view all / comment / edit own. "Acting as" switcher (stand-in for real logins).
- Backups: GitHub + iCloud + Google Drive, with a "Save this project to Drive" routine.

**Shipped in the June 10–11 push**
- Anthropic key wired — Generate + Add-to-plan with Claude working.
- Fixed Generate producing empty plans (token cap + guard).
- Activation tags sync to the header when Claude adds tasks.
- Delete events from the homepage (master-only, cascades).
- **Reports & Views** — ask Claude for a dashboard / calendar / timeline / status report from live data; renders in-app, read-only.
- **Board redesign** — Reports & Links as header reveal pills (in-flow panel); side-by-side equal Add cards; 3-column labeled Add-task (Owner/Workstream/Activation); transparent compact filter chips; Slack row as compact single-line chips.
- **Homepage Current / Past event filter**, auto-sorted by event date; cards show name, date, city/state, editable venue, activation chips.
- **Event details** — Date + City + State + Venue; Date/City/State required on create; Venue optional and editable on card + board.
- Sort/filter tasks; helpful-links section.
- Per-event Slack two-way loop exists in prod (status→Slack, reaction→done, comment sync) — dormant until the bot is invited.

## 2. Started building (in progress)
- _(nothing actively mid-build — see the DONE list below.)_

## 2b. ✅ DONE (were outstanding, now shipped)
- **Library content & structure (Phase 1)** — Christina's 163-task CSV imported. ✅
- **#40 — Date + phase logic** — due/start computed from offsets + event date; pre/intra/post derived; recurrence pill; dates editable. ✅ (was the biggest remaining events-module build.)
- **Slack connector** — LIVE: per-event pings, personal DMs, this-week & next-week digests, per-task status dropdown + two-way comments, ✅/un-✅ complete & reopen. ✅
- **Weekly/preview digest engine** — built; runs from the homepage buttons (auto-schedule pending Vercel Pro — back burner). ✅
- **comment-notify** — app comment → Slack thread; live. ✅

## 3. Outstanding (specced, awaiting a trigger)
- **Task automation of the 163-task library** — Traveler Profile → team registration (Tier 1) + hotel/flight assist (Tier 2). Internal Tier-1s can start now; PII/travel piece safer after logins/RLS.
- **Granola pilot** — zero-dependency, start now (opt-in, non-sensitive meetings).

## 4. Decisions needed (from Fernando)
1. **Activation-tasks behavior** — should adding an activation in the header auto-pull its library tasks? (Built then parked to think through.)
2. **Slack notifications go-live** — when to flip on (invite bot + im:write scope + populate slack_users) and the notification rules.
3. **Logins method + timing** — Google / magic link / password; phased vs full. Elevated by the hub vision (a company portal needs real identity).
4. **Task taxonomy** — finalize with Christina (workstreams, task types, activations).
5. **Granola** — run the opt-in pilot now? Provision a Business/Enterprise API key (Nic) for the productized version later.
6. **Logistics view** — you didn't want the per-task-toggle version; decide the model you do want (structured fields vs derived).
7. **Hub** — confirm module order; define the shared spine.

## 5. Pending (waiting, not blocked on us)
- Slack — ✅ LIVE for Christina, Fernando, Nic (adding rest of team = back burner).
- Granola opt-in pilot — ready to run the moment you pick a meeting + event.
- Christina's CSV — ✅ delivered & imported (#40 shipped).

## 6. Not started yet
- **Logins / permissions + RLS** — foundational; elevated ahead of auto-Granola + client data.
- **Hub shell** — tiled landing page + the ambient query bar.
- **Company Brain module (Granola)** — beyond the pilot: ask-anything, 48h accountability loop.
- **Client portal & dossiers (Attio)** — incl. project brief/overview + client meeting tracker.
- **CRM module (Attio)** and **Docs module (Drive)**.
- **Cross-event / portfolio dashboard**; **workflow/dependency flowchart**; **onsite logistics tracker** (built then reverted — needs a redesign).
- Task templates; extensible per-event activations (Beyond4, tech stands).

## 7. What moved to what phase
- **Whole project reframed:** the events tool is now **Module 1 of the 858 Hub** (company OS).
- **Library re-architecture** → jumped to top priority (Phase 1).
- **Logins + RLS** → moved AHEAD of automatic Granola ingestion and any client data (foundational).
- **Granola** → its own **Company Brain module**; start with a human-gated opt-in pilot now, productize after logins.
- **Cross-event dashboard** → later phase. **Workflow flowchart** → after Christina's CSV.
- **Project brief/overview + client meeting tracker** → folded into the **Client portal module (Phase 6)**.
- **Onsite logistics tracker** → parked/reverted (redesign TBD).
- **Activation-tasks bug** → parked (decision TBD).

## 8. Plan for tomorrow (June 12)
1. **Christina** — first pass on the library CSV (she's out Friday, so aim to start).
2. **Fernando** — make the activation-tasks call; decide whether to run the Granola opt-in pilot.
3. **Claude (build)** — #40 shipped. Next: start-now items (Granola pilot / internal Tier-1 automations) or advance the foundational keystone (logins + RLS).
4. **Prep the Monday team preview** (Slack integration + generate a plan + "visible to everyone" + seating).

## 9. How we track the build (ideation → completion)
- **BUILD-AUDIT.md** (this file) — the living master status, updated at the end of each session.
- **DAILY-LOG.md** — one dated entry per day (shipped / in progress / decisions / next) — the "show my progress" artifact.
- **SESSION-YYYY-MM-DD.md** — detailed per-session log.
- All mirrored to GitHub + iCloud + Google Drive.
- *Optional automation:* a daily scheduled task that compiles the day's work into a log entry.
