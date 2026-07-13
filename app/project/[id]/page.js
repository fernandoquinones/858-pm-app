'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, parseActs } from '../../../lib/supabaseClient'

const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

export default function EventLanding() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  useEffect(() => { supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => data && setP(data)) }, [id])

  const mods = [
    { href: `/project/${id}/plan`, icon: '📋', title: 'Event Hub', desc: 'The task plan & timeline — owners, due dates, reports.' },
    { href: `/project/${id}/client`, icon: '🤝', title: 'Client Hub', desc: 'Per-client to-dos, attendee sheets, targets & tracking.' },
    { href: `/project/${id}/internal`, icon: '🗂', title: 'Internal Hub', desc: 'Run-of-show, arrivals, registration & prep (internal).' },
  ]
  const loc = p ? [p.city, p.state].filter(Boolean).join(', ') : ''
  return (
    <div className="wrap sans">
      <div className="crumb"><Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Events</Link></div>
      <h1 style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{p ? p.name : '…'}</h1>
      <div className="sub sans" style={{ marginBottom: 22 }}>{p ? [fmt(p.event_date) + (p.event_end_date ? ' – ' + fmt(p.event_end_date) : ''), loc, p.venue].filter(Boolean).join(' · ') : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {mods.map(m => (
          <Link key={m.href} href={m.href} className="card sans" style={{ textDecoration: 'none', display: 'block', margin: 0, transition: 'border-color .1s' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontFamily: 'Instrument Sans, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{m.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{m.desc}</div>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 12 }}>Open →</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
