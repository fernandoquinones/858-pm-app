import { sb } from '../../../../lib/supabaseServer'
import { dmUser, taskActionBlocks } from '../../../../lib/slack'

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

    const { text, blocks } = taskActionBlocks(task)

    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      body: JSON.stringify({ channel, text, blocks })
    })
    const j = await r.json()
    if (!j.ok) return Response.json({ error: 'Slack: ' + j.error }, { status: 502 })

    await sb.from('slack_links').upsert({ task_id: task.id, project_id: task.project_id, channel: j.channel, ts: j.ts }, { onConflict: 'channel,ts' })

    // Also DM the owner(s), if they're mapped in slack_users (combos like "Chris + JG" DM each).
    const names = (task.owner || '').split('+').map(x => x.trim()).filter(Boolean)
    if (names.length) {
      const { data: users } = await sb.from('slack_users').select('name,slack_id').in('name', names)
      for (const u of (users || [])) {
        if (!u.slack_id) continue
        const dm = await dmUser(u.slack_id, text, blocks)
        if (dm && dm.ts) {
          await sb.from('slack_links').upsert({ task_id: task.id, project_id: task.project_id, channel: dm.channel, ts: dm.ts }, { onConflict: 'channel,ts' })
        }
      }
    }
    return Response.json({ ok: true, ts: j.ts })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
