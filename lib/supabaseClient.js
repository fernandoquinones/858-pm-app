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
  'Christina', 'Fern', 'Nic', 'JG', 'Chris', 'Marty',
  'Fern+Christina', 'Chris+JG', 'JG+Marty', 'Team'
]
export const OWNER_COLOR = {
  Christina: '#185FA5', Fern: '#1D9E75', Nic: '#993C1D', JG: '#534AB7',
  Chris: '#888780', Marty: '#854F0B', 'Fern+Christina': '#0F6E56',
  'Chris+JG': '#3B6D11', 'JG+Marty': '#854F0B', Team: '#5f5e5a'
}
export const STATUS = { todo: 'To do', prog: 'In progress', review: 'Needs review', done: 'Done ✓' }

// Activations: reusable building blocks an event is made of.
export const BASE_ACTIVATIONS = ['Luncheon', 'Bird circles', '858 House', 'GRIP', 'Presentation']
export function parseActs(s) { return (s || '').split(' / ').map(x => x.trim()).filter(Boolean) }
export function joinActs(arr) {
  const a = (arr || []).filter(Boolean)
  return a.includes('All events') ? 'All events' : a.join(' / ')
}
