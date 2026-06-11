import { sb } from '../../../../lib/supabaseServer'
import { syncTaskCompleteMessages } from '../../../../lib/slack'

// POST { taskId, by } -> edit any Slack message(s) for this task to a struck-through "Marked as complete".
export async function POST(req) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ ok: false, skipped: 'Slack not configured' })
    const { taskId, by } = await req.json()
    if (!taskId) return Response.json({ error: 'Missing taskId' }, { status: 400 })

    await syncTaskCompleteMessages(sb, taskId, by)
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
