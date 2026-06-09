# 858 Project Management Initiative — The Full Picture

*Synthesis of the May 19 "Future of Project Plans" recap, the June 9 working-session recap, and the June 9 transcript. Purpose: see the whole initiative before scoping the luncheon-seating test, because that test is one slice of something larger — and several of the people it serves only ever touch it through Slack.*

Date: June 9, 2026 · For: Fernando

---

## The one-paragraph picture

858 is replacing its pass-around Claude/file-based project plans with a connected system in three parts: **(1) an internal PM web app** for the operators, **(2) a client-facing portal** with automated tasking, and **(3) a central attendee database** that feeds dossiers, recaps, and program guides. The thing tying all three together is **one shared source of truth** instead of files, with **Slack as the primary surface** for everyone who isn't a daily operator. The luncheon seating tool you want to test is the sharpest possible first slice — not because it's the whole system, but because standalone-luncheon seating is where operational pressure is highest and the value of getting it right is clearest.

---

## The three workstreams

### 1. Internal PM tool — file → web app (Owner: Fernando)
Move the project plan off the shared file (the single biggest vulnerability — version drift, lost updates) onto a real-time, collaborative web app. Keep the structure that already works for you and Christina; fix reliability, access, and automation. Team-wide read access by default, edit rights for core operators, an activity/change log, and **Slack as the main way most stakeholders create, update, nudge, and read status without opening the app.** This is where the Next.js + Supabase + Vercel exploration lives — explicitly framed in the May 19 notes as a low-cost option for low traffic, *not* a locked recommendation.

### 2. Client portal + automated tasking (Owner: Nic)
A client-facing hub modeled on an **airline app**: one familiar place showing the events a client is registered for, key actions, dossiers available day-of (like a boarding pass), and post-event recaps. Behind it, an always-on playbook of standard tasks per client/event — schedule prep call, schedule deal-strategy call, prioritize Tier 1/2 targets, schedule debrief — with reminders that start ~15–20 days out and escalate every 24–48 hrs until done, then stop. The point is to kill the manual "who's scheduled their prep call" audit. **Clients do not get visibility into internal project plans** at this stage; their value is the portal and dossiers. Open question: does the portal come first, or after the internal PM upgrade?

### 3. Central attendee/contact database (Owner: Christina)
A single profile store for every past 858 attendee — headshot, LinkedIn, name, title, company/brand, select personal/professional facts — with parent-brand relationships and per-person records. It powers the repeated assets: client dossiers, brand dossiers, recaps, program guides. Workflow: upload a CSV of registrants → system pulls profiles → operator reviews an **audit layer** for mismatches (e.g., Dino Northway moving from Portillo's to Giordano's) before publishing. Tools in play: **Attio** as possible database-of-record, **Zapier → Webflow CMS** for web assets, **Claude linked to Attio** to auto-build dossier structure, Figma for program-guide handoff, Notion still in the mix. Pain to solve: manual headshot collection and line-by-line LinkedIn verification.

**This database is the spine.** Seating needs attendee data; dossiers need it; the portal needs it. How the seating test's guest data relates to this central store is a real design question, not an afterthought (see "tensions" below).

---

## The people — and how each one actually touches the system

This is the "other players when Slack is involved" piece. The system is built for the 95% (operators), but most stakeholders interact through **push, not the tool**:

| Persona | Who | How they touch it | What they want |
|---|---|---|---|
| Power users | Fernando, Christina | Daily in the app — maintain and execute the plan | Reliability, flexibility, no version drift |
| Power reviewers | Nic | Visibility, client context, approvals | Clarity over depth; not daily use |
| Light-touch | Juan | **Slack push notifications** — status & nudges | Accountability without opening a tool. *Usage appetite unproven — validate.* |
| Executive oversight | Marty | Reporting / retrospective | Insight after the fact, not day-to-day ops |
| Clients | External | **The portal** (not internal plans) | Clear tasks, dossiers, schedules, one familiar hub |
| Mobile-first | JG | Likely **Slack on phone**, not a shrunk web view | Same flow, no clunky mobile dashboard |

The design implication, stated plainly across both meetings: **build the app for the operators, and let Slack (via Zapier) be the interface for everyone else** — no SSO friction for Juan/JG, complete-and-comment from Slack.

---

## The tool landscape (and the unresolved tensions)

Tools named across the meetings, by job:

- **Project data store:** Supabase (proposed for the PM app).
- **Attendee data store:** Attio (proposed as DB-of-record for contacts/dossiers).
- **App framework / host:** Next.js / Vercel.
- **Connective tissue:** Zapier (Slack ↔ data, and data → Webflow).
- **Web assets:** Webflow CMS (pre/post-event); Figma (program guides).
- **Still-in-the-mix / source of truth TBD:** Notion.
- **AI layer:** Claude — builds the app interface, and (linked to Attio) auto-drafts dossiers.
- **Vendor:** Neon Deer — involved in pulling project-plan/Notion data together; provides guardrails on audio/Airtable/Metabase.
- **Overlap risk flagged:** Metabase + Rigids doing the same reporting job; same money-on-overlapping-tools pattern could repeat here.

**Tensions to resolve before committing:**
1. **Two databases?** Supabase for project data and Attio for attendees — is that one spine or two? Seating needs both task data and attendee profiles, so the seating test forces this question early.
2. **Notion's role** — nucleus/source of truth, or a secondary integration the new tool pulls from? Unanswered in both meetings.
3. **No stable steady state** — Nic's concern that perpetual Claude "vibe coding" never stabilizes; may need a biannual true-up, possibly with a developer.
4. **Validate before spend** — the explicit lesson from audio projects and the Metabase/Rigids overlap. Don't build the full thing before proving usage.

---

## Guiding principles (from the meetings, applied to everything)

- **Build for the 95%** (operators), not the occasional user.
- **Invest where operational pressure is highest** — which is exactly why luncheon seating is the test (next section).
- **File → web, single source of truth** — accuracy/version-control is the urgent problem; access is the nice-to-have.
- **Slack-first for non-operators** — push over pull, no logins.
- **Validate cheaply, iterate** — V1 light, stand up in a week, see if the team uses it before full build.

---

## Where the luncheon seating test fits

The May 19 notes contain the justification directly: the **seat-replacement tool** was *high pressure / high usefulness at standalone luncheons* (tight windows, all the value rides on seating) and *lower pressure at half-day summits* (recovery time — Create 2026 had only 10–15 no-shows, mostly not Tier 1/2). So testing on **luncheon seating only** isn't arbitrary — it's deliberately picking the highest-pressure format where the tool earns its keep.

What that means for the test plan (refinements to the earlier draft):

- It's a **proving ground for the whole architecture** — shared DB, real-time sync, Slack-first updates — using the one use case where the stakes are clearest.
- The "Guests" data in the test is a **preview of the central attendee database**. Worth designing the test guest fields (name, company/brand, title) to foreshadow the Attio model, so the test doesn't create a throwaway data island. This is the moment to decide whether seating reads from the same spine as dossiers.
- The Slack layer in the test maps directly to the **real personas**: a ping to Juan (light-touch), a status Nic can read, complete-from-Slack for JG on mobile.
- It deliberately **leaves out** the client portal (Nic's workstream) and the full generated-plan / template-library feature — those come after the core (storage + sync + Slack) is proven.

---

## Decisions already made vs. still open

**Decided / directional:**
- Pursue all three: internal PM web app, client portal + tasking, central attendee DB.
- No broad client visibility into internal plans — client value is portal + dossiers.
- Reliability and collaboration before feature expansion in v1.
- Slack is the comms hub; a dedicated channel for this initiative's research/snippets.

**Open (relevant to the seating test):**
- Exact toolchain and long-term maintainability of the PM web app.
- Whether the portal is in increment 1 or follows the PM upgrade.
- Where dossiers live (Notion vs. Webflow) and the path from the database.
- One database or two (Supabase project data vs. Attio attendee data).
- Juan's real preference: visibility tool vs. push notifications.

---

## Owners (so we don't duplicate work)

- **Fernando:** internal PM file → web app; access model; Slack integration approach. *(The seating test sits here.)*
- **Nic:** client portal + auto-tasking MVP; reminder cadences; validate it won't spam clients.
- **Christina:** central database schema, audit logic for company/brand changes, seed task lists from the last 5 events.

---

*Recommendation before building: confirm two things with Christina/Nic — (1) does the luncheon seating test's guest data point at the future central DB (Attio) or stay self-contained for now, and (2) is the seating test purely an architecture proof, or does it need to be usable for a real upcoming luncheon? Those two answers change the build.*
