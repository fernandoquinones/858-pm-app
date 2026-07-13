'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabaseClient'
import { EventTabs } from '../../../../lib/EventTabs'

// Internal dossier — placeholder/sample sections (Juan's "internal dossier").
// Wired to real data later; for now it shows the structure with sample content.
const SAMPLE = {
  runOfShow: [
    ['Mon 8:00a', 'Tech Exhibition opens', 'On-site team'],
    ['Mon 12:00p', '858 Innovation Forum', 'JG'],
    ['Mon 5:00p', 'Welcome Reception', 'Fernando'],
    ['Tue 10:15a', 'GRIP 1:1 Speed Networking', 'JG + ESMs'],
    ['Tue 5:30p', 'Happy Hour Reception', 'Christina'],
  ],
  travel: [
    ['Fernando', 'Sun 3:10p arrive · Wed 6:00p depart', 'Terranea Resort — conf #TRN8842'],
    ['Christina', 'Sun 1:45p arrive · Wed 4:30p depart', 'Terranea Resort — conf #TRN8843'],
    ['JG', 'Mon 9:00a arrive · Wed 6:00p depart', 'Terranea Resort — conf #TRN8844'],
  ],
  reg: [['Registered', '212'], ['VIP dinner', '37'], ['858 team on-site', '6'], ['No-shows (live)', '—']],
  prep: [
    'Client prep calls complete for all 7 clients',
    'Run-of-show finalized + transition leads assigned',
    'AV + tech rehearsal — Sun 4:00p on-site',
    'Objectives: 45–50 operators to VIP dinner; every client meets ≥8 targets',
  ],
}

export default function InternalHub() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  useEffect(() => { supabase.from('projects').select('id,name').eq('id', id).single().then(({ data }) => data && setProject(data)) }, [id])
  const Section = ({ title, children }) => (
    <div className="card sans"><div className="subh" style={{ marginBottom: 10 }}>{title}</div>{children}</div>
  )
  return (
    <div className="wrap sans">
      <div className="crumb"><Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Events</Link></div>
      <h1 style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{project ? project.name : '…'}</h1>
      <div className="sub sans" style={{ marginBottom: 10 }}>Internal Hub</div>
      <EventTabs id={id} active="internal" />
      <div style={{ fontSize: 12.5, background: '#FAEEDA', color: '#854F0B', padding: '8px 12px', borderRadius: 10, marginBottom: 16 }}>⚠ Placeholder / sample data — this is the layout; we’ll wire it to live data next.</div>

      <Section title="🗓 Run of show">
        {SAMPLE.runOfShow.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '8px 0', borderTop: i ? '1px solid #eef0f4' : 'none', fontSize: 14 }}>
            <span style={{ color: 'var(--muted)', minWidth: 90 }}>{r[0]}</span><span style={{ flex: 1, fontWeight: 500 }}>{r[1]}</span><span style={{ color: 'var(--muted)' }}>{r[2]}</span>
          </div>
        ))}
      </Section>
      <Section title="✈️ Arrivals, departures & hotels">
        {SAMPLE.travel.map((r, i) => (
          <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid #eef0f4' : 'none', fontSize: 14 }}>
            <b>{r[0]}</b> <span style={{ color: 'var(--muted)' }}>· {r[1]}</span><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r[2]}</div>
          </div>
        ))}
      </Section>
      <Section title="📊 Registration numbers">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {SAMPLE.reg.map((r, i) => (
            <div key={i} className="tile" style={{ minWidth: 120 }}><div className="tnum">{r[1]}</div><div className="tlab">{r[0]}</div></div>
          ))}
        </div>
      </Section>
      <Section title="✅ Prep, objectives & rehearsals">
        {SAMPLE.prep.map((r, i) => <div key={i} style={{ padding: '6px 0', fontSize: 14 }}>• {r}</div>)}
      </Section>
    </div>
  )
}
