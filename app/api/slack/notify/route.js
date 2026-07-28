import { sb } from '../../../../lib/supabaseServer'
import { notifyReview } from '../../../../lib/slack'

// POST { taskId, actor } — a task moved to "Needs review". DM the reviewer(s) in the
// personal bot (with the event label); does NOT post to the event channel.
export async function POST(req) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ ok: false, skipped: 'Slack not configured' })
    const { taskId, actor } = await req.json()
    if (!taskId) return Response.json({ error: 'Missing taskId' }, { status: 400 })
    const r = await notifyReview(sb, taskId, actor)
    return Response.json({ ok: true, ...r })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
