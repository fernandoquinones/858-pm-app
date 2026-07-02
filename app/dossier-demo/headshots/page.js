'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'
import { useCurrentUser } from '../../../lib/useCurrentUser'
import { isMaster } from '../../../lib/roles'

const EXTS = ['jpeg', 'png', 'jpg', 'webp']
const PAGE = 25
const initials = n => (n || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '—'

export default function HeadshotsPage() {
  const [user] = useCurrentUser()
  const allowed = user === 'Christina' || isMaster(user)

  const [people, setPeople] = useState([])
  const [fileByBase, setFileByBase] = useState({}) // id -> stored filename
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [companyF, setCompanyF] = useState('')
  const [metroF, setMetroF] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [page, setPage] = useState(0)

  async function loadPeople() {
    setLoading(true)
    try {
      const r = await fetch('/api/attio/people'); const j = await r.json()
      setPeople(j.people || []); setSource(j.source || '')
    } catch (e) { setErr('Could not load contacts: ' + e) }
    setLoading(false)
  }
  async function loadFiles() {
    try {
      const { data, error } = await supabase.storage.from('headshots').list('', { limit: 2000 })
      if (error) { setErr('Could not read headshots bucket: ' + error.message); return }
      const map = {}
      ;(data || []).forEach(f => { const base = f.name.replace(/\.[^.]+$/, ''); map[base] = f.name })
      setFileByBase(map)
    } catch (e) { setErr(String(e)) }
  }
  useEffect(() => { if (allowed) { loadPeople(); loadFiles() } }, [allowed])

  const companies = useMemo(() => [...new Set(people.map(p => p.company).filter(Boolean))].sort(), [people])
  const metros = useMemo(() => [...new Set(people.map(p => p.metro).filter(Boolean))].sort(), [people])
  const hasShot = id => !!fileByBase[id]
  const withCount = useMemo(() => people.filter(p => hasShot(p.id)).length, [people, fileByBase])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return people.filter(p => {
      if (companyF && p.company !== companyF) return false
      if (metroF && p.metro !== metroF) return false
      if (missingOnly && hasShot(p.id)) return false
      if (s && !(`${p.name} ${p.email} ${p.company}`.toLowerCase().includes(s))) return false
      return true
    })
  }, [people, q, companyF, metroF, missingOnly, fileByBase])

  useEffect(() => { setPage(0) }, [q, companyF, metroF, missingOnly])
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const shotUrl = id => fileByBase[id] ? supabase.storage.from('headshots').getPublicUrl(fileByBase[id]).data.publicUrl : null

  async function upload(id, file) {
    if (!file) return
    setErr(null)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${id}.${EXTS.includes(ext) ? ext : 'jpg'}`
    // remove any existing file for this id (different ext) to avoid duplicates
    if (fileByBase[id] && fileByBase[id] !== path) { try { await supabase.storage.from('headshots').remove([fileByBase[id]]) } catch (e) {} }
    const up = await supabase.storage.from('headshots').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
    if (up.error) { setErr('Upload failed: ' + up.error.message + ' — the "headshots" Storage bucket needs to allow uploads.'); return }
    setFileByBase(m => ({ ...m, [id]: path }))
  }

  if (!allowed) return (
    <div className="wrap sans"><div className="card" style={{ color: 'var(--faint)' }}>
      🔒 The Headshots manager is available to Christina only. (You're acting as <b style={{ color: 'var(--ink)' }}>{user}</b>.)
    </div></div>
  )

  return (
    <div className="wrap sans">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}><Link href="/dossier-demo" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Dossier</Link></div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>Headshots</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {loading ? 'Loading…' : `${people.length.toLocaleString()} people · ${withCount.toLocaleString()} with a headshot`}
            {source && source !== 'attio' && <span style={{ marginLeft: 8, fontSize: 11, background: '#FAEEDA', color: '#854F0B', padding: '2px 7px', borderRadius: 999 }}>{source === 'sample' ? 'sample data — add ATTIO_API_KEY to go live' : source}</span>}
          </div>
        </div>
        <button className="btn ghost" onClick={() => { loadPeople(); loadFiles() }}>⟳ Sync now</button>
      </div>

      {err && <div className="banner">{err}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="Search name, email, company…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontFamily: 'inherit', fontSize: 13 }} />
        <select value={companyF} onChange={e => setCompanyF(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }}>
          <option value="">All companies</option>{companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={metroF} onChange={e => setMetroF(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }}>
          <option value="">All metros</option>{metros.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} /> Missing headshot
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--faint)' }}>{filtered.length.toLocaleString()} of {people.length.toLocaleString()}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <th style={{ padding: '10px 12px' }}>Avatar</th>
              <th style={{ padding: '10px 12px' }}>Headshot</th>
              <th style={{ padding: '10px 12px' }}>Name</th>
              <th style={{ padding: '10px 12px' }}>Company</th>
              <th style={{ padding: '10px 12px' }}>Metro</th>
              <th style={{ padding: '10px 12px' }}>Title</th>
              <th style={{ padding: '10px 12px' }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(p => (
              <Row key={p.id} p={p} url={shotUrl(p.id)} onUpload={f => upload(p.id, f)} />
            ))}
            {!loading && !pageRows.length && <tr><td colSpan={7} style={{ padding: 24, color: 'var(--faint)', textAlign: 'center' }}>No contacts match.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
        <span>{filtered.length ? `${page * PAGE + 1}–${Math.min((page + 1) * PAGE, filtered.length)} / ${filtered.length.toLocaleString()}` : '0'}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>‹ Prev</button>
          <button className="btn ghost sm" disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </span>
      </div>
    </div>
  )
}

function Row({ p, url, onUpload }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const drop = e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) onUpload(f) }
  return (
    <tr style={{ borderTop: '1px solid var(--line)' }}>
      <td style={{ padding: '8px 12px' }}>
        {url && imgOk
          ? <img src={url} alt="" onError={() => setImgOk(false)} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
          : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8eaef', color: '#8a90a0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{initials(p.name)}</div>}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <div onClick={() => inputRef.current && inputRef.current.click()} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}
          title="Click or drop an image"
          style={{ width: 52, height: 52, borderRadius: 8, border: `1.5px dashed ${over ? 'var(--accent)' : '#c9ced8'}`, background: over ? '#eef3fb' : '#f6f7f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
          {url && imgOk ? <img src={url} alt="" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#9aa1ad', fontSize: 20 }}>+</span>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) onUpload(f) }} />
      </td>
      <td style={{ padding: '8px 12px', fontWeight: 600, color: p.name ? 'var(--ink)' : 'var(--faint)' }}>{p.name || '(no name)'}</td>
      <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.company || '—'}</td>
      <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.metro || '—'}</td>
      <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.title || '—'}</td>
      <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.email || '—'}</td>
    </tr>
  )
}
