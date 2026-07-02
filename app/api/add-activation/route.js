import { sb } from '../../../lib/supabaseServer'

// POST { projectId, activation } -> pull every library task tagged with this activation
// into the plan (no AI), skipping titles already present. Mirrors create-event, additively.
export async function POST(req) {
  try {
    const { projectId, activation } = await req.json()
    if (!projectId || !activation) return Response.json({ error: 'Missing projectId or activation' }, { status: 400 })

    const { data: lib, error } = await sb.from('library_tasks').select('*')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const want = (lib || []).filter(r => (r.applies_to || '').split(' / ').map(x => x.trim()).includes(activation))
    if (!want.length) return Response.json({ added: 0 })

    const { data: existingTasks } = await sb.from('tasks').select('title').eq('project_id', projectId)
    const have = new Set((existingTasks || []).map(t => (t.title || '').toLowerCase()))

    const { data: existingWs } = await sb.from('workstreams').select('id,name,sort_order').eq('project_id', projectId).order('sort_order')
    const wsByName = {}
    ;(existingWs || []).forEach(w => { wsByName[(w.name || '').toLowerCase()] = w })
    let nextWs = (existingWs || []).length
    const { count } = await sb.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
    let sort = count || 0
    let added = 0

    for (const r of want) {
      if (have.has((r.title || '').toLowerCase())) continue
      let ws = wsByName[(r.workstream || '').toLowerCase()]
      if (!ws) {
        const { data: created, error: we } = await sb.from('workstreams')
          .insert({ project_id: projectId, name: r.workstream, timing: r.timing || '', sort_order: nextWs++ }).select().single()
        if (we) return Response.json({ error: we.message }, { status: 500 })
        ws = created; wsByName[(r.workstream || '').toLowerCase()] = created
      }
      const { error: te } = await sb.from('tasks').insert({
        project_id: projectId, workstream_id: ws.id, title: r.title, owner: r.owner || 'Team',
        applies_to: r.applies_to || '', notes: r.notes || '', status: 'todo', sort_order: sort++
      })
      if (te) return Response.json({ error: te.message }, { status: 500 })
      have.add((r.title || '').toLowerCase()); added++
    }
    return Response.json({ added })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
