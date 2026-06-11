# 858 Task Library — CSV Column Guide

This sheet is the master list of every task 858 can pull into an event plan. Fill one row per task. Below is exactly what each column means, with the allowed values.

**Two things that are NOT columns (the app does them for you):**
- **Pre / Intra / Post-event** is decided automatically by the due date (before the event = Pre, on the event date = Intra, after = Post). You never type it.
- **Due dates on a real event** can be changed freely on that event — it never changes this library.

---

## The 3 ways every task is labeled
- **activations** — *which events* get this task (the filter).
- **workstream** — *which flow* it belongs to (how it's grouped and ordered).
- **task_type** — *what kind* of work it is (a label for filtering/reporting only).

These are independent. A task can be Client type, in the "Attendee list" workstream, tagged "All events."

---

## Columns

| Column | What to put | Allowed values / examples |
|---|---|---|
| **title** | The task itself, short and clear. | "Send top-20 target request" |
| **workstream** | The flow/thread it belongs to. Tasks in the same workstream run in sequence — **list them in the order they happen.** | Project kickoff, Attendee list & targeting, Client engagement & comms, Dossiers & content, Seating & room, Program & run-of-show, Vendors & logistics, Photography, Onsite, Post-event |
| **task_type** | The kind of work (for filtering/reporting). | Client, Comms, Sponsor/partner logistics, Internal, Event logistics, Vendors, Content |
| **activations** | Which event types get this task. "All events" = every plan. Multiple separated by " / ". | All events · Luncheon · Bird circles · GRIP Meetings · 858 House · Presentation. e.g. "Luncheon / Bird circles" |
| **owner** | Default person responsible. | Christina, Fernando, Nic, JG, Chris, Marty, Team — or combos like "Chris + JG" |
| **due_amount** | The number in the due-date rule. | 3 |
| **due_unit** | The unit for that number. | days, weeks, months |
| **due_ref** | When the due date falls relative to the event. | before event · after event · on event date · varies |
| **start_amount** | *(optional — only for tasks that span time or repeat)* when work begins, the number. Leave blank for normal one-deadline tasks. | 6 |
| **start_unit** | *(optional)* unit for start. | days, weeks, months |
| **start_ref** | *(optional)* when the start falls. | before event · after event |
| **recurrence** | How often it repeats (between start and due). Leave as "none" for one-time tasks. | none, weekly, twice weekly, biweekly, monthly |
| **notes** | Context / instructions. (We pre-filled the original timing wording here as a reference — verify and clean up.) | "Clients check off 20 targets" |

---

## How the due date is calculated
> **Due date = the event date, moved [due_amount] [due_unit] [due_ref].**

- `3 / weeks / before event` → due 3 weeks before the event.
- `2 / days / after event` → due 2 days after.
- `0 / days / on event date` → due the day of.
- `varies` → no auto-date; set it by hand on the event.

## Reading examples
- **One-time:** *Send top-20 target request* — Attendee list & targeting · Client · All events · Nic · **4 / weeks / before event** · (start blank) · none.
- **Recurring:** *Update client EXT lists* — Attendee list & targeting · Client · All events · Christina · due **0 / days / on event date** · start **6 / weeks / before event** · **weekly**. → runs weekly from 6 weeks out until the event.

## Tips
- Leave `task_type` thoughtfully — it's a brand-new label, so decide it deliberately per task.
- For a range like "4–6 weeks out," we set **start** to the far bound (6 wks) and **due** to the near bound (4 wks). Adjust if you'd rather it be a single deadline.
- Order matters only *within* a workstream (top = happens first).
