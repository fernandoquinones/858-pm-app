# 858 Hub — Architecture & Reslotted Roadmap
_June 11, 2026 · the north-star doc. Pairs with BUILD-AUDIT.md (status) and DAILY-LOG.md._

## The vision
A company operating system for 858. The team thinks, plans, and runs the business in one place. "Event project plans" is the first **module** — one tile among several on a hub landing page.

## The four layers

**1. The spine (shared data — Supabase core)**
The entities every module references: events / projects / tasks. Each record links out to the systems of record below (Attio IDs for people/accounts, Granola IDs for meetings, Drive links for docs).

**2. The connectors (systems of record — who owns what)**
| System | Owns |
|---|---|
| **Attio (CRM)** | Operators (people/brands), Clients (accounts), target connections, deals |
| **Supabase** | Events, projects, tasks (the spine) |
| **Granola** | Meetings, brainstorming, think tanks |
| **Drive** | Docs, contracts |
| **Slack** | Comms / nudges |

**3. The brain (Claude)**
Reasons across the spine + connectors: distills meetings into actions, generates plans, answers "what did we commit to MOMOS?", drafts comms, flags drift. Always with a human checkpoint early on.

**4. The modules (tiles on the hub home)**
1. **Project plans** (events) — LIVE.
2. **Company brain** (Granola-powered: meeting → actions, decisions log, ask-anything, 48h accountability) — START NOW.
3. **Client portal & dossiers** (Attio-driven, client-facing) — planned.
4. **CRM** (Attio views) — planned.
5. **Reports & dashboards** (cross-module) — early version live (Reports & Views).
6. **Docs & contracts** (Drive-backed, tied to events/clients) — planned.

The "hub" itself is only three thin shared things: a **home/nav** (the tiles), shared **logins**, and the **spine**. Everything else is modules added one at a time.

## Tool glossary — what each tool is and does
- **Attio** (CRM): source of truth for operators (people & brands), clients (accounts), target connections, and deals.
- **Granola** (AI meeting notes): captures every call, brainstorm, and think tank; feeds the brain as raw context.
- **Drive** (cloud storage): holds docs and contracts, linked to the events and clients they belong to.
- **Slack** (team messaging): carries comms and nudges in and out of the hub (notifications, reactions, replies).
- **Claude** (AI engine — the brain): distills meetings into actions, generates plans, drafts comms, and answers questions across everything (scoped to the asker).
- **Supabase** (database — the spine): stores events, projects, and tasks; the shared backbone every module reads from and writes to.
- **Logins & permissions** (access control): real identity + row-level rules so each person sees only their slice — everything passes through here.
- **GitHub** (code repository): stores and versions the app's code.
- **Vercel** (hosting): publishes the app to the web; auto-deploys on push.

## The query bar (the brain, made ambient)
The brain isn't just one tile — it's a **query bar present everywhere**, scoped by where you are:
- **Hub home query bar** — asks across *everything you're allowed to see*: "what's overdue this week?", "what did we commit to MOMOS?", "draft a recap of today's calls."
- **Module query bars** — the same bar on each module page, scoped to that module's data. On Project Plans it answers about plans; inside an event it answers about that event (this is the live "Reports & Views" + "Add with Claude" — pattern already proven).
Every query bar inherits the permissions gate, so the answer set is always "only your slice."

## Permissions & data governance
**Principle:** the hub never *widens* access beyond what a meeting/record intended. A closed Marty+JG conversation never surfaces to anyone who wouldn't have been in the room. Permissions travel *with* the data, from source to a task in the hub.

**The scoped brain — how it actually works.** One brain, but every answer is filtered to what the asker is allowed to see (same question, different person, different answer). The implementation detail that must not be gotten wrong: filter **at retrieval, before the model ever sees the data** — never by asking Claude to "not mention X." The query bar pulls only the records you're entitled to, *then* hands those to Claude. Claude can't leak what it was never given. So the scoped brain = permission-aware retrieval + Claude on top, and it depends entirely on Layer 3.

**Three control layers — mechanism · consequence · sequence:**

1. **At the source (Granola).**
   - Mechanism: notes private by default; sharing explicit; API keys carry note-access scopes; folders/workspaces separate content.
   - Choice: a dedicated "858 Projects" Granola folder (only meetings dropped there are eligible) — or, stronger, per-user auth so the integration only reads your own notes.
   - Consequence: the folder is simple but leans on people filing meetings correctly; per-user auth is bulletproof but heavier. Sensitive 1:1s simply never become eligible.
   - Sequence: only strictly needed once ingestion is automatic; the manual pilot's human already does this job.

2. **At ingestion (how meetings enter).**
   - Mechanism: opt-in routing (the prompt) vs. auto-poll-everything.
   - Consequence: opt-in is safe by construction — a person is the gate, so it works with no security layer. It just doesn't scale to automatic.
   - Sequence: this is what we do now. Auto-ingestion waits for Layer 3.

3. **At the hub (who sees what).**
   - Mechanism: real logins + Supabase row-level security; meeting-derived items inherit project membership / attendee list; access tags on records.
   - Consequence: the real engineering (auth, roles, row-level policies). Prerequisite for THREE things at once: the scoped brain, automatic Granola ingestion, and any client data (the portal).
   - Sequence: must land before auto-Granola and before the client portal.

**The consequence that matters now:** until Layer 3 exists, the prototype has no real access control (anyone can "act as" anyone) — internally it's "everyone sees everything." So during the pilot, only route **shareable, project-type meetings** (event/client-prep calls the team already shares); keep sensitive 1:1s out entirely until logins land. The gate before then is *what you choose to route*, not the system.

**End-to-end sequence:**
1. Now — prompt-to-add-notes pilot (Layer 2), non-sensitive meetings only. Learn quality, meeting→event mapping, how much human editing it needs.
2. Foundational next — logins + RLS + access model (Layer 3). One build unlocks the scoped brain, automatic ingestion, AND client data.
3. Then — Granola folder/per-user scoping (Layer 1) + automatic ingestion + the scoped query bar, safely enforced by Layer 3.

---

## Reslotted roadmap

**Foundational (cross-cutting, do early)**
- **Define the spine** — finalize core entities + the ID links to Attio/Granola/Drive so modules snap in cleanly. (One-time data-model decision.)
- **Hub shell + logins + RLS** — the tiled landing page (with the hub query bar) + real authentication + row-level permissions. **Gates automatic Granola ingestion** and any shared client data. Moved AHEAD of auto-Granola. (Was parked Phase 4.)

**Module: Project plans (events) — LIVE, still refining**
- Phase 1: Library content & structure (Christina's 163-task CSV) — ✅ DONE.
- #40: dates + phase logic — ✅ DONE (due/start computed from library offsets + event date; pre/intra/post derived on the board; dates editable).
- Slack connector — ✅ LIVE (per-event pings + personal DMs, this-week & next-week digests, per-task status dropdown, two-way per-task comments, ✅/un-✅ complete & reopen). Back burner: auto-schedule digests (needs Vercel Pro) + adding the rest of the team.

**Module: Company brain (Granola) — START NOW**
- Pilot (this week, via the Cowork connector, no app changes): pull a recent meeting → Claude extracts action items + owners + decisions → propose as tasks on the right event plan (human approves).
- Accountability loop: commitments captured in meetings → "how's this looking?" nudge 48h later (rides the Slack reminder system).
- Ask-anything: query across meetings + plans ("what's outstanding from this week's think tanks?").
- Productize **after logins + RLS land**: Granola Business/Enterprise API key → app polls for new meetings (webhooks on Granola's roadmap; Zapier bridges meanwhile), scoped by a dedicated folder + attendee/project membership.

**Module: Client portal & dossiers (Attio) — Phase 6**
- Client-facing, read-only (flag targets, read, add notes); separate per client; cross-client ESM aggregation. Folds in: project brief/overview, client meeting tracker.

**Module: CRM (Attio) + Docs (Drive)** — later modules.

**Module: Reports & dashboards** — early version live; extend to cross-event/portfolio + company pulse.

---

## What changes vs. stays
- **Stays:** everything built. Project plans become Module 1; the Supabase backbone + Claude/Slack/UI patterns are reused by every module.
- **Changes:** the homepage becomes the hub landing (tiles); logins move up; we design the data model to the spine, not just events.

## Granola — get going now
Granola is already connected here in Cowork (read access to meetings, transcripts, summaries). The pilot needs nothing built — just a meeting to process. Decisions to set: (a) which meetings map to which event (by folder / attendees / you tagging it), (b) tasks land in a "proposed" review queue vs. straight in (recommend review first), (c) who can approve.
