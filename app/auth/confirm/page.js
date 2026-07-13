'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

export default function Confirm() {
  const router = useRouter()
  const [err, setErr] = useState('')
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const token_hash = p.get('token_hash')
    const type = p.get('type') || 'magiclink'
    if (!token_hash) { setErr('Invalid or missing link.'); return }
    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) setErr(error.message)
      else router.replace('/')
    })
  }, [])
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#667085', padding: 20, textAlign: 'center' }}>
      {err ? <span>Sign-in failed: {err}. Request a new link from the login screen.</span> : <span>Signing you in…</span>}
    </div>
  )
}
