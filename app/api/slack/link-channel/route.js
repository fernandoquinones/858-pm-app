import { sb } from '../../../../lib/supabaseServer'
import { postToChannel } from '../../../../lib/slack'

// POST { projectId, channelId, channelName } -> connect an existing Slack room to this event.
export async function POST(req) {
  try {
    const { projectId, channelId, channelName } = await req.json()
    if (!projectId || !channelId) return Response.json({ error: 'Missing projectId or channelId' }, { status: 400 })
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ error: 'Slack not configured.' }, { status: 400 })

    const { data: project } = await sb.from('projects').select('name').eq('id', projectId).single()
    // Post the confirmation. If the bot isn't a member, tell the user to invite it (we intentionally do NOT use channels:join).
    const hello = await postToChannel(channelId, `:link: Connected to *${project ? project.name : 'this event'}* — task pings will post here. React :white_check_mark: or reply in a thread to update the plan.`)
    if (hello && hello.ok === false && (hello.error === 'not_in_channel' || hello.error === 'channel_not_found')) {
      return Response.json({ error: `Invite the bot to #${channelName || 'the channel'} first: in Slack type "/invite @858 Project Tool", then Connect again.` }, { status: 409 })
    }
    await sb.from('projects').update({ slack_channel_id: channelId, slack_channel_name: channelName || null }).eq('id', projectId)
    return Response.json({ ok: true, id: channelId, name: channelName })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
