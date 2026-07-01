import { sb } from '../../../../lib/supabaseServer'
import { dmUser } from '../../../../lib/slack'
import { windowFor, tasksInWindow, personalBlocks, REAL_PEOPLE } from '../../../../lib/digest'

// POST -> manually push "due tomorrow" reminders as personal DMs (Christina/Fernando trigger this).
export async function POST(req) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ ok: false, skipped: 'Slack not configured' })
    const w = windowFor('remind')
    const { tasks, meta } = await tasksInWindow(sb, w.start, w.end)

    const { data: users } = await sb.from('slack_users').select('name,slack_id')
    const idOf = {}; (users || []).forEach(u => { if (u.slack_id) idOf[u.name] = u.slack_id })

    const sent = []
    for (const person of REAL_PEOPLE) {
      const p = personalBlocks(person, tasks, meta, w.headline)
      if (!p) continue
      if (!idOf[person]) { sent.push({ person, skipped: 'no slack_id' }); continue }
      const r = await dmUser(idOf[person], p.text, p.blocks)
      sent.push({ person, ok: !!(r && r.ts), error: r && r.error })
    }
    return Response.json({ ok: true, taskCount: tasks.length, sent })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
