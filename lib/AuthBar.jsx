'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Small sign-in / sign-out control. Magic link when signed out; identity + sign out when signed in.
export function AuthBar() {
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null))
    return () => { if (data && data.subscription) data.subscription.unsubscribe() }
  }, [])

  async function sendLink(e) {
    e.preventDefault()
    const addr = email.trim().toLowerCase(); if (!addr) return
    setBusy(true); setMsg('')
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined
      const r = await fetch('/api/auth/request-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: addr, redirectTo: origin }) })
      const j = await r.json()
      if (j.ok) setMsg('Sent to your Slack DMs.')
      else if (j.fallbackEmail) { const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: origin } }); setMsg(error ? ('Error: ' + error.message) : 'Sent to your email.') }
      else setMsg(j.error || 'Could not send link.')
    } catch (err) { setMsg('Error: ' + err) }
    setBusy(false)
  }
  async function signOut() { await supabase.auth.signOut() }

  if (session === undefined) return null
  if (session) {
    return (
      <span className="chip" style={{ gap: 8 }}>
        <span className="dot" style={{ background: '#3FB37F' }} />
        {session.user.email}
        <button onClick={signOut} style={{ border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Sign out</button>
      </span>
    )
  }
  return (
    <form onSubmit={sendLink} className="chip" style={{ gap: 6 }}>
      <input type="email" required placeholder="you@858partners.com" value={email} onChange={e => setEmail(e.target.value)} style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, minWidth: 150 }} />
      <button type="submit" disabled={busy} style={{ border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{busy ? '…' : 'Sign in'}</button>
      {msg && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{msg}</span>}
    </form>
  )
}
