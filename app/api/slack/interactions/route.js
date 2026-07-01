import { sb } from '../../../../lib/supabaseServer'
import { verifySlack } from '../../../../lib/slackVerify'
import { syncTaskCompleteMessages } from '../../../../lib/slack'

// Strike the clicked task's line inside a (multi-task) digest message via response_url.
async function strikeInDigest(payload, taskId, who) {
  try {
    const msg = payload.message
    if (!payload.response_url || !msg || !Array.isArray(msg.blocks)) return
    const blocks = msg.blocks.map(b => {
      if (b.type === 'section' && b.accessory && b.accessory.value === taskId) {
        const label = (b.text && b.text.text ? b.text.text : '').replace(/^•\s*/, '')
        const { accessory, ...rest } = b
        return { ...rest, text: { type: 'mrkdwn', text: `✓ ~${label}~  _done${who ? ' · ' + who : ''}_` } }
      }
      return b
    })
    await fetch(payload.response_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ replace_original: true, blocks })
    })
  } catch (e) {}
}

export async function POST(req) {
  const raw = await req.text()
  const ts = req.headers.get('x-slack-request-timestamp')
  const sig = req.headers.get('x-slack-signature')
  if (!verifySlack(raw, ts, sig)) return new Response('bad signature', { status: 401 })

  const params = new URLSearchParams(raw)
  let payload
  try { payload = JSON.parse(params.get('payload')) } catch { return new Response('bad', { status: 400 }) }

  const action = (payload.actions || [])[0]
  if (action && action.action_id === 'mark_complete' && action.value) {
    const taskId = action.value
    await sb.from('tasks').update({ status: 'done' }).eq('id', taskId)
    const who = (payload.user && (payload.user.name || payload.user.username)) || ''

    // Update any single-task messages tracked in slack_links (channel post + DMs).
    await syncTaskCompleteMessages(sb, taskId, who)

    // If this click came from a digest (not a tracked single-task message), strike just that line.
    const channel = payload.container && (payload.container.channel_id) || (payload.channel && payload.channel.id)
    const msgTs = payload.container && payload.container.message_ts
    let tracked = null
    if (channel && msgTs) {
      const { data } = await sb.from('slack_links').select('task_id').eq('channel', channel).eq('ts', msgTs).maybeSingle()
      tracked = data
    }
    if (!tracked) await strikeInDigest(payload, taskId, who)

    return new Response('', { status: 200 })
  }
  return new Response('ok', { status: 200 })
}
