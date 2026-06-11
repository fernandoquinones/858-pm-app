import { sb } from '../../../lib/supabaseServer'

// POST { projectId, prompt } -> Claude builds a self-contained HTML view (dashboard/calendar/report)
// from THIS event's live plan data. Read-only — never changes the plan.
export async function POST(req) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 })
    const { projectId, prompt } = await req.json()
    if (!projectId) return Response.json({ error: 'Missing projectId' }, { status: 400 })
    if (!prompt || !prompt.trim()) return Response.json({ error: 'Describe the view you want.' }, { status: 400 })

    const { data: project } = await sb.from('projects').select('name,event_date,activations').eq('id', projectId).single()
    const { data: workstreams } = await sb.from('workstreams').select('id,name,sort_order').eq('project_id', projectId).order('sort_order')
    const { data: tasks } = await sb.from('tasks').select('title,owner,status,due_date,applies_to,notes,workstream_id').eq('project_id', projectId)

    const wsName = {}
    ;(workstreams || []).forEach(w => { wsName[w.id] = w.name })
    const plan = {
      event: project ? { name: project.name, date: project.event_date, activations: project.activations } : null,
      today: new Date().toISOString().slice(0, 10),
      tasks: (tasks || []).map(t => ({
        title: t.title, owner: t.owner, status: t.status, due: t.due_date,
        activations: t.applies_to, workstream: wsName[t.workstream_id] || '', notes: t.notes
      }))
    }

    const system =
      "You are a reporting assistant for the 858 Partners event project tool. " +
      "You receive the live PLAN DATA for one event as JSON plus a request for a view. " +
      "Produce ONE self-contained HTML fragment that renders the requested view: dashboard, calendar, timeline, status report, list, etc. " +
      "STRICT RULES: inline CSS only; use inline SVG for any charts or graphs; NO <script> tags and NO external resources, fonts, or libraries (they will not run or load). " +
      "Make it clean, professional, and readable on a white background. Use the 858 palette where sensible (navy #1B2A4A, blue #2E5AAC, light grey #667085). " +
      "Task status values are: todo, review, done. The field 'today' is provided so you can compute overdue and upcoming items. " +
      "If date-based views are requested but many tasks lack a due date, still render what you can and note it briefly. " +
      "Return ONLY the HTML — no markdown code fences, no explanation."

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: 'REQUEST: ' + prompt + '\n\nPLAN DATA:\n' + JSON.stringify(plan) }]
      })
    })
    if (!resp.ok) return Response.json({ error: 'Claude API error: ' + (await resp.text()) }, { status: 502 })
    const data = await resp.json()
    let html = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    html = html.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
    if (!html) return Response.json({ error: 'Claude returned an empty view. Try rephrasing.' }, { status: 502 })
    return Response.json({ html })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
