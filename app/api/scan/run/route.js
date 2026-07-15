import { sb } from '../../../../lib/supabaseServer'

// SERVER-SIDE CREATE scanner. Runs on Vercel (Cron or manual) — no Claude sandbox,
// so the org egress allowlist never applies. Flow:
//   1) refresh a Google access token (reads Nic's + JG's calendars, shared to Fernando)
//   2) pull CREATE meetings from both calendars
//   3) ask the Anthropic API to map them to clients + raise flags (the judgment layer)
//   4) write client_meetings + scan_flags to Supabase (service key, server-side)
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Manual runs may pass
// the same bearer or `?secret=`.
const PROJECT_NAME = 'CREATE 2026'
const CAL_NIC = 'nic@858partners.com'   // prep ("CREATE Kickoff") + debrief ("CREATE Debrief")
const CAL_JG  = 'jg@858partners.com'    // deal ("858: Deal Strategy Call")
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

function authed(req) {
  const need = process.env.CRON_SECRET
  if (!need) return false
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const url = new URL(req.url)
  return bearer === need || url.searchParams.get('secret') === need
}

async function googleToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('google token: ' + JSON.stringify(j))
  return j.access_token
}

async function listEvents(token, calendarId, q, timeMin, timeMax) {
  const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  u.searchParams.set('q', q)
  u.searchParams.set('timeMin', timeMin)
  u.searchParams.set('timeMax', timeMax)
  u.searchParams.set('singleEvents', 'true')
  u.searchParams.set('orderBy', 'startTime')
  u.searchParams.set('maxResults', '100')
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  return (j.items || []).map(e => ({
    title: e.summary || '',
    date: (e.start && (e.start.date || (e.start.dateTime || '').slice(0, 10))) || null,
    start: (e.start && e.start.dateTime) || null,
    tz: (e.start && e.start.timeZone) || null,
    attendees: (e.attendees || []).map(a => ({ email: a.email, response: a.responseStatus })),
  }))
}

async function askClaude(roster, prepDebrief, deal) {
  const sys = `You classify calendar events into a client-meeting matrix for the CREATE 2026 event.
There are exactly 3 meeting types: prep, deal, debrief.
- "CREATE Kickoff (...)" events = prep. "CREATE Debrief (...)" or any title with "CREATE debrief" = debrief. Both come from Nic's calendar.
- "858: Deal Strategy Call (...)" events = deal. From JG's calendar.
Map each event to ONE client company from the provided roster, using the contact name in the title or the attendee email domains. 
Return STRICT, VALID JSON only (no prose, no code fence, no trailing commas). Inside any string value, NEVER use the double-quote character " — use single quotes instead (e.g. write 'Toast Team Schliestett', not "Toast Team Schliestett"). Shape:
{"meetings":[{"client":"<exact roster company name>","type":"prep|deal|debrief","status":"Booked|Not Booked","date":"YYYY-MM-DD|null","time":"<e.g. 12:30 PM ET, or null>","title":"<event title or null>","participants":"<comma-separated external participant names, or null>","declines":"<comma-separated external names who declined, or null>"}],
 "flags":[{"level":"High|Medium|Low","text":"...","client":"<company or null>"}]}
Rules: emit a row for EVERY company × EVERY type (21 rows for 7 companies). If no event matches, status "Not Booked", and date/time/title/participants all null.
"time": convert the event start into a short local time like "12:30 PM ET" (use the event timeZone). 
"participants": the EXTERNAL attendees on THAT specific event only — client-company people and their guests — as a short comma-separated list of humanized names. EXCLUDE anyone @858partners.com and non-people (lu.ma, calendar-invite@, rooms). This is per-meeting (who was on the call), NOT an onsite roster.
"declines": of those external participants, the ones whose response status is 'declined' on THAT event — comma-separated humanized names; null if nobody declined.
Flags: High for each Not Booked slot; Medium for any event whose title breaks the "(Contact Name)" convention (odd names, double spaces, non-standard debrief titles); Low for notable response anomalies (e.g. an 858 host shows declined/needsAction).`
  const user = `ROSTER (companies + primary contact email):\n${JSON.stringify(roster)}\n\nNIC CALENDAR EVENTS (prep + debrief):\n${JSON.stringify(prepDebrief)}\n\nJG CALENDAR EVENTS (deal):\n${JSON.stringify(deal)}`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system: sys, messages: [{ role: 'user', content: user }] }),
  })
  const j = await r.json()
  if (!r.ok || j.error || !Array.isArray(j.content)) throw new Error('claude api: ' + JSON.stringify(j).slice(0, 400))
  const text = j.content.map(b => b.text || '').join('')
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s < 0 || e < 0) throw new Error('claude no-json: ' + text.slice(0, 300))
  return JSON.parse(text.slice(s, e + 1))
}

async function run(req) {
  if (!authed(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  try {
    // project + roster
    const { data: projects } = await sb.from('projects').select('id,name')
    const proj = (projects || []).find(p => norm(p.name) === norm(PROJECT_NAME))
      || (projects || []).filter(p => norm(p.name).includes('create')).length === 1
        ? (projects || []).find(p => norm(p.name).includes('create')) : null
    if (!proj) return Response.json({ error: 'project not found: ' + PROJECT_NAME }, { status: 404 })
    const { data: clients } = await sb.from('event_clients').select('id,name,contact_email').eq('project_id', proj.id)
    const byName = new Map((clients || []).map(c => [norm(c.name), c.id]))
    const roster = (clients || []).map(c => ({ company: c.name, contact_email: c.contact_email }))

    // calendars
    const token = await googleToken()
    const now = new Date()
    const timeMin = new Date(now.getTime() - 45 * 864e5).toISOString()
    const timeMax = new Date(now.getTime() + 45 * 864e5).toISOString()
    const prepDebrief = await listEvents(token, CAL_NIC, 'CREATE', timeMin, timeMax)
    const deal = await listEvents(token, CAL_JG, 'Deal Strategy', timeMin, timeMax)

    // judgment
    const out = await askClaude(roster, prepDebrief, deal)
    const meetings = Array.isArray(out.meetings) ? out.meetings : []
    const flags = Array.isArray(out.flags) ? out.flags : []

    // write
    let updated = 0; const skipped = []
    for (const m of meetings) {
      const cid = byName.get(norm(m.client))
      if (!cid) { skipped.push(m.client); continue }
      const { error } = await sb.from('client_meetings').upsert({
        project_id: proj.id, client_id: cid, type: m.type,
        status: m.status || 'Not Booked', meeting_date: m.date || null,
        meeting_time: m.time || null, participants: m.participants || null, declines: m.declines || null,
        event_title: m.title || null, source: 'scan', updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,type' })
      if (!error) updated++
    }
    await sb.from('scan_flags').delete().eq('project_id', proj.id).eq('source', 'scan').eq('resolved', false)
    if (flags.length) {
      await sb.from('scan_flags').insert(flags.map(f => ({
        project_id: proj.id, level: f.level || 'Low', text: f.text,
        client_id: f.client ? (byName.get(norm(f.client)) || null) : null,
        source: 'scan', scanned_at: new Date().toISOString(),
      })))
    }
    return Response.json({ ok: true, project: proj.name, events: { nic: prepDebrief.length, jg: deal.length }, updated, skipped: [...new Set(skipped)], flags: flags.length })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}

export async function GET(req) { return run(req) }
export async function POST(req) { return run(req) }
