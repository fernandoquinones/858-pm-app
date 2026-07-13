'use client'
import { useEffect, useState } from 'react'
import { PEOPLE, isMaster } from './roles'
import { supabase } from './supabaseClient'

// Identity for the app. Prefers a real Supabase Auth session (magic link);
// falls back to the "Acting as" switcher (localStorage) when not signed in.
// Returns [user, change, authed, realUser]. `realUser` = the true signed-in person
// (never changed by the switcher); owner/admin may "preview" other roles via change().
export function useCurrentUser() {
  const [user, setUser] = useState('Christina')
  const [realUser, setRealUser] = useState('')
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let sub
    async function applyEmail(email) {
      if (!email) return
      const { data } = await supabase.from('profiles').select('name').eq('email', email.toLowerCase()).maybeSingle()
      const nm = data && data.name ? data.name : ''
      setAuthed(true); setRealUser(nm); setUser(nm)
    }
    function fallback() {
      setAuthed(false); setRealUser('')
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

  // Not signed in -> free switch (dev). Signed in -> only owner/admin can preview other roles.
  function change(name) {
    if (authed && !isMaster(realUser)) return
    setUser(name)
    if (!authed && typeof window !== 'undefined') window.localStorage.setItem('currentUser', name)
  }
  return [user, change, authed, realUser]
}
