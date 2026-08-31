import { sb } from '../../../../lib/supabaseServer'
import { dmUser } from '../../../../lib/slack'
import { etDow, etHour } from '../../../../lib/digest'

// DETERMINISTIC, multi-event, DISCOVERY scanner. Each event posts generic booking links
// ("fstec kickoff", "fstec deal strategy", "fstec debrief call"). When someone books, the
// calendar title becomes "... (Firstname Lastname)" and the booker's email domain = the company.
// The scanner reads each event's configured calendars (scan_meeting_types), DISCOVERS a client
// per company domain, and fills the matrix — no pre-listing needed. Runs twice daily per event.
const TEAM_DOMAIN = '858partners.com'
const SKIP_DOMAINS = ['group.calendar.google.com', 'resource.calendar.google.com', 'lu.ma']
const GENERIC_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'aol.com']
const extDomain = e => (String(e || '').split('@')[1] || '').toLowerCase()
const humanize = e => String(e || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
const companyFromDomain = d => { const base = String(d || '').split('.')[0]; return base ? base.charAt(0).toUpperCase() + base.slice(1) : d }
const domainOf = c => String(c.company_domain || '').toLowerCase().replace(/^@/, '').trim()

function authed(req) {
  const need = process.env.CRON_SECRET; if (!need) return false
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  return bearer === need || new URL(req.url).searchParams.get('secret') === need
}
async function googleToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: process.env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error('google token: ' + JSON.stringify(j)); return j.access_token
}
async function listEvents(token, calendarId, q, timeMin, timeMax) {
  const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  if (q) u.searchParams.set('q', q)
  u.searchParams.set('timeMin', timeMin); u.searchParams.set('timeMax', timeMax)
  u.searchParams.set('singleEvents', 'true'); u.searchParams.set('orderBy', 'startTime'); u.searchParams.set('maxResults', '200')
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  return (j.items || []).map(e => ({
    title: e.summary || '',
    date: (e.start && (e.start.date || (e.start.dateTime || '').slice(0, 10))) || null,
    time: (e.start && e.start.dateTime) ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: (e.start.timeZone || 'America/New_York') }).format(new Date(e.start.dateTime)) : null,
    attendees: (e.attendees || []).map(a => { const email = (a.email || ''); return { email, name: a.displayName || humanize(email), response: a.responseStatus, domain: extDomain(email) } }),
  }))
}
// external (client-side) attendees on an event
const externals = e => e.attendees.filter(a => a.domain && a.domain !== TEAM_DOMAIN && !SKIP_DOMAINS.some(s => a.domain.includes(s)) && !a.email.includes('calendar-invite'))
// the booker = external attendee whose surname is in the title, else the first external
function pickBooker(e, ext) {
  const title = (e.title || '').toLowerCase()
  return ext.find(a => { const p = (a.name || '').toLowerCase().split(/\s+/); const last = p[p.length - 1]; return last && last.length > 2 && title.includes(last) }) || ext[0]
}

async function scanEvent(token, project, types) {
  const timeMin = new Date(Date.now() - 45 * 864e5).toISOString()
  const timeMax = new Date(Date.now() + 45 * 864e5).toISOString()

  // 1) gather bookings per meeting type (only client-attended events)
  const bookingsByType = {}
  for (const t of (types || [])) {
    const events = await listEvents(token, t.calendar, t.match || '', timeMin, timeMax)
    bookingsByType[t.type] = events.map(e => { const ext = externals(e); return { title: e.title, date: e.date, time: e.time, ext, booker: ext.length ? pickBooker(e, ext) : null } }).filter(b => b.booker)
  }

  let { data: clients } = await sb.from('event_clients').select('id,name,company_domain,contact_name,contact_email,sort_order').eq('project_id', project.id)
  clients = clients || []
  // match a booking to a client by company domain, or the client's contact name in the title
  const bookingFor = (c, type) => {
    const d = domainOf(c)
    return (bookingsByType[type] || []).find(b => (d && b.booker.domain === d) || (c.contact_name && (b.title || '').toLowerCase().includes(c.contact_name.toLowerCase())))
  }
  // 2) discover a NEW client per company domain, but skip domains a pre-listed client already owns
  const claimed = new Set()
  for (const c of clients) for (const t of (types || [])) { const b = bookingFor(c, t.type); if (b && b.booker) claimed.add(b.booker.domain) }
  const seen = {}
  for (const t of (types || [])) for (const b of (bookingsByType[t.type] || [])) { const d = b.booker.domain; if (d && !GENERIC_DOMAINS.includes(d) && !claimed.has(d) && !seen[d]) seen[d] = b.booker }
  for (const d of Object.keys(seen)) {
    if (clients.find(c => domainOf(c) === d)) continue
    const bk = seen[d]
    const { data: ins } = await sb.from('event_clients').insert({ project_id: project.id, name: companyFromDomain(d), company_domain: d, contact_name: bk.name || null, contact_email: bk.email || null, sort_order: clients.length }).select().single()
    if (ins) clients.push(ins)
  }
  const rows = []; const flags = []; const perClient = {}
  for (const c of clients) {
    perClient[c.name] = {}
    for (const t of (types || [])) {
      const b = bookingFor(c, t.type)
      if (b) {
        const namesBy = st => b.ext.filter(a => a.response === st).map(a => a.name).filter(Boolean).join(', ') || null
        rows.push({ project_id: project.id, client_id: c.id, type: t.type, status: 'Booked', meeting_date: b.date || null, meeting_time: b.time || null, event_title: b.title || null, participants: b.ext.map(a => a.name).filter(Boolean).join(', ') || null, declines: namesBy('declined'), tentative: namesBy('tentative'), no_response: namesBy('needsAction'), source: 'scan', updated_at: new Date().toISOString() })
        perClient[c.name][t.type] = true
      } else {
        rows.push({ project_id: project.id, client_id: c.id, type: t.type, status: 'Not Booked', meeting_date: null, meeting_time: null, event_title: null, participants: null, declines: null, tentative: null, no_response: null, source: 'scan', updated_at: new Date().toISOString() })
        flags.push({ level: 'High', text: `${c.name} · ${t.label} not booked`, client_id: c.id })
        perClient[c.name][t.type] = false
      }
    }
  }
  for (const r of rows) { try { await sb.from('client_meetings').upsert(r, { onConflict: 'client_id,type' }) } catch (e) {} }
  await sb.from('scan_flags').delete().eq('project_id', project.id).eq('source', 'scan').eq('resolved', false)
  if (flags.length) await sb.from('scan_flags').insert(flags.map(f => ({ project_id: project.id, level: f.level, text: f.text, client_id: f.client_id, source: 'scan', scanned_at: new Date().toISOString() })))
  return { clients: clients.length, booked: rows.filter(r => r.status === 'Booked').length, total: rows.length, perClient, typeLabels: Object.fromEntries((types || []).map(t => [t.type, t.label])) }
}

async function sendBethDigest(data) {
  const { data: su } = await sb.from('slack_users').select('slack_id').eq('name', 'Beth').maybeSingle()
  if (!su || !su.slack_id) return false
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `:date: *End-of-week booking report* — who's booked and who isn't, per event.` } }, { type: 'divider' }]
  for (const d of data) {
    const clients = Object.keys(d.perClient); if (!clients.length) continue
    const lines = clients.map(cn => { const m = d.perClient[cn]; const miss = Object.keys(m).filter(k => !m[k]).map(k => d.typeLabels[k] || k); return miss.length ? `❌ *${cn}* — missing: ${miss.join(', ')}` : `✅ *${cn}* — all booked` })
    const fully = clients.filter(c => Object.values(d.perClient[c]).every(Boolean)).length
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${d.project.name}* — ${fully}/${clients.length} clients fully booked\n${lines.join('\n')}` } })
    blocks.push({ type: 'divider' })
  }
  const dm = await dmUser(su.slack_id, 'End-of-week booking report', blocks)
  return !!(dm && dm.ts)
}

export async function scanAll(force) {
  const { data: cfg } = await sb.from('scan_meeting_types').select('*').order('sort_order')
  if (!cfg || !cfg.length) return { ok: true, events: 0, note: 'no scan setup configured yet' }
  const byProject = {}
  for (const r of cfg) (byProject[r.project_id] = byProject[r.project_id] || []).push(r)
  const { data: projects } = await sb.from('projects').select('id,name,archived').in('id', Object.keys(byProject))
  const token = await googleToken()
  const results = []; const digestData = []
  for (const p of (projects || [])) {
    if (p.archived) continue
    const r = await scanEvent(token, p, byProject[p.id])
    results.push({ event: p.name, clients: r.clients, booked: r.booked, total: r.total })
    digestData.push({ project: p, perClient: r.perClient, typeLabels: r.typeLabels })
  }
  let bethDigest = false
  if (force || (etDow() === 5 && etHour() >= 16 && etHour() < 20)) bethDigest = await sendBethDigest(digestData)
  return { ok: true, events: results.length, results, bethDigest }
}
async function run(req) {
  if (!authed(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  try { return Response.json(await scanAll(new URL(req.url).searchParams.get('bethdigest') === '1')) }
  catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
export async function GET(req) { return run(req) }
export async function POST(req) { return run(req) }
