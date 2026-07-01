import { sb } from '../../../../lib/supabaseServer'
import { verifySlack } from '../../../../lib/slackVerify'
import { renderTaskMessages, SLACK_STATUS } from '../../../../lib/slack'

// Update the clicked task's line inside a (multi-task) digest message via response_url.
async function updateDigestLine(payload, taskId, status) {
  try {
    const msg = payload.message
    if (!payload.response_url || !msg || !Array.isArray(msg.blocks)) return
    const label = SLACK_STATUS[status] || status
    const blocks = msg.blocks.map(b => {
      const acc = b.accessory
      const mine = acc && acc.action_id === 'set_status' && Array.isArray(acc.options) && acc.options.some(o => o.value && o.value.startsWith(taskId + '::'))
      if (b.type === 'section' && mine) {
        const first = (b.text && b.text.text ? b.text.text : '').split('\n')[0].replace(/^•\s*/, '')
        const text = status === 'done' ? `✓ ~${first}~  _Done_` : `• ${first}\n  _${label}_`
        const initial = acc.options.find(o => o.value === `${taskId}::${status}`)
        return { ...b, text: { type: 'mrkdwn', text }, accessory: { ...acc, initial_option: initial } }
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
  let taskId, status
  if (action && action.action_id === 'set_status' && action.selected_option) {
    ;[taskId, status] = String(action.selected_option.value).split('::')
  } else if (action && action.action_id === 'mark_complete' && action.value) {
    taskId = action.value; status = 'done' // legacy button on older messages
  }

  if (taskId && status && SLACK_STATUS[status]) {
    await sb.from('tasks').update({ status }).eq('id', taskId)

    // Re-render any tracked single-task messages (channel post + DMs).
    await renderTaskMessages(sb, taskId)

    // If the click came from a digest (not a tracked single-task message), update just that line.
    const channel = (payload.container && payload.container.channel_id) || (payload.channel && payload.channel.id)
    const msgTs = payload.container && payload.container.message_ts
    let tracked = null
    if (channel && msgTs) {
      const { data } = await sb.from('slack_links').select('task_id').eq('channel', channel).eq('ts', msgTs).maybeSingle()
      tracked = data
    }
    if (!tracked) await updateDigestLine(payload, taskId, status)

    return new Response('', { status: 200 })
  }
  return new Response('ok', { status: 200 })
}
