import { sb } from '../../../../lib/supabaseServer'
import { postThreadReply } from '../../../../lib/slack'

// POST { taskId, author, body } -> mirror a web-app comment into the Slack thread(s) for this task.
export async function POST(req) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ ok: false, skipped: 'Slack not configured' })
    const { taskId, author, body } = await req.json()
    if (!taskId || !body) return Response.json({ error: 'Missing taskId or body' }, { status: 400 })

    const { data: links } = await sb.from('slack_links').select('channel,ts').eq('task_id', taskId)
    if (!links || !links.length) return Response.json({ ok: false, skipped: 'No Slack message for this task yet' })

    const text = `💬 *${author || 'Someone'}* (in the web app): ${body}`
    let posted = 0
    for (const l of links) {
      const r = await postThreadReply(l.channel, l.ts, text)
      if (r && r.ok) posted++
    }
    return Response.json({ ok: true, posted })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
