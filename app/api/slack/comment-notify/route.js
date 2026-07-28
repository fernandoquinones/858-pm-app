import { sb } from '../../../../lib/supabaseServer'
import { notifyParticipants } from '../../../../lib/slack'

// POST { taskId, author, body } — a web-app comment. Fan it out to everyone involved
// in the task (owners + prior commenters) via Slack DM so the conversation continues there.
export async function POST(req) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ ok: false, skipped: 'Slack not configured' })
    const { taskId, author, body } = await req.json()
    if (!taskId || !body) return Response.json({ error: 'Missing taskId or body' }, { status: 400 })
    const r = await notifyParticipants(sb, { taskId, author, body })
    return Response.json({ ok: true, ...r })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
