import { sb } from '../../../../lib/supabaseServer'
import { verifySlack } from '../../../../lib/slackVerify'
import { chatDelete } from '../../../../lib/slack'

const DONE_REACTIONS = ['white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', '+1']

async function slackUserName(userId) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) return userId
    const r = await fetch('https://slack.com/api/users.info?user=' + userId, {
      headers: { authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    })
    const j = await r.json()
    return (j.ok && (j.user.real_name || j.user.name)) || userId
  } catch { return userId }
}

export async function POST(req) {
  const raw = await req.text()
  const ts = req.headers.get('x-slack-request-timestamp')
  const sig = req.headers.get('x-slack-signature')
  let body
  try { body = JSON.parse(raw) } catch { return new Response('bad', { status: 400 }) }

  // Slack URL verification handshake (sent once when you set the Request URL)
  if (body.type === 'url_verification') return Response.json({ challenge: body.challenge })

  if (!verifySlack(raw, ts, sig)) return new Response('bad signature', { status: 401 })

  const e = body.event || {}
  try {
    // ✅ reaction => mark the linked task done
    if (e.type === 'reaction_added' && DONE_REACTIONS.includes(e.reaction) && e.item && e.item.ts) {
      const { data: link } = await sb.from('slack_links').select('task_id').eq('channel', e.item.channel).eq('ts', e.item.ts).single()
      if (link) await sb.from('tasks').update({ status: 'done' }).eq('id', link.task_id)
    }
    // (undocumented) wastebasket reaction removes the bot's own message
    if (e.type === 'reaction_added' && e.reaction === 'wastebasket' && e.item && e.item.ts) {
      await chatDelete(e.item.channel, e.item.ts)
      try { await sb.from('slack_links').delete().eq('channel', e.item.channel).eq('ts', e.item.ts) } catch (er) {}
    }
    // thread reply => add a comment (source = slack)
    if (e.type === 'message' && !e.bot_id && !e.subtype && e.thread_ts && e.text) {
      const { data: link } = await sb.from('slack_links').select('task_id,project_id').eq('channel', e.channel).eq('ts', e.thread_ts).single()
      if (link) {
        const author = await slackUserName(e.user)
        await sb.from('comments').insert({ project_id: link.project_id, task_id: link.task_id, author, body: e.text, source: 'slack' })
      }
    }
  } catch (err) { /* swallow — always 200 so Slack doesn't retry forever */ }

  return new Response('ok', { status: 200 })
}
