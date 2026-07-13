'use client'
import { useEffect, useState } from 'react'
import { PEOPLE } from './roles'
import { supabase } from './supabaseClient'

// Identity for the app. Prefers a real Supabase Auth session (magic link);
// falls back to the "Acting as" switcher (localStorage) when not signed in.
// Returns [user, change, authed]. When signed in, `change` is a no-op (real identity wins).
export function useCurrentUser() {
  const [user, setUser] = useState('Christina')
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let sub
    async function applyEmail(email) {
      if (!email) return
      const { data } = await supabase.from('profiles').select('name').eq('email', email.toLowerCase()).maybeSingle()
      setAuthed(true)
      setUser(data && data.name ? data.name : '')   // signed in but not provisioned = no name (member-level)
    }
    function fallback() {
      setAuthed(false)
      const saved = typeof window !== 'undefined' && window.localStorage.getItem('currentUser')
      setUser(saved && PEOPLE.some(p => p.name === saved) ? saved : 'Christina')
    }
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session && session.user && session.user.email) await applyEmail(session.user.email)
        else fallback()
      } catch (e) { fallback() }
    }
    init()
    try {
      const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (session && session.user && session.user.email) applyEmail(session.user.email)
        else fallback()
      })
      sub = data && data.subscription
    } catch (e) {}
    return () => { if (sub) sub.unsubscribe() }
  }, [])

  function change(name) {
    if (authed) return
    setUser(name)
    if (typeof window !== 'undefined') window.localStorage.setItem('currentUser', name)
  }
  return [user, change, authed]
}
