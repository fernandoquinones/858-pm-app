# 858 Project Tool — Full Chat History & Decision Log

A chronological reconstruction of the entire build conversation, so the thinking survives even though Cowork chats do not. Pair this with PROJECT-JOURNAL.md (state) and ROADMAP.md (what's left).

---

## Stage 1 — The problem & the first plan
**Context given:** a meeting recap + Granola transcript. The team (Fernando, Christina, Nic) had a Claude-built HTML project-plan that worked great for two people but broke down: no persistent/shared database, manual file uploads each session, version drift between editors, structural changes required full rewrites, and the right-hand preview wasn't synced with the chat. Nic's caution: validate before spending time/money (citing the audio-projects and Metabase/Rigids overlap); aim for a "great well-operating project plan" and back into it.

**Ask:** "Get started on this — specifically luncheon seating only — create a test project."
**Clarified to:** first a step-by-step plan with plain-English explanations of each tool; scope = both guest/table seating AND the task plan that produces it.

**Delivered:** `luncheon-seating-test-project-plan.md` — explained Next.js (the screens) + Supabase (the shared database/source of truth, fixes version drift) + Vercel (hosting/one URL) + Slack/Zapier (notify). Costs verified (free tiers; ~$45–75/mo for real use). Recommended starting with the highest-pressure use case (standalone luncheon seating).

## Stage 2 — The full picture
**Ask:** review everything first — this is part of a bigger initiative.
**Given:** the May 19 "Future of Project Plans" recap. Confirmed THREE workstreams: (1) internal PM tool (file→web app, Fernando), (2) client portal + automated tasking (airline-app model, Nic), (3) central attendee/contact database powering dossiers (Christina; Attio + Zapier→Webflow considered). Personas: power users (Fernando/Christina), light-touch (Juan → Slack pushes), reviewer (Nic), exec (Marty), clients. Slack as primary surface for non-operators.
**Delivered:** `project-landscape-full-picture.md` — mapped the 3 workstreams, personas→interaction surfaces, tool landscape, and where the luncheon test fits. Flagged tensions: one DB or two (Supabase vs Attio), Notion's role, "stable steady state."

## Stage 3 — Build the real prototype
**Decision:** real stack (Next.js + Supabase + Vercel), not a mockup. Scaffolded the app: project list, board, seating page; `schema.sql` + `seed.sql`; `SETUP.md`. Then Fernando uploaded the **real Create event plan (JSX)** → parsed into **71 tasks / 13 phases / 15 workstreams** → produced CSVs and rebuilt the demo with real data. Wrote `build-runbook.md` (multifunction: add tasks/workstreams on the fly; Christina manages).

## Stage 4 — Core app features
Built, iteratively, with Fernando steering:
- **Claude as the trigger:** `/api/generate` (describe an event → Claude reads the template library → writes the plan to Supabase). Later also `/api/extend` ("add a GRIP activation").
- **Roles/access:** masters (Christina, Fernando) full control; members view all, comment, edit their own. "Acting as" switcher = prototype login stand-in. JG also edits the seating chart.
- **Webpage is the primary place to edit & comment; Slack is a SECOND channel** (Fernando emphasized this).
- **Comments** + **Attachments** (files/PDFs/images + dossier links) per task.
- **Process/UX visuals** + **`presentation-explainer.md`** (the Sesame-Street pitch for the team, incl. "why not just buy Asana").
- Spelling: **Nick → Nic**. JG seating access.

## Stage 5 — The learning library (key concept)
- Library moved into the DB (`library_tasks`) so the app can write to it and Claude reads it live.
- **Forever vs one-off:** every added task is one-off by default; a per-task "Save to library" toggle (decided WHEN adding) makes it a reusable default. Fernando's example: "a presentation always needs a mic" → save forever; "this one needs a second mic for Q&A" → one-off. Fixed an "ON CONFLICT" bug (duplicate titles) and added save feedback.
- **Multi-activation tagging:** a task can belong to several activations (seating = Luncheon + Bird circles). Activations are TAGS; workstreams are SECTIONS. An event = a combination of activations.
- **Structured event creation:** Home form = Event name + date + multi-select **activations** → deterministically pulls every "All events" task + the chosen activations' tasks from the library. No AI required. (AI free-form generate is the optional second door.)
- Add task with workstream + owner + activations + library toggle; edit activation/workstream/**owner**/status/due; delete (event-only, never the library). Clear ✎ Edit / 💬 Comment / 📎 Add attachment / 🗑 Delete row actions.

## Stage 6 — Deploy & brand
- Deployed to **Vercel** → `https://858-pm-app.vercel.app`. GitHub Desktop workflow established (commit → push → auto-deploy).
- Applied the **858 brand** from the guidelines PDF + logo SVG: Fira Sans Condensed (headings) + Inter (body); blue #478BC5, yellow #FFCE0B, navy #15263C; logo in header; activation/pills as light-yellow fill + darker-yellow outline. Activations and Slack moved inline into the header (collapsible).

## Stage 7 — Slack integration (no Zapier)
- Decided **against Zapier** — native is cleaner: Supabase + Next.js API routes talk to Slack directly. (Alternatives noted: Make, n8n.)
- Built routes: `/api/slack/notify` (ping with Mark-complete button), `/api/slack/events` (✅ reaction → done; thread reply → comment), `/api/slack/interactions` (button → done), `/api/slack/link-channel`, `/api/slack/channels`, signature verification.
- **Per-event Slack rooms:** each event connects to its own existing **private** channel (Fernando: "we already have the rooms"). Connect by dropdown or by channel ID (added because private channels don't always list).
- **Scopes (private set):** chat:write, groups:read, groups:history, reactions:read (+ channels:read; he kept the public ones too for flexibility). **No reliance on channels:join** — bot must be invited (`/invite @858 Project Plan Bot`), tighter security. Events subscribed: reaction_added, message.channels, message.groups.
- **Go-live troubleshooting (learnings):** don't paste a filename into the SQL editor; "Run without RLS" on the schema warning; use the **production** Vercel domain (not a per-deploy preview URL); env vars need a **redeploy**; a **401** on Slack actions = wrong/missing **Signing Secret** (fix + redeploy). → **It worked.**

## Stage 8 — Slack refinements
- **Delete bot messages:** Fernando is NOT a Slack workspace admin, so the native ⋮→Delete isn't available to him. Built an **undocumented 🗑 reaction** that deletes the bot's own message (scoped to bot messages only; not advertised in any message text).
- **@-mention owners:** when a task hits *Needs review*/*Complete*, the bot @-mentions the owner (real ping) using a `slack_users` name→Slack-ID map. **(Parked as Phase 2.)**
- **Two-way comments:** Slack thread reply → app comment (live); app comment → Slack thread, with `@name` → real mention. **(Parked as Phase 2.)**

## Stage 9 — Names (Phase 1)
- **Fern → Fernando** everywhere owners/tags are recorded; "Fern" is fine as a casual reference but the system records **Fernando**. (Notes initially kept "Fern," then Fernando confirmed: change ALL instances to Fernando.)
- **Juan = JG (same person) → standardize to JG**; "Juan" is a fine casual reference. **Fernando and JG are two different people.**
- Taught Claude the synonyms in the generate/extend prompts (Fern→Fernando, Juan→JG).
- DB migration provided to rename existing rows' owner/notes.
- **Phase 1 pushed:** trash delete + Fernando/JG names. (Hit a recurring git **index.lock** issue — fix: quit GitHub Desktop, `rm -f .git/index.lock`, reopen, push.)

## Stage 10 — Owner editable in the plan
- Added an **Owner dropdown** in a task's Edit panel — changes the owner for **that event only, never the library** (permanent library changes go through Claude or manual edits). Fernando's reasoning: small team needs quick reassignment in the plan.

## Stage 11 — Client portal (future, scoped)
- **`CLIENT-PORTAL-BUILD-DOC.md`** written. **Attio is the non-negotiable driver** for all people/brand data (headshots, titles, brand facts); the app only owns the event layer and references Attio IDs. (Attio MCP connector exists for Claude; the app would use Attio's REST API.)
- **Clients can do exactly two things:** select targets and add text-only account details. **No uploads, no other writes.** Enforced server-side with real auth + RLS — the one place we can't ship on the honor system.
- Phases: A) portal + prioritization + real auth; B) Attio enrichment + headshots + weekly registration sync; C) polish (day-of dossier, recap links, Claude auto-draft).

## Stage 12 — Wrap-up
- Wrote `ROADMAP.md` (Phase 2 → Anthropic → Christina-doc refresh → security hardening → client portal → housekeeping).
- Decision on the Christina doc: refresh it AFTER Phase 2 + Anthropic, in one pass.
- Created this journal set so nothing is lost if the computer is wiped.

---

## Recurring lessons / gotchas (so they're not relearned)
- **Cowork chats do NOT persist** — keep decisions in these files.
- **iCloud lock (EPERM) / git index.lock:** if GitHub Desktop says "a lock file already exists," quit it and `rm -f .git/index.lock`, reopen.
- **Env var changes need a Vercel redeploy.**
- **Use the production Vercel domain** for Slack URLs, never a per-deploy preview.
- **Slack 401** = Signing Secret wrong/missing/not redeployed.
- **Private Slack channels** must have the bot invited before they appear/work.
- **Renaming in code ≠ renaming saved data** — run the DB update too.
- **Push is separate from commit** — commit saves locally; push sends to Vercel.
