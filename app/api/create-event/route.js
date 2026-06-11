import { sb } from '../../../lib/supabaseServer'

// POST { name, date, activations[] } -> builds a plan from the library, no AI.
// Pulls every "All events" task + every task tagged with any selected activation.
export async function POST(req) {
  try {
    const { name, date, activations, venue, city, state } = await req.json()
    if (!name || !name.trim()) return Response.json({ error: 'Event name required' }, { status: 400 })
    const acts = Array.isArray(activations) ? activations.map(a => String(a).trim()).filter(Boolean) : []

    const { data: lib, error } = await sb.from('library_tasks').select('*')
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const keep = (lib || []).filter(r => {
      const tags = (r.applies_to || '').split(' / ').map(s => s.trim()).filter(Boolean)
      if (tags.includes('All events')) return true
      return tags.some(t => acts.includes(t))
    })

    let project, pErr
    ;({ data: project, error: pErr } = await sb.from('projects')
      .insert({ name: name.trim(), type: 'event', event_date: date || null, activations: acts.join(' / '), venue: venue || null, city: city || null, state: state || null }).select().single())
    if (pErr && /(activations|location|column)/i.test(pErr.message || '')) {
      // columns not added yet — create without the optional ones
      ;({ data: project, error: pErr } = await sb.from('projects')
        .insert({ name: name.trim(), type: 'event', event_date: date || null }).select().single())
    }
    if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

    // workstreams in order of first appearance in the library
    const order = []; const wsTiming = {}
    for (const r of keep) { if (!(r.workstream in wsTiming)) { wsTiming[r.workstream] = r.timing || ''; order.push(r.workstream) } }
    const wsIds = {}; let wi = 0
    for (const wn of order) {
      const { data: w, error: we } = await sb.from('workstreams')
        .insert({ project_id: project.id, name: wn, timing: wsTiming[wn], sort_order: wi++ }).select().single()
      if (we) return Response.json({ error: we.message }, { status: 500 })
      wsIds[wn] = w.id
    }
    let so = 0
    const rows = keep.map(r => ({
      project_id: project.id, workstream_id: wsIds[r.workstream], title: r.title,
      owner: r.owner || 'Team', applies_to: r.applies_to || '', notes: r.notes || '', status: 'todo', sort_order: so++
    }))
    if (rows.length) { const { error: te } = await sb.from('tasks').insert(rows); if (te) return Response.json({ error: te.message }, { status: 500 }) }

    return Response.json({ projectId: project.id, count: rows.length })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
