import crypto from 'crypto'

// Verify a request really came from Slack (v0 HMAC signature).
// Pass the RAW request body (text), the X-Slack-Request-Timestamp and X-Slack-Signature headers.
export function verifySlack(rawBody, timestamp, signature) {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret || !timestamp || !signature) return false
  // reject requests older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const base = `v0:${timestamp}:${rawBody}`
  const mine = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(signature))
  } catch {
    return false
  }
}
