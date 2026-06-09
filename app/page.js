'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { PEOPLE, isMaster, roleOf } from '../lib/roles'
import { useCurrentUser } from '../lib/useCurrentUser'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useCurrentUser()
  const master = isMaster(user)

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [prompt, setPrompt] = useState('CFO Luncheon for Acme Capital, 20 execs, 5 tables with a sponsor head table, assigned seating, event July 30.')
  const [gen, setGen] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (error) setErr(error.message); else setProjects(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function generate() {
    if (!prompt.trim()) return
    setGen(true); setErr(null)
    try {
      const r = await fetch('/api/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
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
          <label className="chip" style={{ gap: 6 }}>
            Acting as
            <select value={user} onChange={e => setUser(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>
              {PEOPLE.map(p => <option key={p.name} value={p.name}>{p.name} ({p.role})</option>)}
            </select>
          </label>
        </div>
      </div>

      {err && <div className="banner sans">{err}</div>}

      {master ? (
        <div className="card sans">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 8 }}>
            ✨ Start a plan with Claude
          </div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
            placeholder="Describe the event in one sentence…"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <button className="btn" onClick={generate} disabled={gen}>{gen ? 'Claude is building the plan…' : 'Generate plan'}</button>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Claude reads your task template library and writes the full plan to the database.</span>
          </div>
        </div>
      ) : (
        <div className="card sans" style={{ color: 'var(--faint)' }}>
          You have <b style={{ color: 'var(--ink)' }}>{roleOf(user)}</b> access — view everything, comment on any task, and update your own. Plan creation is limited to Christina and Fern.
        </div>
      )}

      {loading ? <div className="loading sans">Loading…</div> : (
        <div>
          {projects.length === 0 && <div className="card sans" style={{ color: 'var(--faint)' }}>No projects yet. Generate one above, or run <code>seed.sql</code>.</div>}
          {projects.map(p => (
            <Link key={p.id} href={`/project/${p.id}`} className="card sans" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, fontFamily: 'Georgia, serif' }}>{p.name}</div>
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
