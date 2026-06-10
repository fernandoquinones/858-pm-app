'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, BASE_ACTIVATIONS, parseActs } from '../lib/supabaseClient'
import { PEOPLE, isMaster, roleOf } from '../lib/roles'
import { useCurrentUser } from '../lib/useCurrentUser'
import { ActivationChips } from '../lib/ActivationChips'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useCurrentUser()
  const master = isMaster(user)

  const [projects, setProjects] = useState([])
  const [actOpts, setActOpts] = useState(BASE_ACTIVATIONS)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  // structured create
  const [evName, setEvName] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evActs, setEvActs] = useState([])
  const [creating, setCreating] = useState(false)

  // optional Claude box
  const [prompt, setPrompt] = useState('858 LA Holiday Party — evening reception, ~80 guests, Dec 12.')
  const [gen, setGen] = useState(false)

  async function load() {
    const [pr, lib] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('library_tasks').select('applies_to')
    ])
    if (pr.error) setErr(pr.error.message); else setProjects(pr.data || [])
    const found = new Set(BASE_ACTIVATIONS)
    ;(lib.data || []).forEach(r => parseActs(r.applies_to).forEach(a => { if (a !== 'All events') found.add(a) }))
    setActOpts([...found])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function createEvent() {
    if (!evName.trim()) { setErr('Give the event a name.'); return }
    setCreating(true); setErr(null)
    try {
      const r = await fetch('/api/create-event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: evName, date: evDate || null, activations: evActs }) })
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Could not create event'); setCreating(false); return }
      router.push(`/project/${j.projectId}`)
    } catch (e) { setErr(String(e)); setCreating(false) }
  }

  async function generate() {
    if (!prompt.trim()) return
    setGen(true); setErr(null)
    try {
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Generation failed'); setGen(false); return }
      router.push(`/project/${j.projectId}`)
    } catch (e) { setErr(String(e)); setGen(false) }
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>858 Project Tool</h1>
          <div className="sub sans">Multifunction event project plans — single source of truth</div>
        </div>
        <div className="chips sans">
          <div className="chip"><span className="dot"></span> Live · Supabase</div>
          <label className="chip" style={{ gap: 6 }}>Acting as
            <select value={user} onChange={e => setUser(e.target.value)} style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>
              {PEOPLE.map(p => <option key={p.name} value={p.name}>{p.name} ({p.role})</option>)}
            </select>
          </label>
        </div>
      </div>

      {err && <div className="banner sans">{err}</div>}

      {master ? (
        <>
          {/* Structured create — pick activations, build from the library, no AI needed */}
          <div className="card sans">
            <div className="subh">+ Create a new event</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <input placeholder="Event name (e.g. 858 LA Holiday Party)" value={evName} onChange={e => setEvName(e.target.value)} style={{ flex: 1, minWidth: 240, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
              <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} title="Event date" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 7 }}>Activations happening at this event:</div>
            <ActivationChips value={evActs} options={actOpts} onChange={setEvActs} includeAllEvents={false} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
              <button className="btn" onClick={createEvent} disabled={creating}>{creating ? 'Building plan…' : 'Create event plan'}</button>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Pulls every &ldquo;All events&rdquo; task plus the activations you pick — straight from your library. No AI needed.</span>
            </div>
          </div>

          {/* Optional: describe it to Claude */}
          <div className="card sans">
            <div className="subh">✨ Or describe it to Claude</div>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="Describe the event in one sentence…" style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <button className="btn ghost" onClick={generate} disabled={gen}>{gen ? 'Claude is building…' : 'Generate with Claude'}</button>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Free-form alternative (needs the Anthropic key turned on).</span>
            </div>
          </div>
        </>
      ) : (
        <div className="card sans" style={{ color: 'var(--faint)' }}>
          You have <b style={{ color: 'var(--ink)' }}>{roleOf(user)}</b> access — view everything, comment on any task, and update your own. Creating events is limited to Christina and Fern.
        </div>
      )}

      {loading ? <div className="loading sans">Loading…</div> : (
        <div>
          {projects.length === 0 && <div className="card sans" style={{ color: 'var(--faint)' }}>No events yet. Create one above.</div>}
          {projects.map(p => (
            <Link key={p.id} href={`/project/${p.id}`} className="card sans" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, fontFamily: 'Fira Sans Condensed, sans-serif' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{p.type}{p.event_date ? ` · ${p.event_date}` : ''}</div>
              </div>
              <span className="btn ghost sm">Open →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
