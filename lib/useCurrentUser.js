'use client'
import { useEffect, useState } from 'react'
import { PEOPLE } from './roles'

// Prototype stand-in for login: the chosen person is remembered in the browser.
// In production this is replaced by Supabase Auth (the signed-in user).
export function useCurrentUser() {
  const [user, setUser] = useState('Christina')
  useEffect(() => {
    const saved = typeof window !== 'undefined' && window.localStorage.getItem('currentUser')
    if (saved && PEOPLE.some(p => p.name === saved)) setUser(saved)
  }, [])
  function change(name) {
    setUser(name)
    if (typeof window !== 'undefined') window.localStorage.setItem('currentUser', name)
  }
  return [user, change]
}
