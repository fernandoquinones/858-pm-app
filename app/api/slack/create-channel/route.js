import { sb } from '../../../../lib/supabaseServer'
import { createSlackChannel, postToChannel } from '../../../../lib/slack'

// POST { projectId } -> ensure this project has its own Slack channel.
export async function POST(req) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return Response.json({ error: 'Missing projectId' }, { status: 400 })
    if (!process.env.SLACK_BOT_TOKEN) return Response.json({ error: 'Slack not configured (no SLACK_BOT_TOKEN).' }, { status: 400 })

    const { data: project } = await sb.from('projects').select('id,name,slack_channel_id,slack_channel_name').eq('id', projectId).single()
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })
    if (project.slack_channel_id) return Response.json({ id: project.slack_channel_id, name: project.slack_channel_name, existing: true })

    const ch = await createSlackChannel(project.name)
    if (!ch.id) return Response.json({ error: 'Slack: ' + (ch.error || 'could not create channel') }, { status: 502 })

    await sb.from('projects').update({ slack_channel_id: ch.id, slack_channel_name: ch.name }).eq('id', projectId)
    await postToChannel(ch.id, `:tada: Project room for *${project.name}* — task pings land here. React :white_check_mark: or reply in a thread to update the plan.`)
    return Response.json({ id: ch.id, name: ch.name })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
