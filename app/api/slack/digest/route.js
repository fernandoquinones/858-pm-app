import { sb } from '../../../../lib/supabaseServer'
import { dmUser } from '../../../../lib/slack'
import { windowFor, tasksInWindow, personalBlocks, fullBlocks, etHour, etDow, REAL_PEOPLE } from '../../../../lib/digest'

const LEADS = ['Christina', 'Fernando'] // also receive the full cross-event view

async function run(type, { enforceTime } = {}) {
  if (!process.env.SLACK_BOT_TOKEN) return { ok: false, skipped: 'Slack not configured' }

  // Cron fires at 15:00 & 16:00 UTC (to straddle DST); only the one that is 11am ET should send.
  if (enforceTime) {
    if (etHour() !== 11) return { ok: true, skipped: 'not 11am ET' }
    if (type === 'weekly' && etDow() !== 1) return { ok: true, skipped: 'weekly is Monday only' }
    if (type === 'preview' && etDow() !== 5) return { ok: true, skipped: 'preview is Friday only' }
  }

  const w = windowFor(type)
  const { tasks, meta } = await tasksInWindow(sb, w.start, w.end)

  // name -> slack_id
  const { data: users } = await sb.from('slack_users').select('name,slack_id')
  const idOf = {}; (users || []).forEach(u => { if (u.slack_id) idOf[u.name] = u.slack_id })

  const sent = []
  // personal DMs to everyone with tasks in the window
  for (const person of REAL_PEOPLE) {
    const p = personalBlocks(person, tasks, meta, w.headline)
    if (!p) continue
    if (!idOf[person]) { sent.push({ person, skipped: 'no slack_id' }); continue }
    const r = await dmUser(idOf[person], p.text, p.blocks)
    sent.push({ person, ok: !!(r && r.ts), error: r && r.error })
  }
  // full overview to leads
  const full = fullBlocks(tasks, meta, w.headline)
  for (const lead of LEADS) {
    if (!idOf[lead]) { sent.push({ lead, skipped: 'no slack_id' }); continue }
    const r = await dmUser(idOf[lead], full.text, full.blocks)
    sent.push({ lead: lead + ' (full view)', ok: !!(r && r.ts), error: r && r.error })
  }
  return { ok: true, type, window: w, taskCount: tasks.length, sent }
}

// Cron hits GET (Vercel adds x-vercel-cron); manual test hits POST from the app.
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
