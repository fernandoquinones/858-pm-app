# 858 Project Tool — Master Journal & Handoff

A single reference for everything we built and decided. If you're on a new computer: this file + the iCloud folder + GitHub + your Claude account contain the whole project.

---

## 0. Resume on a new computer (read first)
- **This chat does NOT carry over.** Cowork conversations are lost if the computer is wiped. The full conversation is preserved in **CHAT-HISTORY.md** (read it for the complete narrative, decisions, and reasoning).
- **All files & code:** in **iCloud Drive** → `Documents/Claude/Artifacts/project-plan/858-pm-app/` (auto-syncs to any Mac signed into your iCloud) AND in **GitHub** (the repo you pushed). Either source has everything.
- **The live app:** `https://858-pm-app.vercel.app` — works from any browser; nothing is on your laptop.
- **The services** (cloud, log in from anywhere): Supabase, Vercel, GitHub, Slack, Anthropic.
- To edit the app again: install GitHub Desktop, clone the repo, open Claude pointed at the folder, describe changes, commit, push (Vercel auto-deploys). See CHRISTINA-COEDIT-SETUP.md.

---

## 1. What this is
A multifunction **event project-management tool** that replaced 858's pass-around file plan with one live, shared, cloud app. You describe/assemble an event, tasks come from a shared **library**, the team works off one URL with real-time sync, and **Slack** is a second channel. A future module is an **Attio-driven client portal + dossiers**.

**Stack:** Next.js (frontend) + Supabase (Postgres DB, the source of truth) + Vercel (hosting) + Slack (notifications) + Anthropic/Claude (optional AI generation). 858 brand throughout (Fira Sans Condensed + Inter, blue #478BC5, yellow #FFCE0B, navy #15263C; logo in /public/logo.svg).

---

## 2. Where everything lives
| Thing | Where | Notes |
|---|---|---|
| Source code + docs | iCloud `…/project-plan/858-pm-app/` + GitHub repo `858-pm-app` | same files both places |
| Live app | https://858-pm-app.vercel.app | Vercel production |
| Database | Supabase project `858-pm` | tables + SQL in `supabase/` |
| Hosting/deploys | Vercel project `858-pm-app` | auto-deploys on `git push` |
| Slack app | api.slack.com/apps → "858 Project Tool" (bot: 858 Project Plan Bot) | Marty = workspace admin |
| AI | Anthropic console (pending key) | Nic = admin |

**Env vars (Vercel → Settings → Environment Variables):**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, and (pending) `ANTHROPIC_API_KEY`. Changing any requires a **redeploy**.

---

## 3. What's LIVE right now
- **Create an event** by picking its **activations** (Luncheon, Bird circles, 858 House, GRIP, Presentation, +new) → tasks auto-pull from the library. No AI needed.
- **Tasks:** add (with workstream, owner, multi-activation, save-to-library toggle), edit owner/activation/workstream/status/due, delete. "Save to library" is one-off by default; tick to make it a reusable default.
- **Library** ("master") in Supabase `library_tasks` — every plan pulls from it; it learns as you save tasks to it.
- **Comments** (in-app) + **Attachments** (files/PDFs/images + links) per task.
- **Seating board** (move/swap/no-show/waitlist) — JG + masters can edit.
- **Roles:** Christina + Fernando = masters; JG, Nic, Chris, Marty = members (view all, comment, edit own; JG also seating). "Acting as" switcher = prototype stand-in for login.
- **Real-time sync** across everyone on the same URL.
- **Slack (live):** connect each event to its private channel (invite the bot first, then connect by dropdown or channel ID). Task → *Needs review* posts a ping with a **Mark complete** button. **✅ reaction / button / thread reply** all sync back (reply → comment). Secret **🗑 reaction deletes** the bot's own message (undocumented).
- **858 branding** (fonts, colors, logo, yellow pills).

---

## 4. Key decisions & non-negotiables
- **Source of truth:** Supabase for project/task data. For the future client portal, **Attio is the source of truth for people/brands** (headshots, titles, brand facts) — never duplicated.
- **Activations vs workstreams:** activations are *tags* on tasks (which event types they belong to); workstreams are *sections* of the plan. An event is a combination of activations; a task can carry several activations (e.g., seating = Luncheon + Bird circles).
- **Library that learns:** adding a task is a one-off by default; "Save to library" makes it a forever default for that workstream/activation. Decided per task.
- **Names:** **Fernando** (synonym "Fern") and **JG** (synonym "Juan") — always recorded as Fernando / JG; "Fern"/"Juan" are fine as casual references. Fernando and JG are two different people.
- **Slack:** per-event **private** channels; lean scopes; bot only works in channels it's **invited** to (no channels:join reliance); @mentions via a `slack_users` name→Slack-ID map; messages deletable by 🗑 reaction (since Fernando isn't a Slack workspace admin).
- **Client portal:** Attio-driven; clients can do **exactly two things** — select targets and add text-only account details. No uploads, no other writes. Requires real auth + RLS before any client touches it.
- **Security:** prototype runs with RLS off + the "Acting as" switcher. Harden (Supabase Auth + RLS) before wider/external rollout.
- **Operating principle (Nic):** validate before building a lot; turn "needs code" into "in-app options" so the tool stabilizes and rarely needs a developer.

---

## 5. File index (all in 858-pm-app/)
**The app:** `app/` (pages + `/api/*` routes), `lib/` (supabaseClient, roles, ActivationChips, slack, slackVerify, supabaseServer, templateLibrary, useCurrentUser), `public/logo.svg`, `package.json`, configs.

**Database (`supabase/`)** — run in Supabase SQL Editor in order:
`schema.sql` → `02-comments.sql` → `03-attachments.sql` → `04-library.sql` (seeds the 71-task library) → `05-slack.sql` → `06-project-activations.sql` → `07-project-activations.sql`(activations col) → `08-slack-users.sql` (Phase 2) → `seed.sql` (sample event, optional).

**Setup/docs:**
- `GO-LIVE.md` — full launch runbook.
- `SETUP.md` — Supabase + env + run steps.
- `SLACK-SETUP.md` — Slack app, scopes (private set), event URLs, per-event connect.
- `CHRISTINA-COEDIT-SETUP.md` — how Christina becomes a co-editor (Sesame-Street simple).
- `CLIENT-PORTAL-BUILD-DOC.md` — Attio-driven portal/dossiers build plan + non-negotiables.
- `BUILD-WALKTHROUGH.md` — how the app's pieces work + production-auth path.
- `ROADMAP.md` — what's left (Phase 2, Anthropic, Christina doc, security, portal, housekeeping).
- Planning artifacts: `luncheon-seating-test-project-plan.md`, `build-runbook.md`, `project-landscape-full-picture.md`, `presentation-explainer.md` (the Sesame-Street pitch), `858-project-tool-demo.html` & `luncheon-seating-demo.html` (early mockups), `tasks-template-library.csv`, `luncheon-project-tasks.csv`, `workstreams-library.csv`.

---

## 6. How we got here (the arc, in brief)
1. Started from a meeting recap; decided to test the project-plan idea on luncheon seating, then realized it's one of three workstreams (internal PM tool, client portal, central attendee DB).
2. Built mockups → parsed your real 71-task Create plan → chose Next.js + Supabase + Vercel.
3. Scaffolded the real app; added roles, comments, attachments, the learning library, iterative add/extend, multi-activation tagging, structured event creation, owner editing, delete.
4. Deployed to Vercel (live URL), applied the 858 brand + logo.
5. Built the Slack integration end-to-end: per-event private rooms, pings, ✅/button/reply sync, the 🗑 cleanup; set scopes lean; wired tokens/secret.
6. Renamed Fern→Fernando and Juan→JG (owners/tags), taught Claude the synonyms.
7. Wrote the Attio-driven client-portal build doc with hard client-permission limits.
8. Parked Phase 2 (Slack @mentions + comment→thread) and the Anthropic key for next.

---

## 7. Who owns what (people)
- **Fernando** — builds/owns the tool, master.
- **Christina** — co-builder/PM, master; future co-editor + bot/library manager.
- **Nic** — Anthropic API key admin; client/strategy perspective.
- **Marty** — Slack workspace admin.
- **JG** — seating + deal strategy (member). **Chris** — comms (member).

*Last updated: this session. Pick up at ROADMAP.md → Phase 2.*
