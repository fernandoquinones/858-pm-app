'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// MOCK "Attio" contact records (stands in for the real CRM until connected).
// slug = the headshot filename in the Supabase "headshots" bucket: slug.jpeg
const MOCK_ATTIO = [
  { slug: 'aaron-weedy', name: 'Aaron Weedy', brand: 'Ledo Pizza', brandFacts: 'Maryland-born pizza franchise; known for square pies, ~100+ locations.' },
  { slug: 'aj-francavilla', name: 'AJ Francavilla', brand: 'Sodexo', brandFacts: 'Global food services & facilities management company.' },
  { slug: 'angell-tsang', name: 'Angell Tsang', brand: 'Tso Chinese', brandFacts: 'Austin-based fast-casual Chinese / delivery brand.' },
  { slug: 'ann-hufford', name: 'Ann Hufford', brand: 'Technomic', brandFacts: 'Foodservice industry research & consulting firm.' },
  { slug: 'anne-chaio', name: 'Anne Chaio', brand: 'Friedmans Hospitality', brandFacts: 'New York City restaurant group.' },
  { slug: 'bradley-parker', name: 'Bradley Parker', brand: 'Parker Hospitality', brandFacts: 'Chicago-based hospitality group (The Hampton Social, etc.).' },
  { slug: 'brendon-gilbert', name: 'Brendon Gilbert', brand: "Hattie B's", brandFacts: 'Nashville-born hot chicken restaurant group.' },
  { slug: 'brian-anderson', name: 'Brian Anderson', brand: 'Upward Projects', brandFacts: 'Phoenix-based restaurant group (Postino, Joyride, etc.).' },
  { slug: 'achilles-papakonstantinou', name: 'Achilles Papakonstantinou', brand: 'Nostimo Brands', brandFacts: 'Mediterranean / Greek-inspired restaurant group.' },
  { slug: 'april-brady', name: 'April Brady', brand: 'Technomic', brandFacts: 'Foodservice industry research & consulting firm.' },
]

const SAMPLE_LIST = [
  'Aaron Weedy, , Ledo Pizza',
  'AJ Francavilla, , Sodexo',
  'Angell Tsang, , Tso Chinese',
  'Ann Hufford, , Technomic',
  'Anne Chaio, , Friedmans Hospitality',
  'Bradley Parker, , Parker Hospitality',
  "Brendon Gilbert, , Hattie B's",
  'Brian Anderson, , Upward Projects',
  'Achilles Papakonstantinou, , Nostimo Brands',
  'April Brady, , Technomic',
  'Jordan Wells, , Unknown Co.',
].join('\n')

const EXTS = ['jpeg', 'png', 'jpg']
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

function Avatar({ slug, name }) {
  const [i, setI] = useState(0)
  if (!slug || i >= EXTS.length) return <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1B2A4A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flex: 'none' }}>{initials(name)}</div>
  const url = supabase.storage.from('headshots').getPublicUrl(slug + '.' + EXTS[i]).data.publicUrl
  return <img src={url} alt={name} onError={() => setI(i + 1)} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flex: 'none', background: '#eef0f3' }} />
}

function SeatingChart() {
  const tables = [
    { n: 1, label: 'Table 1', people: ['Aaron Weedy', 'AJ Francavilla', 'Angell Tsang', 'Ann Hufford', '', ''] },
    { n: 2, label: 'Table 2', people: ['Anne Chaio', 'Bradley Parker', 'Brendon Gilbert', '', '', ''] },
    { n: 3, label: 'Table 3', people: ['Brian Anderson', 'Achilles Papakonstantinou', 'April Brady', '', '', ''] },
    { n: 4, label: 'Your table', you: true, people: ['Momentum (you)', 'Christina · 858', 'Target: Aaron W.', 'Target: Bradley P.', '', ''] },
  ]
  const pos = [{ x: 150, y: 120 }, { x: 410, y: 120 }, { x: 150, y: 300 }, { x: 410, y: 300 }]
  const R = 42, dist = 66
  return (
    <div>
      <svg viewBox="0 0 560 420" style={{ width: '100%', maxWidth: 560, display: 'block', margin: '10px auto 0' }} fontFamily="Fira Sans, sans-serif">
        <rect x="8" y="8" width="544" height="404" rx="14" fill="#f7f7f5" stroke="#e2e5ea" />
        {tables.map((t, ti) => {
          const c = pos[ti]
          return (
            <g key={t.n}>
              {t.people.map((p, k) => {
                const ang = (k / t.people.length) * 2 * Math.PI - Math.PI / 2
                const sx = c.x + dist * Math.cos(ang), sy = c.y + dist * Math.sin(ang)
                const occ = !!p
                return (
                  <g key={k}>
                    <circle cx={sx} cy={sy} r="12" fill={occ ? '#1B2A4A' : '#fff'} stroke={occ ? '#1B2A4A' : '#cfd4dc'} />
                    <text x={sx} y={sy + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={occ ? '#fff' : '#cfd4dc'}>{occ ? initials(p) : '+'}</text>
                    {occ && <title>{p}</title>}
                  </g>
                )
              })}
              <circle cx={c.x} cy={c.y} r={R} fill={t.you ? '#E6F1FB' : '#fff'} stroke={t.you ? '#2E5AAC' : '#cfd4dc'} strokeWidth={t.you ? 2 : 1} />
              <text x={c.x} y={t.you ? c.y - 2 : c.y + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1B2A4A">{t.n}</text>
              {t.you && <text x={c.x} y={c.y + 12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#2E5AAC">YOU</text>}
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 12 }}>
        {tables.map(t => (
          <div key={t.n}><b style={{ color: t.you ? '#2E5AAC' : '#1B2A4A' }}>{t.label}</b>: <span style={{ color: '#5f6672' }}>{t.people.filter(Boolean).join(', ') || 'open'}</span></div>
        ))}
      </div>
    </div>
  )
}

const TIERS = ['—', 'Tier 1', 'Tier 2', 'Customer', 'Detractor']

export default function DossierDemo() {
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState(null)
  const [tier, setTier] = useState({})
  const [notes, setNotes] = useState({})
  const [savedAt, setSavedAt] = useState(null)

  function scrub() {
    const parsed = raw.split('\n').map(l => l.split(',').map(s => s.trim())).filter(a => a[0])
    const enriched = parsed.map(([name, email, company]) => {
      const m = MOCK_ATTIO.find(c => c.name.toLowerCase() === (name || '').toLowerCase())
      return {
        name: (m && m.name) || name, brand: (m && m.brand) || company || '',
        brandFacts: (m && m.brandFacts) || '', slug: (m && m.slug) || '', matched: !!m
      }
    })
    setRows(enriched)
  }

  const matched = rows ? rows.filter(r => r.matched).length : 0
  const wrap = { maxWidth: 980, margin: '0 auto', padding: '24px 20px', fontFamily: 'Fira Sans, system-ui, sans-serif', color: '#1B2A4A' }
  const card = { background: '#fff', border: '1px solid #e8eaee', borderRadius: 14, padding: 18 }
  const tag = (txt, color) => <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 6 }}>{txt}</span>
  const renderCard = (r, i) => (
    <div key={i} style={{ display: 'flex', gap: 14, padding: 12, border: '1px solid #eef0f3', borderRadius: 10, alignItems: 'flex-start', background: r.matched ? '#fff' : '#fff8f6', marginTop: 8 }}>
      <Avatar slug={r.slug} name={r.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{r.name} {!r.matched && <span style={{ fontSize: 10.5, color: '#b42318', fontWeight: 600 }}>· no match — needs review</span>}</div>
        <div style={{ fontSize: 13, color: '#1B2A4A' }}><b>{r.brand}</b></div>
        {r.brandFacts && <div style={{ fontSize: 12.5, color: '#5f6672', marginTop: 4 }}>{r.brandFacts}</div>}
        {r.matched && <div style={{ fontSize: 11.5, color: '#993556', marginTop: 4, fontStyle: 'italic' }}>Title &amp; bio populate from Attio once connected</div>}
        <textarea value={notes[i] || ''} onChange={e => { setNotes(n => ({ ...n, [i]: e.target.value })); setSavedAt(Date.now()) }} placeholder="Add account notes (text only)…" rows={2} style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, border: '1px solid #e2e5ea', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: 12.5, resize: 'vertical', color: '#1B2A4A' }} />
      </div>
      <select value={tier[i] || '—'} onChange={e => { setTier(t => ({ ...t, [i]: e.target.value })); setSavedAt(Date.now()) }} style={{ border: '1px solid #e2e5ea', borderRadius: 999, padding: '5px 10px', fontFamily: 'inherit', fontSize: 12, color: '#1B2A4A', flex: 'none', alignSelf: 'center' }}>
        {TIERS.map(t => <option key={t}>{t}</option>)}
      </select>
    </div>
  )
  const SECTIONS = [
    { key: 'Tier 1', color: '#0C447C', bg: '#E6F1FB' },
    { key: 'Tier 2', color: '#185FA5', bg: '#eef3fb' },
    { key: 'Customer', color: '#0F6E56', bg: '#E1F5EE' },
    { key: 'Detractor', color: '#A32D2D', bg: '#FCEBEB' },
    { key: 'Unsorted', color: '#5f6672', bg: '#f1efe8' },
  ]
  const groupOf = i => (['Tier 1', 'Tier 2', 'Customer', 'Detractor'].includes(tier[i]) ? tier[i] : 'Unsorted')

  return (
    <div style={wrap}>
      <div style={{ fontSize: 12, color: '#9aa1ad' }}>858 · Client dossier (demo)</div>
      <h1 style={{ fontSize: 26, margin: '4px 0 2px' }}>858 GRIP Summit — Chicago</h1>
      <div style={{ color: '#5f6672', fontSize: 14, marginBottom: 16 }}>Nov 8, 2026 · The Langham, Chicago, IL — <b>Momentum Foods</b> client dossier</div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#2E5AAC' }}>From the project plan <span style={{ color: '#9aa1ad' }}>· ~80% of the dossier</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10, fontSize: 13.5 }}>
          <div><b>Agenda</b><div style={{ color: '#5f6672', marginTop: 4 }}>9:00 Welcome · 9:30 Luncheon · 11:00 GRIP 1:1s · 2:00 Workshop · 5:30 Evening networking</div></div>
          <div><b>Your 858 team</b><div style={{ color: '#5f6672', marginTop: 4 }}>Christina (PM) · JG (seating &amp; GRIP) · Nic (strategy)</div></div>
          <div><b>Room &amp; seating</b><div style={{ color: '#5f6672', marginTop: 4 }}>Grand Ballroom — table 4 · GRIP suite 2</div></div>
          <div><b>Logistics</b><div style={{ color: '#5f6672', marginTop: 4 }}>Arrive 8:30 · dossier link live · run-of-show attached</div></div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#2E5AAC' }}>Room &amp; seating chart <span style={{ color: '#9aa1ad' }}>· sample · hover a seat for the name</span></div>
        <SeatingChart />
      </div>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#2E5AAC' }}>1. Upload the organizer's attendee list</div>
        <div style={{ fontSize: 12.5, color: '#5f6672', margin: '6px 0 8px' }}>Paste rows as <code>Name, Email, Company</code> — organizer lists are sparse; we fill the rest.</div>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={5} placeholder="Aaron Weedy, , Ledo Pizza" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e5ea', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 12.5 }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <button onClick={() => setRaw(SAMPLE_LIST)} style={{ border: '1px solid #e2e5ea', borderRadius: 8, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#2E5AAC' }}>Load sample list</button>
          <button onClick={scrub} style={{ border: 'none', borderRadius: 8, padding: '8px 14px', background: '#2E5AAC', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Scrub &amp; build dossier →</button>
        </div>
        <div style={{ fontSize: 11.5, color: '#9aa1ad', marginTop: 10 }}>
          Scrubs each row against: {tag('ATTIO (mock)', '#993556')} brand · brand facts · title · bio &nbsp;|&nbsp; {tag('SUPABASE', '#1D9E75')} headshot
        </div>
      </div>

      {rows && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#2E5AAC' }}>2. Enriched dossier — pick your targets</div>
            <div style={{ fontSize: 12, color: '#5f6672' }}>{matched}/{rows.length} matched{savedAt && <span style={{ color: '#0F6E56', marginLeft: 8, fontWeight: 600 }}>✓ Saved automatically</span>}</div>
          </div>
          {SECTIONS.map(sec => {
            const items = rows.map((r, i) => ({ r, i })).filter(({ i }) => groupOf(i) === sec.key)
            if (!items.length) return null
            return (
              <div key={sec.key} style={{ marginTop: 16 }}>
                <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: sec.color, background: sec.bg, borderRadius: 999, padding: '3px 12px' }}>{sec.key} · {items.length}</span>
                {items.map(({ r, i }) => renderCard(r, i))}
              </div>
            )
          })}
          <div style={{ fontSize: 11.5, color: '#9aa1ad', marginTop: 12 }}>Client picks a tier and adds account notes — the only two things they can edit. Everything saves automatically; no submit needed. Unmatched rows are flagged for the team to reconcile.</div>
        </div>
      )}
    </div>
  )
}
