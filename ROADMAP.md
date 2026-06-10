# 858 Project Tool — Roadmap (what's left)

Order is the recommended sequence.

## 0. START HERE TOMORROW — backups / failsafes (3 independent copies)
Cowork chats do NOT persist and the last computer wipe lost everything, so lock in redundancy first:
- **GitHub** (durable code + docs backup) — push everything, incl. the journal docs.
- **iCloud** — confirm the folder is fully synced (no pending-upload icon).
- **Google Drive (new failsafe to add)** — save the folder (code + all .md docs) to Drive too. Options to set up tomorrow: connect a Google Drive connector and copy the folder, or a scheduled export. Goal: PROJECT-JOURNAL.md, CHAT-HISTORY.md, ROADMAP.md, and the app are recoverable from any of the three.
- Also: email yourself the key links (GitHub repo, https://858-pm-app.vercel.app, Supabase project, Slack app).

## 1. Phase 2 — Slack @mentions + two-way comments (built, then parked)
- Owner gets **@-mentioned** (real ping) when their task hits *Needs review* or *Complete*.
- App comments **post into the task's Slack thread**; `@name` becomes a real mention.
- To finish: re-apply the parked code (it was reverted to keep Phase 1 clean — Claude has it),
  run `supabase/08-slack-users.sql`, and populate `slack_users` (each person's name + Slack member ID).

## 2. Anthropic key — turn on the AI buttons
- Nic creates the API key → add `ANTHROPIC_API_KEY` to Vercel env → redeploy.
- Lights up "✨ Generate with Claude" and "Add to plan with Claude".
- (Structured "Create event by activation" already works WITHOUT it.)

## 3. Christina co-editor doc refresh
- Do AFTER Phase 2 + Anthropic, in one pass, so it reflects the final feature set + admin tasks
  (managing the bot, the slack_users mapping). Core workflow in CHRISTINA-COEDIT-SETUP.md is still accurate now.

## 4. Security hardening (before going wider)
- Replace the "Acting as" switcher with real logins (Supabase Auth) + RLS policies.
- Required before anyone outside the core team — and a prerequisite for the client portal.

## 5. Client portal / dossiers (Attio-driven) — the next big project
- Build doc: CLIENT-PORTAL-BUILD-DOC.md.
- Non-negotiables: Attio drives all people data; clients can ONLY select targets + add text (no uploads).
- Phases: A) portal + prioritization + real auth  B) Attio enrichment + headshots  C) polish.

## 6. Housekeeping
- Delete the leftover no-op file `app/api/slack/cleanup/` (from a reverted idea).
