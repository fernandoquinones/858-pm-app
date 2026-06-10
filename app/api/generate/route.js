import { createClient } from '@supabase/supabase-js'
import { loadLibrary } from '../../../lib/serverLibrary'

// Server-side Supabase client (RLS is off in the prototype, so the anon key can write).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Claude builds a plan and returns it in this exact shape (tool use = guaranteed structure).
const PLAN_TOOL = {
  name: 'create_plan',
  description: 'Build an event project plan by selecting and adapting tasks from the template library.',
  input_schema: {
    type: 'object',
    properties: {
      project_name: { type: 'string', description: 'Short project name, e.g. "CFO Luncheon — Acme"' },
      type: { type: 'string', description: 'event type, e.g. luncheon, summit, bird, house' },
      workstreams: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            timing: { type: 'string' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  owner: { type: 'string', description: 'One of: Christina, Fernando, Nic, JG, Chris, Marty, Team, or combos like Chris+JG. Normalize Fern to Fernando and Juan to JG' },
                  applies_to: { type: 'string' },
                  due_date: { type: 'string', description: 'YYYY-MM-DD if an event date was given, else empty' },
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
    required: ['project_name', 'workstreams']
  }
}

export async function POST(req) {
  try {
    const { prompt } = await req.json()
    if (!prompt || !prompt.trim()) {
      return Response.json({ error: 'Describe the event first.' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not set in .env.local.' }, { status: 500 })
    }

    const LIBRARY = await loadLibrary(supabase)
    const system =
      'You build event project plans for 858 Partners. You are given a TEMPLATE LIBRARY of every task ' +
      '858 has run, grouped by phase and tagged by activation type (Luncheon, Bird circles, 858 House, GRIP, All events). ' +
      'Given a short description of an event, select the relevant phases and tasks, keep the owners from the library, ' +
      'and only include tasks that fit the described activations (always include "All events" tasks). ' +
      'If the description names a date, set due_date for each task working backward from its phase timing; otherwise leave due_date empty. ' +
      'Owner-name rule: Fern means Fernando and Juan means JG — always record owners as Fernando / JG. Return your answer ONLY by calling the create_plan tool.\n\nTEMPLATE LIBRARY:\n' +
      JSON.stringify(LIBRARY)

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system,
        tools: [PLAN_TOOL],
        tool_choice: { type: 'tool', name: 'create_plan' },
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!resp.ok) {
      const t = await resp.text()
      return Response.json({ error: 'Claude API error: ' + t }, { status: 502 })
    }
    const data = await resp.json()
    const toolUse = (data.content || []).find(b => b.type === 'tool_use')
    if (!toolUse) return Response.json({ error: 'Claude did not return a plan.' }, { status: 502 })
    const plan = toolUse.input
    if (!plan.workstreams || !plan.workstreams.length) {
      return Response.json({ error: 'Claude returned an empty plan (the response may have been cut off). Try again, or use "Create a new event" to build it from your library.' }, { status: 502 })
    }

    // Write the plan to Supabase: project -> workstreams -> tasks
    const { data: project, error: pErr } = await supabase
      .from('projects').insert({ name: plan.project_name, type: plan.type || 'event' }).select().single()
    if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

    let sort = 0
    const newActs = new Set()   // activation tags this plan uses
    for (let i = 0; i < (plan.workstreams || []).length; i++) {
      const ws = plan.workstreams[i]
      const { data: wsRow, error: wErr } = await supabase
        .from('workstreams')
        .insert({ project_id: project.id, name: ws.name, timing: ws.timing || '', sort_order: i })
        .select().single()
      if (wErr) return Response.json({ error: wErr.message }, { status: 500 })

      const taskRows = (ws.tasks || []).map(t => {
        ;(t.applies_to || '').split(' / ').map(s => s.trim()).forEach(a => { if (a && a !== 'All events') newActs.add(a) })
        return {
          project_id: project.id,
          workstream_id: wsRow.id,
          title: t.title,
          owner: t.owner || 'Team',
          applies_to: t.applies_to || '',
          notes: t.notes || '',
          due_date: t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
          status: 'todo',
          sort_order: sort++
        }
      })
      if (taskRows.length) {
        const { error: tErr } = await supabase.from('tasks').insert(taskRows)
        if (tErr) return Response.json({ error: tErr.message }, { status: 500 })
      }
    }

    // Set the event's activations from the plan so the top bar reflects them.
    if (newActs.size) {
      try { await supabase.from('projects').update({ activations: [...newActs].join(' / ') }).eq('id', project.id) }
      catch (e) { /* activations column may be absent in older schemas — ignore */ }
    }

    return Response.json({ projectId: project.id, name: project.name })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
