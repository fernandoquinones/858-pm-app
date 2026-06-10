import { sb } from '../../../../lib/supabaseServer'

// POST { taskId } -> post to THIS EVENT'S Slack room with a "Mark complete" button,
// and store the message ts so a reaction/reply/button maps back to the task.
export async function POST(req) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ ok: false, skipped: 'Slack not configured' })
    const { taskId } = await req.json()
    if (!taskId) return Response.json({ error: 'Missing taskId' }, { status: 400 })

    const { data: task } = await sb.from('tasks').select('id,title,owner,status,project_id,due_date').eq('id', taskId).single()
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 })

    const { data: project } = await sb.from('projects').select('slack_channel_id').eq('id', task.project_id).single()
    const channel = (project && project.slack_channel_id) || process.env.SLACK_CHANNEL_ID
    if (!channel) return Response.json({ ok: false, skipped: 'No Slack room linked to this event' })

    const text = `*${task.owner}* — task needs your attention: *${task.title}*${task.due_date ? ` (due ${task.due_date})` : ''}`
    const blocks = [
      { type: 'section', text: { type: 'mrkdwn', text } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '✅ Mark complete' }, style: 'primary', action_id: 'mark_complete', value: task.id }] },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'React ✅ or reply in thread to comment — it syncs to the web app.' }] }
    ]

    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      body: JSON.stringify({ channel, text, blocks })
    })
    const j = await r.json()
    if (!j.ok) return Response.json({ error: 'Slack: ' + j.error }, { status: 502 })

    await sb.from('slack_links').upsert({ task_id: task.id, project_id: task.project_id, channel: j.channel, ts: j.ts }, { onConflict: 'channel,ts' })
    return Response.json({ ok: true, ts: j.ts })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
