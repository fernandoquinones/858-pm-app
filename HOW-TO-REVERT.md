# How to revert — your failsafe

Two ways to undo any change. Both are safe; **nothing is ever lost** — GitHub keeps every commit and Vercel keeps every past deployment.

---

## Option 1 — Vercel Instant Rollback (fastest, ~10 seconds, no code)

Use this when something looks wrong on the live site and you want the old version back **right now**.

1. Go to **vercel.com** → **858-pm-app** → **Deployments**.
2. Find the deployment from **before** the change you want to undo (use the time and commit message to spot it — the one tagged "Current"/Production is the live one).
3. Click the **⋯** on that earlier row → **Instant Rollback** (or **Promote to Production**).
4. Confirm. The live site is back to that version immediately.

This does **not** touch your code — you can re-promote the newer version anytime. It's purely a "show this old version live again" switch.

---

## Option 2 — Undo the change for good (GitHub Desktop)

Use this when you've decided you don't want a change at all.

1. Open **GitHub Desktop** → click the **History** tab (top-left, next to Changes).
2. Find the commit you want to undo (e.g. "Redesign board: Reports/Links header pills").
3. **Right-click it → "Revert changes in commit."**
4. That creates a **new** commit that cleanly undoes it → click **Push origin**.
5. Vercel auto-redeploys the reverted version (~2 min). Done.

Because it's a *new* commit (not a deletion), the change isn't lost — you can revert the revert later if you change your mind.

---

## The habit that makes reverting painless

**Commit each change on its own, with a clear message.** When a feature is its own commit, undoing it is a single right-click on that one commit — nothing else is affected. (That's why we name every push with a clear title.)

---

## Want to preview BEFORE it goes live?

For a risky change, push it to a **branch** instead of main: GitHub Desktop → **Branch → New Branch** ("test") → commit & push there. Vercel makes a **private preview link** so you can check it without touching the live site. If you like it: **Branch → Merge into main → Push**. If not: do nothing — the live site was never affected.
