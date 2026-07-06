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

// ---- Status labels + shared block builders ----
export const SLACK_STATUS = { todo: 'To do', prog: 'In progress', ongoing: 'Ongoing', review: 'Needs review', done: 'Done' }
const STATUS_EMOJI = { todo: '⚪️', prog: '🟡', ongoing: '🟣', review: '🟠', done: '✅' }

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
