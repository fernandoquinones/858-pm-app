import { sb } from '../../../../lib/supabaseServer'
import { dmUser } from '../../../../lib/slack'

// Login: teammate enters their email -> we generate a magic link and DM it to THEIR Slack.
// Secure by design: the link is delivered to the person's own Slack, not to the requester.
export async function POST(req) {
  try {
    const { email, redirectTo } = await req.json()
    const target = (email || '').trim().toLowerCase()
    if (!target) return Response.json({ error: 'Enter your email.' }, { status: 400 })

    const { data: prof } = await sb.from('profiles').select('name').eq('email', target).maybeSingle()
    if (!prof) return Response.json({ error: 'That email isn’t on the team. Ask Fernando or Christina to add you.' }, { status: 403 })

    const { data: su } = await sb.from('slack_users').select('slack_id').eq('name', prof.name).maybeSingle()
    if (!(su && su.slack_id && process.env.SLACK_BOT_TOKEN)) return Response.json({ fallbackEmail: true })

    let res = await sb.auth.admin.generateLink({ type: 'magiclink', email: target, options: { redirectTo } })
    if (res.error) res = await sb.auth.admin.generateLink({ type: 'invite', email: target, options: { redirectTo } })
    if (res.error) return Response.json({ error: res.error.message }, { status: 502 })
    const link = res.data && res.data.properties && res.data.properties.action_link

    const dm = await dmUser(su.slack_id, `🔑 Your *Project Plan Agent* sign-in link (one-time, expires ~1 hour):\n${link}`)
    if (dm && dm.ts) return Response.json({ ok: true })
    return Response.json({ error: 'Could not send the Slack DM: ' + ((dm && dm.error) || 'unknown') }, { status: 502 })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
