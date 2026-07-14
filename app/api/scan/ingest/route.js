import { sb } from '../../../../lib/supabaseServer'

// Scanner ingest — the daily calendar scan POSTs its results here; we write them
// to Supabase with the server-side service key (key never leaves the server).
// Auth: shared secret in the `x-scan-secret` header, checked against SCAN_INGEST_SECRET.
//
// Body: {
//   projectName?: string, projectId?: uuid,
//   meetings: [{ client, type: 'prep'|'deal'|'debrief', status, date?, title? }],
//   flags?:   [{ level: 'High'|'Medium'|'Low', text, client? }]
// }
// Project + clients are matched by NORMALIZED name (lowercase, alphanumerics only),
// so "858 × CREATE 2026" ~ "858 x create 2026" and "WithCoverage" ~ "With Coverage".
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export async function POST(req) {
  try {
    const secret = req.headers.get('x-scan-secret') || ''
    if (!process.env.SCAN_INGEST_SECRET || secret !== process.env.SCAN_INGEST_SECRET)
      return Response.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const meetings = Array.isArray(body.meetings) ? body.meetings : []
    const flags = Array.isArray(body.flags) ? body.flags : []

    // ---- resolve project ----
    let pid = body.projectId
    let projectName = null
    const { data: projects } = await sb.from('projects').select('id,name')
    if (!pid && body.projectName && projects) {
      const want = norm(body.projectName)
      let hit = projects.find(p => norm(p.name) === want)                    // normalized exact
      if (!hit) { const c = projects.filter(p => norm(p.name).includes('create')); if (c.length === 1) hit = c[0] } // sole CREATE
      if (hit) { pid = hit.id; projectName = hit.name }
    }
    if (!pid) return Response.json({ error: 'project not found', triedName: body.projectName, projects: (projects || []).map(p => p.name) }, { status: 404 })

    // ---- client name -> id (normalized) ----
    const { data: clients } = await sb.from('event_clients').select('id,name').eq('project_id', pid)
    const byName = new Map((clients || []).map(c => [norm(c.name), c.id]))
    const resolve = n => byName.get(norm(n)) || null

    // ---- upsert meetings ----
    let updated = 0
    const skipped = []
    for (const m of meetings) {
      const cid = resolve(m.client)
      if (!cid) { skipped.push(m.client); continue }
      const { error } = await sb.from('client_meetings').upsert({
        project_id: pid, client_id: cid, type: m.type,
        status: m.status || 'Not Booked',
        meeting_date: m.date || null,
        event_title: m.title || null,
        source: 'scan', updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,type' })
      if (!error) updated++
    }

    // ---- replace scan-sourced, unresolved flags ----
    let flagCount = 0
    await sb.from('scan_flags').delete().eq('project_id', pid).eq('source', 'scan').eq('resolved', false)
    if (flags.length) {
      const rows = flags.map(f => ({
        project_id: pid, level: f.level || 'Low', text: f.text,
        client_id: f.client ? resolve(f.client) : null,
        source: 'scan', scanned_at: new Date().toISOString(),
      }))
      const { error } = await sb.from('scan_flags').insert(rows)
      if (!error) flagCount = rows.length
    }

    return Response.json({ ok: true, project: projectName, updated, skipped: [...new Set(skipped)], flags: flagCount, scannedAt: new Date().toISOString() })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
