import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  // Helpful message if .env.local isn't set up yet.
  console.warn('Supabase env vars missing — copy .env.local.example to .env.local and add your keys.')
}

export const supabase = createClient(url || 'http://localhost', key || 'public-anon-key')

// Shared constants used across pages
export const OWNERS = [
  'Christina', 'Fernando', 'Nic', 'JG', 'Caitlin', 'Beth', 'Marty',
  'Client partner', 'ESMs', 'On-site team', 'TBD', 'Team'
]
export const OWNER_COLOR = {
  Christina: '#185FA5', Fernando: '#1D9E75', Nic: '#993C1D', JG: '#534AB7',
  Caitlin: '#9B2D6E', Beth: '#0F7B8A', Marty: '#854F0B', 'Client partner': '#993556',
  ESMs: '#0C447C', 'On-site team': '#3B6D11', TBD: '#9aa1ad', Team: '#5f5e5a'
}
export const STATUS = { todo: 'To do', prog: 'In progress', review: 'Needs review', done: 'Done ✓' }

// Activations: reusable building blocks an event is made of.
export const BASE_ACTIVATIONS = ['Luncheon', 'Workshop', '858 House', 'GRIP Meetings', 'Presentation', 'Guest speaker', 'Evening networking']
export function parseActs(s) { return (s || '').split(' / ').map(x => x.trim()).filter(Boolean) }
export function joinActs(arr) {
  const a = (arr || []).filter(Boolean)
  return a.includes('All events') ? 'All events' : a.join(' / ')
}
