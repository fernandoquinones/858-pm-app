import { sb } from '../../../../lib/supabaseServer'
import { dmPersonalTasks } from '../../../../lib/slack'
import { windowFor, tasksInWindow, ownedBy, REAL_PEOPLE } from '../../../../lib/digest'

export async function POST(req) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ ok: false, skipped: 'Slack not configured' })
    const w = windowFor('remind')
    const { tasks, meta } = await tasksInWindow(sb, w.start, w.end)

    const { data: users } = await sb.from('slack_users').select('name,slack_id')
    const idOf = {}; (users || []).forEach(u => { if (u.slack_id) idOf[u.name] = u.slack_id })

    const sent = []
    for (const person of REAL_PEOPLE) {
      const mine = ownedBy(tasks, person)
      if (!mine.length) continue
      if (!idOf[person]) { sent.push({ person, skipped: 'no slack_id' }); continue }
      const n = await dmPersonalTasks(sb, idOf[person], person, mine, meta, w.headline)
      sent.push({ person, delivered: n })
    }
    return Response.json({ ok: true, taskCount: tasks.length, sent })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
