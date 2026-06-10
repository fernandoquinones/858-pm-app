# Client Portal & Dossiers — Build Doc (Attio-driven)

*Future module. Same foundation as the 858 Project Tool (Next.js + Supabase + Vercel). Non-negotiable #1: **Attio is the source of truth** for all people & brand data — the portal reads from it, never replaces it. Non-negotiable #2: in the final stage, clients can do **exactly two things**, scoped to their own event — (1) **select targets** from the provided attendee list and (2) **add text-only account details**. Nothing else: no file uploads, no attachments, no free-form content.*

Status: scoped, not started. Prereq: Anthropic + Slack keys for the existing tool first; this is the next module after.

---

## 1. What we're building
A **client-facing portal** (modeled on an airline app) where each client, per event, sees:
- their event(s), schedule, dossier, key actions
- an **interactive prioritization table** to pick targets from the attendee list (Tier 1/2, current customers, detractors)
- rich **attendee details** — headshot, title, brand, brand facts — pulled live from Attio

It reuses the event/plan data the internal tool already manages, and adds the client-facing layer + the attendee data spine.

---

## 2. The one rule: Attio drives the people data
- **Attio owns:** every person (attendee), company/brand, headshots, titles, brand facts, relationships. Single source of truth. Update once in Attio → correct everywhere.
- **The app (Supabase) owns only the event layer:** which attendees are at which event, each client's prioritization picks, seating, tasks, dossier layout. Every attendee row **references an Attio record ID** and pulls details live from Attio.
- **Never duplicate Attio's people data as a competing master.** The app may *cache* Attio reads for speed, but Attio always wins.

Two integration paths, both used:
1. **App → Attio REST API** (server-side, with an API token) — renders live data in the portal/dossier.
2. **Claude → Attio MCP connector** — for enrichment & auto-building dossier structure (the "Claude linked to Attio" idea). Connect via the Attio connector in Cowork.

---

## 3. Must-haves → components

### 3.1 Auto-populate the dossier from the project plan
The event already lives in Supabase (the project tool). The dossier is **another view** of it — agenda, schedule, team, maps — rendered client-facing. Low effort; mostly a presentation layer over existing data.

### 3.2 Attendee upload → interactive prioritization table
- Upload a registrant CSV → rows become an interactive table.
- Client ticks: **5 Tier 1, 5 Tier 2, 10 current customers, 20 detractors** (the existing prioritization exercise).
- Selections save to the app DB → feed seating + ESM trackers.
- Same table/interaction pattern already built in the project tool.
- **Final stage (non-negotiable): clients log in and do exactly two things, nothing more:**
  1. **Select targets** from the list we provide — toggle a person on/off and set their tier (Tier 1 / Tier 2 / current customer / detractor). Selection only; they can't add people.
  2. **Add account details as text** — type into defined text fields (e.g., notes/context on a target or account). Text only.
  - **Hard limits:** no file/image uploads, no attachments, no links, no creating attendees, no editing structure or anything outside those two actions. The client write surface is a short allowlist — that *is* the security model (see §6/§7).

### 3.3 Weekly registration updates
- A **scheduled job** (cron) imports the latest registrant list, adds new attendees, flags changes.
- Source: registration CSV export, or a direct feed from the reg system if one exists.
- Medium effort; the import + diff logic is the work.

### 3.4 Attendee enrichment from Attio  ← the heavy lift
For each registrant, pull from Attio: **headshot, title, brand/company, brand facts.**
- **Match** registrant → Attio person (by email, then LinkedIn URL, then name+company).
- **Audit layer:** flag unmatched people and mismatches (e.g., someone changed companies — "Dino moved from Portillo's to Giordano's") for a quick human review before publishing. This is Christina's audit logic.
- **Headshots:** must live in Attio (a file/image attribute on People). Getting them in is the perennial manual bottleneck — plan for it.
- Effort: high — not the code, the **data quality + matching + headshot coverage.**

### 3.5 The client portal itself
- Clients = a new **role** (scoped, mostly read) on the same auth system.
- Airline-app feel: upcoming events, dossier available day-of (like a boarding pass), post-event recap links, a carousel of upcoming inventory.
- One familiar hub per client; **no complex permissioning** — clients see only their own event(s).
- **Clients have authenticated, *narrowly-scoped* edit access** to their own target table: select targets + enter text account details only. No uploads, no attachments, no other writes. Internal plans, tasks, and other clients' data are invisible to them.

---

## 4. Data model (sketch)
**Attio (source of truth):**
- People (attendees) — headshot, title, company/brand, brand facts, LinkedIn
- Companies / Brands — parent-brand relationships

**Supabase (event layer; references Attio IDs):**
- `events` (already exists as projects)
- `event_attendees` — event_id, attio_person_id, registration status, source
- `client_priorities` — client_id, event_id, attio_person_id, tier (t1/t2/customer/detractor)
- `clients` — client org, which event(s), portal access
- `dossiers` — event_id, client_id, layout/content config
- (reuse) tasks, seating, comments, attachments

---

## 5. Phased build (recommended order)
**Phase A — Portal shell + prioritization (reuses what exists):**
1. Client role + scoped login (Supabase Auth).
2. Client home (their events) + read-only dossier view auto-populated from the plan.
3. Attendee CSV upload → prioritization table → saves picks. *(No Attio yet — uses uploaded fields.)*
4. **Real client auth from day one** — because clients edit their own target table, Phase A must ship proper per-client login + RLS (not the internal honor-system role switcher). This is the security floor for the portal.
→ Delivers a usable portal fast, validates client appetite before the heavy lift.

**Phase B — Attio as the people engine:**
4. Attio API token + read integration (server-side).
5. Match registrants → Attio people; build the audit/review screen.
6. Pull headshots/title/brand/facts into the attendee + dossier views.
7. Weekly scheduled sync of new registrations.

**Phase C — Polish:**
8. Day-of dossier release, recap links, upcoming-inventory carousel.
9. Claude+Attio auto-drafting of dossier content.

---

## 6. Prerequisites & decisions
- **Attio API token** — who admins Attio generates a token (read scope to start).
- **Headshots in Attio** — confirm the attribute and a plan to populate (the bottleneck).
- **Matching keys** — confirm registrants carry email/LinkedIn to match cleanly to Attio.
- **Where dossiers ultimately live** — in this portal (recommended, one system) vs. Notion/Webflow. Decide before Phase A.
- **Client access model** — magic-link / email login, scoped to their events. No heavy permissioning.
- **Client write security (required)** — clients' write surface is an explicit **allowlist of two actions: select targets, enter text**. Enforce it server-side, not just in the UI:
  - Real per-client authentication + **row-level security** scoping each client to their own event and selections.
  - **No Storage/upload access for clients** — the upload bucket and attachment writes stay internal-only.
  - Text fields **validated & sanitized**, length-capped; clients can only write to the allowed columns (priorities + their text fields), nothing else.
  - The internal "Acting as" switcher does NOT suffice for external clients.

---

## 7. Risks (carry forward Nic's "validate before you build")
- **Data quality is the real project**, not the code — headshot coverage and Attio completeness gate the whole thing.
- **Build Phase A first and put it in front of a client** before investing in the Attio enrichment, to confirm clients actually use the portal (same caution as the audio/Metabase pattern).
- **Don't fork the people data** — if anything other than Attio becomes a second master, you've recreated the version-drift problem.
- **External write access raises the security bar** — but the *narrow* surface (select + text only, no uploads) keeps it manageable. Enforce the allowlist server-side with RLS; never rely on the UI alone to limit clients. Get this right before exposing the portal externally.

---

## 8. What we reuse from the project tool
Roughly 60–70% of the foundation carries over: the stack, Supabase spine, auth/roles pattern, table/upload UI, the brand theme, scheduled-job pattern, and Claude integration approach. The genuinely new work is the **Attio integration + match/audit layer + client-scoped portal views.**

*Next concrete step when you return: connect the Attio MCP in Cowork so we can inspect the real CRM schema, then turn Phase A into exact tasks.*
