# 858 Hub Build Plan — porting the CREATE 2026 artifact into the live app

_Turning the `CREATE_2026_Dashboard.jsx` demo into real, Supabase-backed, multi-user modules across the three hubs._

---

## 1. The core idea

The artifact is a **single-event knowledge base**: six modules, all click-to-edit, state held in memory, synced by a manual "Export to Claude" copy/paste. The live app is the production version of the same idea — persistent, auth'd, role-gated, Slack-wired.

Two changes convert one into the other:

1. **In-memory React state → Supabase tables** (data survives, everyone sees the same thing).
2. **"Export to Claude" → real persistence + an automated scanner** (the calendar scan runs on a schedule and writes findings to the DB instead of printing to chat).

The click-to-edit UX and the visual design carry over almost unchanged.

---

## 2. Module → Hub map

The artifact's six tabs are not all "client hub." Reviewed in full, they distribute across the three hubs already scaffolded:

| Artifact module | Lives in | Why |
|---|---|---|
| Overview (snapshot, contacts, quick stats, key notes, links, onsite strip) | **Event Hub** | Event-level facts, not per-client |
| Project Brief (reference, open questions, tech-stand reqs, benefits, GRIP timeline) | **Event Hub** | Event-level reference material |
| **Client Meetings (scanner + booking matrix)** | **Client Hub** | The crown jewel — per-client, automatable |
| **Client Tasks (contact, attendees, outstanding, notes)** | **Client Hub** | Per-client live data; stacks on today's to-do library |
| Onsite Team (hotel, confirmations, flights) | **Internal Hub** | Replaces the current placeholder |
| Run of Show (day-by-day agenda) | **Internal Hub** | Replaces the current placeholder |

> Do **not** pour all six into the Client Hub — it would collapse the page. The Client Hub gets two modules; the rest fill out the Event and Internal hubs.

---

## 3. How this stacks on what we built today

Today's work gave the Client Hub two layers already:

- **Client Task Library** (`client_task_library`) — the standard checklist every client starts with.
- **Per-client to-dos** (`client_todos`) — the working checklist.

The artifact adds a **live per-client data layer** on top:

- **Client Meetings** — prep / deal-strategy / debrief booking status per client (seeded by the scanner).
- **Attendees**, **primary contact**, **outstanding follow-ups**, **notes** per client.

So the finished Client Hub client card = **checklist (todos) + meetings + attendees + contact + outstanding + notes**. Nothing we built today gets thrown away; it becomes one layer of a richer card.

---

## 4. Data model

### 4a. Collapse the simple lists into one table

Most Overview / Project Brief / Run-of-Show-notes sections are just editable `label + value` or free-text lists. Rather than ~11 near-identical tables, use one generic block table:

```sql
event_blocks (
  id uuid pk,
  project_id uuid,
  hub text,          -- 'event' | 'internal'
  section text,      -- 'snapshot' | 'contacts' | 'quick_stats' | 'key_notes'
                     -- | 'links' | 'brief_reference' | 'open_questions'
                     -- | 'benefits' | 'grip_timeline' | 'tech_stand_reqs' | 'ros_notes'
  label text,
  value text,
  meta jsonb,        -- e.g. link url+category, contact role+email, flag owner
  sort_order int,
  created_at timestamptz default now()
)
```

One table, team-only RLS, renders every simple section. Avoids table sprawl.

### 4b. Dedicated tables for structured/relational data

These have real shape and deserve their own tables:

```sql
-- extend the existing event_clients with contact fields (no new table)
alter table event_clients add column contact_name text;
alter table event_clients add column contact_email text;

client_meetings (id, project_id, client_id, type,         -- 'prep'|'deal'|'debrief'
                 status,                                    -- 'Not Booked'|'Booked'|'Completed'|'N/A'
                 meeting_date date, notes text, source text, sort_order)

client_attendees (id, project_id, client_id, name, email, title, sort_order)

client_outstanding (id, project_id, client_id, item, done boolean, sort_order)

scan_flags (id, project_id, level,                          -- 'High'|'Medium'|'Low'
            text, source text, resolved boolean, scanned_at timestamptz)

onsite_team (id, project_id, name, role, emoji, email,
             hotel, confirmation_number, check_in, check_out,
             flight_in_date, flight_in_time, flight_in_from,
             flight_out_date, flight_out_time, flight_out_to,
             notes, sort_order)

ros_days  (id, project_id, label, day_date, color, sort_order)
ros_items (id, day_id, time, duration, title, notes, sort_order)
```

Config (meeting types → host, slot windows) can live in `event_blocks` (section `meeting_config`) so it's editable without a deploy.

Every new table needs the two team-only RLS policies (`team_read` / `team_write` via `is_team()`), per `13-rls.sql`.

---

## 5. Manual vs. scanned

| Data | Source |
|---|---|
| `client_meetings` status / date | **Scanned** (calendar, scheduled) — editable to override |
| `scan_flags` | **Scanned** — the anomaly findings |
| `client_attendees` | Scanned candidate (from invitees) **or** manual — decide per client |
| Everything else (overview, brief, onsite team, run of show, todos, outstanding, notes, contacts) | **Manual**, click-to-edit |

### The scanner (the reason this matters)

In the artifact the findings are static text. In the app it becomes a **scheduled job**, just like the digests:

1. Read `nic@` and `jg@` calendars via the calendar connector.
2. Match naming conventions: `CREATE Kickoff (Name)` → prep, `858: Deal Strategy Call (Name)` → deal, `CREATE Debrief` → debrief.
3. For each client × type, set Booked / Not Booked + date.
4. Raise `scan_flags` for gaps, non-standard names, date mismatches, declined invites.
5. Write to `client_meetings` + `scan_flags`; surface live in the Client Hub.

You already ran this scan live in the artifact session — so the connector works. Productionizing = "scheduled run + write to DB" instead of "print to chat." This is a Tier-1/Tier-2 automation straight off the tiers workbook.

**Dependency:** a Google Calendar connector wired into the app's scheduled-job environment (the digest bot). Confirm which account(s) the job authenticates as.

---

## 6. Editing model

Port the artifact's `Inline` / `InlineArea` / `InlineDate` primitives (looks like plain text; click to edit; blur/Enter saves; Esc cancels) into a shared `lib/Inline.jsx`. Gate writes by role: **masters edit, users read** — matches the existing `canEditTask` rule. Enum pills (booking status, flag level) reuse the same popup pattern.

Keep a **lightweight "brief for @Claude" export** (not the full-state JSON) so you can still hand event context to the Slack agent — but day-to-day, live persistence replaces copy/paste.

---

## 7. Two zoom levels — keep them distinct

- The **7×3 meeting matrix** is an *event-wide* view (all clients at once) → top of the Client Hub.
- **Attendees / todos / outstanding / notes** are a *per-client drill-down* → each client card.

Muddying these is the fastest way to make the page unreadable. Matrix up top, cards below (or a client → detail view).

---

## 8. Build sequence

1. **Client Hub v2** — `client_meetings` matrix + per-client attendees/contact/outstanding, layered on today's todos + library. (Manual entry first, so it's useful before the scanner exists.)
2. **Scanner automation** — confirm the calendar connector, build the scheduled scan → writes `client_meetings` + `scan_flags`.
3. **Event Hub** — Overview + Project Brief via `event_blocks` + the `Inline` primitives.
4. **Internal Hub** — Onsite Team + Run of Show (replace the placeholder) via the dedicated tables.

Ship 1 before 2 so the matrix is usable by hand while the automation is built.

---

## 9. Decisions — RESOLVED (2026-07-13)

1. **Data model:** generic `event_blocks` table for all simple label/value sections. ✅
2. **Attendees:** manual entry for now; "suggest from invitees" is a later add-on. ✅
3. **Export:** KEEP the full-state JSON "Export to Claude" button (un-reversed 2026-07-13) — plus a lighter "brief for @Claude" export. Current CREATE state captured to docs/CREATE_2026_state.json. ✅
4. **Scanner auth:** connect the Google Calendar connector as Fernando; Nic + JG share their
   calendars with him ("See all event details"). The scan runs as a **Claude scheduled task**
   (not the Slack bot) — it needs judgment + a connector — and writes findings to Supabase. ✅
   - _Prerequisite:_ connect Google Calendar to Claude; confirm Nic's & JG's calendars are shared to Fernando.
5. **Client Hub permissions (per-hub, overrides global roles):**
   - **Editors:** Nic, Beth, Christina.
   - **View-only:** Caitlin, JG, Fernando, Marty.
   - Note: this diverges from the global `isMaster` model (Fernando is owner globally but view-only here),
     so we implement a **per-hub editor allow-list**, not the existing `canEditTask`. Owner can flip it. ✅

## 10. Scanner architecture (resolved)

- **Runner:** a Claude scheduled task (`create_scheduled_task`), daily — NOT the deterministic Slack bot.
- **Reads:** Google Calendar connector (as Fernando) → `list_events` on Nic's + JG's calendars.
- **Logic:** match naming conventions per meeting type, set Booked/Not-Booked + date per client×type,
  raise anomaly flags (gaps, non-standard names, date mismatches, declines).
- **Writes:** `client_meetings` + `scan_flags` in Supabase (service-role, server-side).
- **Surfaces:** live in the Client Hub matrix; optionally a Slack ping on new High flags.
