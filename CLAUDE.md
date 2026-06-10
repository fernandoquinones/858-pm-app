# CLAUDE.md — working instructions for this project

**Project:** 858 Project Management Tool
**Live app:** https://858-pm-app.vercel.app
On opening this project, read **PROJECT-JOURNAL.md** (state), **CHAT-HISTORY.md** (full narrative), and **ROADMAP.md** (what's left) for context.

---

## Backup convention (applies to ALL projects)
Every project backs up to **Google Drive → "Claude" → "<Project name>"** (one folder per project, never mixed).
- "Claude" parent folder id: `1qeE4HRAsFxmisIYhVu-UsaQmCh0TGwCh`
- **This project's Drive folder:** "858 Project Management Tool" → id `1b1oBIt4o8ut0N3NiOHwl66Utr5E5dfr3`

## TRIGGER — when Fernando says "Save this project to Drive" (or any close variant)
Do ALL of the following, then confirm with the Drive folder link:
1. **Refresh the journals to current:**
   - `CHAT-HISTORY.md` — append everything since the last save (the conversation, decisions, ideas, what was built and why).
   - `PROJECT-JOURNAL.md` — update current state (what's live, decisions, file index, who owns what).
   - `ROADMAP.md` — update what's left.
2. **Gather all outputs** in this project folder — docs (.md), slides (.pptx), PDFs, spreadsheets (.xlsx), CSVs, etc.
3. **Upload to this project's Drive folder** (id above) via the Google Drive connector (create_file / copy_file). Before creating, `search_files` in the folder by title; if a file already exists, upload a fresh copy (the connector can't overwrite) and avoid duplicating unchanged files.
4. **Confirm** to Fernando exactly what was saved + the Drive folder link.

## New / other projects (e.g., Executive Growth)
When working in a DIFFERENT project and Fernando says "Save this project to Drive":
- Create `Claude → <that project's name>` if it doesn't exist, save that project's journals + outputs there, and write a `CLAUDE.md` in that project recording its Drive folder id. Each project stays in its own folder.

## Key facts / gotchas
- Owners are recorded as **Fernando** (casual synonym "Fern") and **JG** (casual synonym "Juan"); Fernando and JG are two DIFFERENT people.
- **Cowork chats do NOT persist** — keep CHAT-HISTORY.md + PROJECT-JOURNAL.md current in files; that's the real memory.
- **Git lock fix:** if GitHub Desktop says a lock file exists → quit it, `rm -f .git/index.lock`, reopen, push.
- Three failsafes for everything: **GitHub** (full mirror), **iCloud** (folder sync), **Google Drive** (Claude → project folder).
