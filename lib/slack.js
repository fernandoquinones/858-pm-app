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
