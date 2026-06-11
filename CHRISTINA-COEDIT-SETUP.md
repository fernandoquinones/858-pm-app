# How Christina Joins — Sesame Street Simple

Read top to bottom. Every step says exactly what to click and what you'll see. No experience needed.

First, the big picture in one breath:
- **Using the tool** = open a web link. Christina can do this today, from her own computer, nothing to set up.
- **Changing how the tool works** (fixing a bug, adding a feature) = a few one-time setup steps below, then she does it with Claude — just like Fernando.

---

# PART 1 — Christina just wants to use it (0 setup)

1. Fernando sends Christina the live link (the `…vercel.app` web address).
2. Christina opens it in her browser (Chrome, Safari, whatever).
3. **Top-right corner: set "Acting as" to "Christina (master)."** This tells the app who she is and unlocks full access. *(Right now the tool has no passwords yet — you just pick your name from this menu. Real logins are coming later.)*
4. That's it. She's in.

**What "master" lets Christina do (same as Fernando):**
- **Create an event** two ways: the structured way (type a name + date, click the activations like Luncheon / GRIP / Bird circles, and it builds the plan straight from your task library) — or describe it to Claude in a sentence and let it draft the plan.
- **Add, edit, and delete tasks**, set each task's owner, and tag which activations it applies to.
- **"Add to plan with Claude"** — type "add a GRIP activation" and it pulls the right tasks in.
- **Build seating**, **comment** on any task, and **attach files or links**.
- **Connect a Slack channel** to an event so updates flow both ways.
- **Delete a whole event** from the homepage (the red Delete button on each card).

Everything saves to the shared cloud instantly and shows up for the whole team.

**If that's all she needs, you're done. The rest of this doc is only for letting her change the app itself.**

---

# PART 2 — Letting Christina also fix/change the app

Think of it like giving her a key to the workshop, not just the showroom. Three short parts.

## PART A — Fernando hands over a key (do this once, ~5 min)

**A1. Invite her on GitHub** (GitHub = where the app's code is stored online)
1. Go to **github.com** and open your `858-pm-app` page.
2. Click **Settings** (top menu of that page).
3. On the left, click **Collaborators**.
4. Click the green **Add people** button.
5. Type Christina's GitHub username or email -> click **Add**.
   - *(If she doesn't have a GitHub account yet, she makes a free one at github.com first — takes 2 minutes — then you invite that.)*

**A2. Invite her on Vercel** (Vercel = what publishes the app to the web)
1. Go to **vercel.com** and open the `858-pm-app` project.
2. Click **Settings** -> **Members** (left side).
3. Click **Invite**, enter Christina's email, send it.

**A3. Tell Christina to check her email** and click **Accept** on both invites.

OK — done with Part A. Christina now has a key.

## PART B — Christina sets up her workshop (do this once, ~10 min)

**B1. Install GitHub Desktop** (a friendly app, no typing required)
1. Go to **desktop.github.com** -> **Download** -> install -> open it.
2. Click **Sign in to GitHub.com** -> it opens her browser -> click **Authorize**. Now it's connected.

**B2. Make her own copy of the code** (called "cloning" — just means download a copy)
1. In GitHub Desktop: top menu **File -> Clone Repository**.
2. In the list, click **858-pm-app** -> click **Clone**.
3. Wait a few seconds. She now has the code on her Mac.

**B3. Point Claude at it**
1. Open **Claude / Cowork** on her computer.
2. Connect it to the `858-pm-app` folder GitHub Desktop just downloaded (same way Fernando did).
3. There's a `CLAUDE.md` file in that folder — Claude reads it automatically and gets the full context of the project, so she's not starting cold.

OK — done with Part B. Christina can now change the app.

## PART C — Making a change (either of you, every time)

Picture three buttons: **describe it -> save it -> send it.**

1. **Describe it.** In Claude/Cowork, say what you want in plain English. Example: *"Let me filter the task list by owner."* Claude edits the code for you.
2. **Save it (Commit).** Open **GitHub Desktop**. It shows the file(s) that changed. In the bottom-left box, type a short note like `add owner filter` -> click the blue **Commit to main** button. *(Commit = save a labeled snapshot.)*
3. **Send it (Push).** At the top, click **Push origin**. *(Push = upload your snapshot to the shared online copy.)*
4. **Wait ~2 minutes.** Vercel automatically rebuilds and the change is live for the whole team. Refresh the website to see it.

That's the entire loop. No terminal. Claude writes the code; you click two buttons.

**If GitHub Desktop ever says a file is "locked" (`index.lock`):** fully quit GitHub Desktop, reopen it, and try the Push again. That clears it.

---

# OPTIONAL — The "test before everyone sees it" safety move

Anything you Push goes live for everyone right away. For a *risky* change, test it privately first:

1. In GitHub Desktop, **before** committing: top menu **Branch -> New Branch** -> name it `test` -> **Create**. *(A branch = a private side-copy that doesn't affect the live site.)*
2. Make the change, **Commit**, and **Push** — but this time it's on the `test` branch.
3. Vercel makes a **private preview link** for it. Open that link, check the change works.
4. If it's good: GitHub Desktop -> **Branch -> Merge into main** -> Push. Now it's live.
5. If it's bad: do nothing. The live site was never touched.

Rule of thumb: tiny obvious tweaks -> just Push to main. Anything bigger -> test on a branch first.

---

# The 4 words, in plain English
- **Repository ("repo")** — the folder holding the app's code, stored online on GitHub.
- **Clone** — download your own copy of that folder to your computer.
- **Commit** — save a labeled snapshot of your changes.
- **Push** — upload your snapshot so it becomes the shared, live version.

# Three good habits
1. **Pick your name in "Acting as"** when you open the tool, so edits are attributed to the right person.
2. **Give each other a heads-up** (a quick Slack: "editing the task page now") so you're not changing the same thing at the same moment.
3. **Turn fixes into buttons.** The best changes make something editable *in the app* (like the activations bar and the owner dropdown), so next time it's a click — not a code change. Over time, almost nothing needs the workshop.
