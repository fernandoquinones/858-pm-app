// GET -> list workspace channels the bot can see, for the "connect a room" picker.
export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return Response.json({ channels: [], error: 'Slack not configured' })
  const r = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200', {
    headers: { authorization: `Bearer ${token}` }
  })
  const j = await r.json()
  if (!j.ok) return Response.json({ channels: [], error: j.error })
  const channels = (j.channels || []).map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name))
  return Response.json({ channels })
}
