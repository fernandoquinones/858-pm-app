import { createClient } from '@supabase/supabase-js'
import { loadLibrary } from '../../../lib/serverLibrary'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Claude returns tasks to ADD, grouped under a workstream name (new or existing).
const ADD_TOOL = {
  name: 'add_to_plan',
  description: 'Add an activation, workstream, or tasks to an existing event plan, drawing from the template library.',
  input_schema: {
    type: 'object',
    properties: {
      workstreams: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Reuse an existing workstream name when it fits; otherwise a new one.' },
            timing: { type: 'string' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  owner: { type: 'string', description: 'Christina, Fernando, Nic, JG, Chris, Marty, Team, or combos like Chris+JG. Normalize Fern to Fernando and Juan to JG' },
                  applies_to: { type: 'string', description: 'activation tag(s), e.g. GRIP, Luncheon' },
                  notes: { type: 'string' }
                },
                required: ['title', 'owner']
              }
            }
          },
          required: ['name', 'tasks']
        }
      }
    },
    required: ['workstreams']
  }
}

export async function POST(req) {
  try {
    const { projectId, prompt } = await req.json()
    if (!projectId) return Response.json({ error: 'Missing projectId.' }, { status: 400 })
    if (!prompt || !prompt.trim()) return Response.json({ error: 'Say what to add.' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 })

    // existing workstreams so Claude can reuse them and we can avoid dupes
    const { data: existing } = await supabase.from('workstreams').select('id,name,sort_order').eq('project_id', projectId).order('sort_order')
    const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId)

    const LIBRARY = await loadLibrary(supabase)
    const system =
      'You add to an EXISTING 858 event plan. Use the TEMPLATE LIBRARY to pull the right tasks (with their owners) for whatever the user asks to add — ' +
      'e.g. "add a GRIP activation" should bring in the GRIP-tagged tasks. Reuse an existing workstream name when the new tasks fit it; otherwise create a new workstream. ' +
      'If the request describes a workstream or tasks NOT in the library, create a sensible NEW workstream with appropriate tasks and the best-fit owner (default Christina if unclear). ' +
      'Only return the tasks/workstreams to ADD (do not repeat the whole plan). Owner-name rule: Fern means Fernando and Juan means JG — always record owners as Fernando / JG. Answer ONLY via the add_to_plan tool.\n\n' +
      'EXISTING WORKSTREAMS: ' + JSON.stringify((existing || []).map(w => w.name)) + '\n\n' +
      'TEMPLATE LIBRARY:\n' + JSON.stringify(LIBRARY)

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 3072, system,
        tools: [ADD_TOOL], tool_choice: { type: 'tool', name: 'add_to_plan' },
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!resp.ok) return Response.json({ error: 'Claude API error: ' + (await resp.text()) }, { status: 502 })
    const data = await resp.json()
    const toolUse = (data.content || []).find(b => b.type === 'tool_use')
    if (!toolUse) return Response.json({ error: 'Claude did not return additions.' }, { status: 502 })

    const byName = {}
    ;(existing || []).forEach(w => { byName[w.name.toLowerCase()] = w })
    let sort = count || 0
    let nextWsOrder = (existing || []).length
    let added = 0
    const newActs = new Set()   // activation tags this addition introduces

    for (const ws of (toolUse.input.workstreams || [])) {
      let wsRow = byName[(ws.name || '').toLowerCase()]
      if (!wsRow) {
        const { data: created, error: wErr } = await supabase
          .from('workstreams').insert({ project_id: projectId, name: ws.name, timing: ws.timing || 'custom', sort_order: nextWsOrder++ })
          .select().single()
        if (wErr) return Response.json({ error: wErr.message }, { status: 500 })
        wsRow = created; byName[(ws.name || '').toLowerCase()] = created
      }
      const rows = (ws.tasks || []).map(t => {
        ;(t.applies_to || '').split(' / ').map(s => s.trim()).forEach(a => { if (a && a !== 'All events') newActs.add(a) })
        return {
          project_id: projectId, workstream_id: wsRow.id, title: t.title, owner: t.owner || 'Team',
          applies_to: t.applies_to || '', notes: t.notes || '', status: 'todo', sort_order: sort++
        }
      })
      if (rows.length) {
        const { error: tErr } = await supabase.from('tasks').insert(rows)
        if (tErr) return Response.json({ error: tErr.message }, { status: 500 })
        added += rows.length
      }
    }

    // Register any new activations on the event so the top bar reflects them.
    if (newActs.size) {
      try {
        const { data: proj } = await supabase.from('projects').select('activations').eq('id', projectId).single()
        const current = (proj?.activations || '').split(' / ').map(s => s.trim()).filter(Boolean)
        const merged = [...new Set([...current, ...newActs])]
        if (merged.length !== current.length) {
          await supabase.from('projects').update({ activations: merged.join(' / ') }).eq('id', projectId)
        }
      } catch (e) { /* activations column may be absent in older schemas — ignore */ }
    }

    return Response.json({ added, activations: [...newActs] })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
