'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from './supabaseClient'

// Global login gate: no session -> clean login screen; session -> render the app.
export function AuthGate({ children }) {
  const pathname = usePathname()
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null))
    return () => { if (data && data.subscription) data.subscription.unsubscribe() }
  }, [])

  async function send(e) {
    e.preventDefault()
    const addr = email.trim().toLowerCase(); if (!addr) return
    setBusy(true); setMsg('')
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined
      const r = await fetch('/api/auth/request-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: addr, redirectTo: origin }) })
      const j = await r.json()
      if (j.ok) { setSent(true); setMsg('Sent! Check your Slack DMs for the sign-in link.') }
      else if (j.fallbackEmail) {
        const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: origin } })
        setSent(!error); setMsg(error ? ('Error: ' + error.message) : 'Sent! Check your email for the sign-in link.')
      } else { setSent(false); setMsg(j.error || 'Could not send link.') }
    } catch (err) { setSent(false); setMsg('Error: ' + err) }
    setBusy(false)
  }

  if (pathname && pathname.startsWith('/auth/')) return children
  if (session === undefined) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9DAAB7', fontFamily: 'Inter, sans-serif' }}>Loading…</div>
  if (session) return children

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F4F7', fontFamily: 'Inter, sans-serif', padding: 20 }}>
      <div style={{ width: 380, maxWidth: '92%', background: '#fff', border: '1px solid #E5E8EE', borderRadius: 16, padding: '34px 30px', boxShadow: '0 8px 30px rgba(20,35,60,.08)', textAlign: 'center' }}>
        <img src="/logo.svg" alt="858" style={{ height: 34, marginBottom: 16 }} />
        <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#1A2333' }}>Project Plan Agent</h1>
        <p style={{ color: '#667085', fontSize: 13.5, margin: '0 0 22px' }}>Enter your 858 email — we’ll send your sign-in link to your Slack.</p>
        <form onSubmit={send}>
          <input type="email" required placeholder="you@858partners.com" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', border: '1px solid #E5E8EE', borderRadius: 10, padding: '11px 13px', fontFamily: 'inherit', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
          <button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: '#3A7BD5', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>{busy ? 'Sending…' : 'Send magic link'}</button>
        </form>
        {msg && <p style={{ fontSize: 12.5, color: sent ? '#0F6E56' : '#B25A00', marginTop: 14 }}>{msg}</p>}
      </div>
    </div>
  )
}
