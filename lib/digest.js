// Shared logic for Slack digests + day-before reminders.
// "Current" projects = not past (matches the homepage rule: past = event_date before yesterday).

const REAL_PEOPLE = ['Christina', 'Fernando', 'JG', 'Nic', 'Chris', 'Marty']

// ---- Eastern-time date helpers (dates stored as YYYY-MM-DD) ----
export function etDateStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d) // YYYY-MM-DD
}
export function etHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(d))
}
export function etDow(d = new Date()) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(d)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(s)
}
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}
function dowOf(ymd) { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
export function prettyDate(ymd) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Window {start,end,label,headline} for each digest type, computed from ET "today".
export function windowFor(type, today = etDateStr()) {
  if (type === 'preview') {
    const daysToNextMon = ((8 - dowOf(today)) % 7) || 7
    const start = addDays(today, daysToNextMon)
    return { start, end: addDays(start, 6), headline: `:eyes: Next week's tasks (${prettyDate(start)}–${prettyDate(addDays(start, 6))})` }
  }
  if (type === 'remind') {
    const t = addDays(today, 1)
    return { start: t, end: t, headline: `:alarm_clock: Due tomorrow (${prettyDate(t)})` }
  }
  // weekly (Monday): today through +6
  return { start: today, end: addDays(today, 6), headline: `:calendar: This week's tasks (${prettyDate(today)}–${prettyDate(addDays(today, 6))})` }
}

// ids + meta for non-past projects
export async function currentProjects(sb) {
  const { data: projects } = await sb.from('projects').select('id,name,event_date')
  const cutoff = etDateStr(new Date(Date.now() - 86400000)) // yesterday ET
  const cur = (projects || []).filter(p => !p.event_date || p.event_date >= cutoff)
  const meta = {}; cur.forEach(p => { meta[p.id] = p })
  return { ids: cur.map(p => p.id), meta }
}

// open tasks with a due_date inside [start,end] on current projects
export async function tasksInWindow(sb, start, end) {
  const { ids, meta } = await currentProjects(sb)
  if (!ids.length) return { tasks: [], meta }
  const { data: tasks } = await sb.from('tasks')
    .select('id,title,owner,status,due_date,project_id')
    .in('project_id', ids).neq('status', 'done')
    .gte('due_date', start).lte('due_date', end)
    .order('due_date')
  return { tasks: (tasks || []), meta }
}

function ownerHas(owner, name) {
  return (owner || '').split('+').map(s => s.trim()).includes(name)
}

// A single task rendered as a section with a Mark-complete accessory button.
function taskLine(t, meta, showOwner) {
  const ev = meta[t.project_id]
  const bits = [`*${t.title}*`]
  if (t.due_date) bits.push(`_due ${prettyDate(t.due_date)}_`)
  const sub = [ev ? ev.name : 'Event', showOwner ? t.owner : null].filter(Boolean).join(' · ')
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: `• ${bits.join('  ')}\n  ${sub}` },
    accessory: { type: 'button', text: { type: 'plain_text', text: '✅ Complete' }, action_id: 'mark_complete', value: t.id }
  }
}

// Personal digest for one person: only their tasks, grouped by event, each with a button.
export function personalBlocks(person, tasks, meta, headline) {
  const mine = tasks.filter(t => ownerHas(t.owner, person))
  if (!mine.length) return null
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `${headline}\nHi ${person} — here's what's on your plate:` } }, { type: 'divider' }]
  const byEvent = {}
  mine.forEach(t => { (byEvent[t.project_id] = byEvent[t.project_id] || []).push(t) })
  for (const pid of Object.keys(byEvent)) {
    const ev = meta[pid]
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `*${ev ? ev.name : 'Event'}*${ev && ev.event_date ? ` · ${prettyDate(ev.event_date)}` : ''}` }] })
    byEvent[pid].forEach(t => blocks.push(taskLine(t, meta, false)))
  }
  return { text: `${headline.replace(/:[a-z_]+:/g, '').trim()} — ${mine.length} task(s)`, blocks: blocks.slice(0, 48) }
}

// Full cross-event overview for leads (read-only, no buttons — keeps block count sane).
export function fullBlocks(tasks, meta, headline) {
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `${headline}\n*Full team view — all current events*` } }, { type: 'divider' }]
  const byEvent = {}
  tasks.forEach(t => { (byEvent[t.project_id] = byEvent[t.project_id] || []).push(t) })
  for (const pid of Object.keys(byEvent)) {
    const ev = meta[pid]
    const lines = byEvent[pid].map(t => `• *${t.title}* — ${t.owner}${t.due_date ? ` _(due ${prettyDate(t.due_date)})_` : ''}`).join('\n')
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${ev ? ev.name : 'Event'}*${ev && ev.event_date ? ` · ${prettyDate(ev.event_date)}` : ''}\n${lines}` } })
    blocks.push({ type: 'divider' })
  }
  if (!tasks.length) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No open tasks in this window._' } })
  return { text: `${headline.replace(/:[a-z_]+:/g, '').trim()} — ${tasks.length} task(s)`, blocks: blocks.slice(0, 48) }
}

export { REAL_PEOPLE }
