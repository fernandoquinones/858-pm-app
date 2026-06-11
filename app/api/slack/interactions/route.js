import { sb } from '../../../../lib/supabaseServer'
import { verifySlack } from '../../../../lib/slackVerify'
import { syncTaskCompleteMessages } from '../../../../lib/slack'

export async function POST(req) {
  const raw = await req.text()
  const ts = req.headers.get('x-slack-request-timestamp')
  const sig = req.headers.get('x-slack-signature')
  if (!verifySlack(raw, ts, sig)) return new Response('bad signature', { status: 401 })

  // interactivity payloads arrive as form-encoded: payload=<json>
  const params = new URLSearchParams(raw)
  let payload
  try { payload = JSON.parse(params.get('payload')) } catch { return new Response('bad', { status: 400 }) }

  const action = (payload.actions || [])[0]
  if (action && action.action_id === 'mark_complete' && action.value) {
    const taskId = action.value
    await sb.from('tasks').update({ status: 'done' }).eq('id', taskId)
    const who = (payload.user && (payload.user.name || payload.user.username)) || ''
    await syncTaskCompleteMessages(sb, taskId, who)
    return new Response('', { status: 200 })
  }
  return new Response('ok', { status: 200 })
}
