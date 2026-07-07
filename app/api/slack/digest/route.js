import { sb } from '../../../../lib/supabaseServer'
import { dmUser, dmPersonalTasks } from '../../../../lib/slack'
import { windowFor, tasksInWindow, ownedBy, fullBlocks, etHour, etDow, REAL_PEOPLE } from '../../../../lib/digest'

const LEADS = ['Christina', 'Fernando'] // also receive the full cross-event view

async function run(type, { enforceTime } = {}) {
  if (!process.env.SLACK_BOT_TOKEN) return { ok: false, skipped: 'Slack not configured' }

  if (enforceTime) {
    if (etHour() !== 11) return { ok: true, skipped: 'not 11am ET' }
    if (type === 'weekly' && etDow() !== 1) return { ok: true, skipped: 'weekly is Monday only' }
    if (type === 'preview' && etDow() !== 5) return { ok: true, skipped: 'preview is Friday only' }
  }

  const w = windowFor(type)
  const { tasks, meta } = await tasksInWindow(sb, w.start, w.end)

  const { data: users } = await sb.from('slack_users').select('name,slack_id')
  const idOf = {}; (users || []).forEach(u => { if (u.slack_id) idOf[u.name] = u.slack_id })

  const sent = []
  for (const person of REAL_PEOPLE) {
    // Christina gets the full cross-event set; everyone else gets only their own — all per-task
    const mine = person === 'Christina' ? tasks : ownedBy(tasks, person)
    if (!mine.length) continue
    if (!idOf[person]) { sent.push({ person, skipped: 'no slack_id' }); continue }
    const n = await dmPersonalTasks(sb, idOf[person], person, mine, meta, w.headline)
    sent.push({ person, delivered: n })
  }
  return { ok: true, type, window: w, taskCount: tasks.length, sent }
}

export async function GET(req) {
  const type = new URL(req.url).searchParams.get('type') || 'weekly'
  const isCron = req.headers.get('x-vercel-cron') || (new URL(req.url).searchParams.get('key') === process.env.CRON_SECRET && process.env.CRON_SECRET)
  return Response.json(await run(type, { enforceTime: !!isCron }))
}
export async function POST(req) {
  let type = 'weekly'
  try { type = (await req.json()).type || 'weekly' } catch {}
  return Response.json(await run(type, { enforceTime: false }))
}
