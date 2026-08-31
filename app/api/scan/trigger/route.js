import { scanAll } from '../run/route'
// In-app "Scan now" — runs the scan for every configured event. Server-side; no secret in the client.
export async function POST() {
  try { return Response.json(await scanAll(false)) }
  catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
