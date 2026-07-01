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

// Edit EVERY Slack message for a task (channel post + any DMs) to a struck-through complete state.
export async function syncTaskCompleteMessages(sb, taskId, by) {
  try {
    const { data: task } = await sb.from('tasks').select('title').eq('id', taskId).single()
    if (!task) return
    const { data: links } = await sb.from('slack_links').select('channel,ts').eq('task_id', taskId)
    const text = `~*${task.title}*~  ✓ *Marked as complete*${by ? ' by ' + by : ''}`
    const blocks = [{ type: 'section', text: { type: 'mrkdwn', text } }]
    for (const l of (links || [])) { await chatUpdate(l.channel, l.ts, text, blocks) }
  } catch (e) {}
}

// ---- Shared block builders / sync helpers (added for digests + revert) ----

// The standard actionable message for a single task (used by notify + restore).
export function taskActionBlocks(task) {
  const text = `*${task.owner}* — task needs your attention: *${task.title}*${task.due_date ? ` (due ${task.due_date})` : ''}`
  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text } },
    { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '✅ Mark complete' }, style: 'primary', action_id: 'mark_complete', value: task.id }] },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'React :white_check_mark: or reply in thread to comment — it syncs to the web app. Remove the ✅ to reopen it.' }] }
  ]
  return { text, blocks }
}

// Inverse of syncTaskCompleteMessages: restore every linked message to its actionable state.
export async function restoreTaskMessages(sb, taskId) {
  try {
    const { data: task } = await sb.from('tasks').select('id,title,owner,due_date').eq('id', taskId).single()
    if (!task) return
    const { data: links } = await sb.from('slack_links').select('channel,ts').eq('task_id', taskId)
    const { text, blocks } = taskActionBlocks(task)
    for (const l of (links || [])) { await chatUpdate(l.channel, l.ts, text, blocks) }
  } catch (e) {}
}

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
