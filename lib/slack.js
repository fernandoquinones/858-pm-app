import { PEOPLE } from './roles'
// Server helpers for per-event Slack channels.
const TOKEN = () => process.env.SLACK_BOT_TOKEN

function slugify(name) {
  return ('858-' + (name || 'event')).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || '858-event'
}

// Create a public channel for a project. Returns {id,name} or {error}/{skipped}.
export async function createSlackChannel(name) {
  const token = TOKEN()
  if (!token) return { skipped: true }
  const base = slugify(name)
  let attempt = base
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://slack.com/api/conversations.create', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: attempt })
    })
    const j = await r.json()
    if (j.ok) return { id: j.channel.id, name: j.channel.name }
    if (j.error === 'name_taken') { attempt = (base + '-' + Math.floor(Math.random() * 1000)).slice(0, 80); continue }
    return { error: j.error }
  }
  return { error: 'name_taken' }
}

export async function postToChannel(channel, text, blocks) {
  const token = TOKEN()
  if (!token || !channel) return { skipped: true }
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, text, blocks })
  })
  return r.json()
}

// Delete a single Slack message by (channel, ts). Only works on the bot's own messages.
export async function chatDelete(channel, ts) {
  const token = TOKEN()
  if (!token || !channel || !ts) return
  try {
    await fetch('https://slack.com/api/chat.delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, ts })
    })
  } catch (e) {}
}

// Edit one of the bot's own messages by (channel, ts).
export async function chatUpdate(channel, ts, text, blocks) {
  const token = TOKEN()
  if (!token || !channel || !ts) return { skipped: true }
  try {
    const r = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, ts, text, blocks })
    })
    return r.json()
  } catch (e) { return { error: String(e) } }
}

// Open a DM with a user and post a message. Returns {channel, ts} or {skipped}/{error}.
export async function dmUser(slackId, text, blocks) {
  const token = TOKEN()
  if (!token || !slackId) return { skipped: true }
  try {
    const open = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify({ users: slackId })
    })
    const oj = await open.json()
    if (!oj.ok) return { error: oj.error }
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel: oj.channel.id, text, blocks })
    })
    const j = await r.json()
    if (!j.ok) return { error: j.error }
    return { channel: j.channel, ts: j.ts }
  } catch (e) { return { error: String(e) } }
}

// Resolve a user's DM channel id (idempotent — same id each time). Used to detect
// whether an owner already has a task DM thread before we create a new one.
export async function dmChannelFor(slackId) {
  const token = TOKEN()
  if (!token || !slackId) return null
  try {
    const r = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify({ users: slackId })
    })
    const j = await r.json()
    return j.ok ? j.channel.id : null
  } catch (e) { return null }
}

// ---- Status labels + shared block builders ----
export const SLACK_STATUS = { todo: 'To do', prog: 'In progress', hold: 'On hold', ongoing: 'Ongoing', review: 'Needs review', done: 'Done' }
const STATUS_EMOJI = { todo: '⚪️', prog: '🟡', hold: '⏸️', ongoing: '🟣', review: '🟠', done: '✅' }

function statusSelect(task) {
  const cur = SLACK_STATUS[task.status] ? task.status : 'todo'
  const options = Object.keys(SLACK_STATUS).map(k => ({ text: { type: 'plain_text', text: `${STATUS_EMOJI[k]} ${SLACK_STATUS[k]}` }, value: `${task.id}::${k}` }))
  return { type: 'static_select', action_id: 'set_status', placeholder: { type: 'plain_text', text: 'Set status' }, options, initial_option: options.find(o => o.value === `${task.id}::${cur}`) }
}

// The standard actionable message for a single task: title + status dropdown + comment hint.
// opts.eventName / opts.eventDate add an event label (used in digests).
export function taskActionBlocks(task, opts = {}) {
  const done = task.status === 'done'
  const title = done
    ? `~*${task.title}*~  ✅ *Done*`
    : `*${task.owner}* — *${task.title}*${task.due_date ? ` _(due ${task.due_date})_` : ''}`
  const blocks = []
  if (opts.eventName) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `📌 *${opts.eventName}*${opts.eventDate ? ` · ${opts.eventDate}` : ''}` }] })
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: title } })
  blocks.push({ type: 'actions', elements: [statusSelect(task)] })
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Set status above · reply in this thread to comment — it all syncs to the web app.' }] })
  return { text: `${task.title} — ${SLACK_STATUS[task.status] || 'To do'}`, blocks }
}

// DM one person a header + one TRACKED message per task, so each task gets its own
// status dropdown AND its own comment thread (bidirectional, like single-task pings).
export async function dmPersonalTasks(sb, slackId, person, tasks, meta, headline) {
  if (!slackId || !tasks || !tasks.length) return 0
  await dmUser(slackId, headline, [{ type: 'section', text: { type: 'mrkdwn', text: `${headline}\nHi ${person} — ${tasks.length} on your plate. Set a status or reply in a task's thread to comment:` } }])
  let ok = 0
  for (const t of tasks) {
    const ev = meta[t.project_id]
    const { text, blocks } = taskActionBlocks(t, ev ? { eventName: ev.name, eventDate: ev.event_date } : {})
    const r = await dmUser(slackId, text, blocks)
    if (r && r.ts) {
      ok++
      try { await sb.from('slack_links').upsert({ task_id: t.id, project_id: t.project_id, channel: r.channel, ts: r.ts }, { onConflict: 'channel,ts' }) } catch (e) {}
    }
  }
  return ok
}

// Re-render EVERY Slack message for a task (channel post + any DMs) to reflect its current status.
export async function renderTaskMessages(sb, taskId) {
  try {
    const { data: task } = await sb.from('tasks').select('id,title,owner,due_date,status').eq('id', taskId).single()
    if (!task) return
    const { data: links } = await sb.from('slack_links').select('channel,ts').eq('task_id', taskId)
    const { text, blocks } = taskActionBlocks(task)
    for (const l of (links || [])) { await chatUpdate(l.channel, l.ts, text, blocks) }
  } catch (e) {}
}

// Back-compat wrappers (used by complete/events routes): both just re-render current status.
export async function syncTaskCompleteMessages(sb, taskId, by) { return renderTaskMessages(sb, taskId) }
export async function restoreTaskMessages(sb, taskId) { return renderTaskMessages(sb, taskId) }

// Post a reply into a message thread (used to mirror web-app comments into Slack).
export async function postThreadReply(channel, thread_ts, text) {
  const token = TOKEN()
  if (!token || !channel || !thread_ts) return { skipped: true }
  try {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, thread_ts, text })
    })
    return r.json()
  } catch (e) { return { error: String(e) } }
}


// Fan a new comment out to everyone involved in a task — its owner(s) PLUS anyone
// who has already commented — via each person's DM thread (created on first contact),
// so conversations go back and forth. Skips the author and the thread it came from.
// Called by both the web path (comment-notify) and the Slack path (events).
export async function notifyParticipants(sb, { taskId, author, body, exceptChannel }) {
  try {
    const token = TOKEN(); if (!token || !taskId) return { skipped: true }
    const { data: task } = await sb.from('tasks').select('id,title,owner,project_id').eq('id', taskId).single()
    if (!task) return { skipped: 'no task' }
    const { data: proj } = await sb.from('projects').select('name').eq('id', task.project_id).single()
    const evTag = proj && proj.name ? `📌 *${proj.name}*\n` : ''
    const mirror = `💬 *${author || 'Someone'}*: ${body}`
    const lc = String(author || '').toLowerCase()

    // recipients = task owners + everyone who has commented, minus the author
    const ownerNames = String(task.owner || '').split(/[+&,]/).map(x => x.trim()).filter(Boolean)
    const { data: cmts } = await sb.from('comments').select('author').eq('task_id', taskId)
    const commenters = [...new Set((cmts || []).map(c => (c.author || '').trim()).filter(Boolean))]
    const adminNames = PEOPLE.filter(p => p.role === 'admin').map(p => p.name)   // Christina: notified on ALL comments
    const names = [...new Set([...ownerNames, ...commenters, ...adminNames])].filter(n => n && n.toLowerCase() !== lc)

    const { data: links } = await sb.from('slack_links').select('channel,ts,slack_id').eq('task_id', taskId)
    const { data: users } = names.length ? await sb.from('slack_users').select('name,slack_id').in('name', names) : { data: [] }

    const done = new Set()
    const reply = async (channel, ts) => { const k = channel + '|' + ts; if (done.has(k) || channel === exceptChannel) return; done.add(k); await postThreadReply(channel, ts, mirror) }

    // 1) event-channel post threads (non-DM links)
    for (const l of (links || [])) { if (!l.slack_id) await reply(l.channel, l.ts) }

    // 2) each recipient's DM thread — reply if it exists, else open one
    let dmed = 0
    for (const u of (users || [])) {
      if (!u.slack_id) continue
      const dch = await dmChannelFor(u.slack_id)
      if (!dch || dch === exceptChannel) continue
      const mine = (links || []).find(l => l.channel === dch)
      if (mine) { await reply(mine.channel, mine.ts) }
      else {
        const r = await dmUser(u.slack_id, `${evTag}💬 *${author || 'Someone'}* commented on *${task.title}*:\n>${body}\n_Reply in this thread to respond — it syncs to the plan._`)
        if (r && r.ts) { dmed++; done.add(r.channel + '|' + r.ts); try { await sb.from('slack_links').upsert({ task_id: task.id, project_id: task.project_id, channel: r.channel, ts: r.ts, slack_id: u.slack_id }, { onConflict: 'channel,ts' }) } catch (e) {} }
      }
    }
    return { ok: true, dmed }
  } catch (e) { return { error: String(e) } }
}


// A task moved to "Needs review" — DM the reviewer(s) (owner/admin) directly in the
// personal bot, WITH the event label. Not posted to the channel. Their DM thread syncs
// back (status dropdown + reply-to-comment), like any tracked task message.
export async function notifyReview(sb, taskId, actor) {
  try {
    const token = TOKEN(); if (!token || !taskId) return { skipped: true }
    const { data: task } = await sb.from('tasks').select('id,title,owner,status,project_id,due_date').eq('id', taskId).single()
    if (!task) return { skipped: 'no task' }
    // Only ping for tasks that have already been surfaced in Slack (a digest, comment, or prior push).
    const { data: pushed } = await sb.from('slack_links').select('task_id').eq('task_id', taskId).limit(1)
    if (!pushed || !pushed.length) return { ok: true, skipped: 'task not pushed to Slack' }
    const { data: project } = await sb.from('projects').select('name,event_date').eq('id', task.project_id).single()
    const reviewerNames = PEOPLE.filter(p => p.role === 'admin').map(p => p.name)   // Christina reviews
    const ownerNames = String(task.owner || '').split(/[+&,]/).map(x => x.trim()).filter(Boolean)
    let recips = [...new Set([...reviewerNames, ...ownerNames])].filter(n => n && n.toLowerCase() !== String(actor || '').toLowerCase())
    if (!recips.length) recips = PEOPLE.filter(p => p.role === 'owner').map(p => p.name)   // fallback: Fernando
    const { data: users } = await sb.from('slack_users').select('name,slack_id').in('name', recips)
    const tab = taskActionBlocks(task, { eventName: project && project.name, eventDate: project && project.event_date })
    const blocks = [{ type: 'context', elements: [{ type: 'mrkdwn', text: `🔎 *${actor || 'Someone'}* moved this to *Needs review*` }] }, ...tab.blocks]
    let dmed = 0
    for (const u of (users || [])) {
      if (!u.slack_id) continue
      const dm = await dmUser(u.slack_id, `🔎 Needs review: ${task.title}`, blocks)
      if (dm && dm.ts) { dmed++; try { await sb.from('slack_links').upsert({ task_id: task.id, project_id: task.project_id, channel: dm.channel, ts: dm.ts, slack_id: u.slack_id }, { onConflict: 'channel,ts' }) } catch (e) {} }
    }
    return { ok: true, dmed }
  } catch (e) { return { error: String(e) } }
}
