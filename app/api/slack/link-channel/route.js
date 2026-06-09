import { sb } from '../../../../lib/supabaseServer'
import { postToChannel } from '../../../../lib/slack'

// POST { projectId, channelId, channelName } -> connect an existing Slack room to this event.
export async function POST(req) {
  try {
    const { projectId, channelId, channelName } = await req.json()
    if (!projectId || !channelId) return Response.json({ error: 'Missing projectId or channelId' }, { status: 400 })
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ error: 'Slack not configured.' }, { status: 400 })

    // make sure the bot is in the channel so it can post (public channels)
    try {
      await fetch('https://slack.com/api/conversations.join', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        body: JSON.stringify({ channel: channelId })
      })
    } catch (e) {}

    const { data: project } = await sb.from('projects').select('name').eq('id', projectId).single()
    await sb.from('projects').update({ slack_channel_id: channelId, slack_channel_name: channelName || null }).eq('id', projectId)
    await postToChannel(channelId, `:link: Connected to *${project ? project.name : 'this event'}* — task pings will post here. React :white_check_mark: or reply in a thread to update the plan.`)
    return Response.json({ ok: true, id: channelId, name: channelName })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
