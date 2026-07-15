'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabaseClient'
import { useCurrentUser } from '../../../../lib/useCurrentUser'
import { canEditClientHub } from '../../../../lib/roles'
import { EventTabs } from '../../../../lib/EventTabs'

const MTYPES = [
  { id: 'prep', label: 'Prep Call', host: 'Nic', color: '#0F6E56' },
  { id: 'deal', label: 'Deal Strategy Call', host: 'JG', color: '#185FA5' },
  { id: 'debrief', label: 'Client Debrief Call', host: 'Nic', color: '#8E44AD' },
]
const M_STATUS = ['Not Booked', 'Booked', 'Completed', 'N/A']
const M_COLOR = { 'Not Booked': '#94a3b8', 'Booked': '#3b82f6', 'Completed': '#22c55e', 'N/A': '#cbd5e1' }
const FLAG_COLOR = { High: '#dc2626', Medium: '#ca8a04', Low: '#15803d' }
const FLAG_BG = { High: '#fef2f2', Medium: '#fefce8', Low: '#f0fdf4' }
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

function StatusPill({ status, canEdit, onChange }) {
  const s = status || 'Not Booked'
  const bg = M_COLOR[s]; const fg = s === 'N/A' ? '#475569' : '#fff'
  if (canEdit) {
    return (
      <select value={s} onChange={e => onChange(e.target.value)}
        style={{ border: 'none', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 700, color: fg, background: bg, cursor: 'pointer', fontFamily: 'inherit' }}>
        {M_STATUS.map(o => <option key={o} value={o} style={{ color: '#000', background: '#fff' }}>{o}</option>)}
      </select>
    )
  }
  return <span style={{ display: 'inline-block', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: fg, background: bg }}>{s}</span>
}

function EditText({ value, onSave, canEdit, placeholder, date, style }) {
  const [editing, setEditing] = useState(false)
  const display = date ? fmtDate(value) : value
  if (canEdit && editing) {
    return <input autoFocus type={date ? 'date' : 'text'} defaultValue={value || ''}
      onBlur={e => { const v = e.target.value.trim(); if (v !== (value || '')) onSave(v); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false) }}
      style={{ font: 'inherit', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 6px', boxSizing: 'border-box', maxWidth: '100%', ...style }} />
  }
  const empty = !value
  if (empty && !canEdit) return null
  return <span onClick={() => canEdit && setEditing(true)} style={{ cursor: canEdit ? 'text' : 'default', ...style }}>
    {empty ? <span style={{ color: 'var(--faint)' }}>{placeholder || '\u2014'}</span> : display}
  </span>
}

export default function ClientHub() {
  const { id } = useParams()
  const [user] = useCurrentUser()
  const canEdit = canEditClientHub(user)
  const [project, setProject] = useState(null)
  const [clients, setClients] = useState([])
  const [todos, setTodos] = useState([])
  const [lib, setLib] = useState([])
  const [meetings, setMeetings] = useState([])
  const [flags, setFlags] = useState([])
  const [attendees, setAttendees] = useState([])
  const [outstanding, setOutstanding] = useState([])
  const [err, setErr] = useState(null)
  const [newClient, setNewClient] = useState('')
  const [todoDraft, setTodoDraft] = useState({})
  const [libSave, setLibSave] = useState({})
  const [newLib, setNewLib] = useState('')
  const [showLib, setShowLib] = useState(false)
  const [attDraft, setAttDraft] = useState({})
  const [outDraft, setOutDraft] = useState({})

  async function load() {
    const [pr, cl, td, lb, mt, fl, at, os] = await Promise.all([
      supabase.from('projects').select('id,name').eq('id', id).single(),
      supabase.from('event_clients').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('client_todos').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('client_task_library').select('*').order('sort_order'),
      supabase.from('client_meetings').select('*').eq('project_id', id),
      supabase.from('scan_flags').select('*').eq('project_id', id).eq('resolved', false).order('scanned_at', { ascending: false }),
      supabase.from('client_attendees').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('client_outstanding').select('*').eq('project_id', id).order('sort_order'),
    ])
    if (pr.data) setProject(pr.data)
    setClients(cl.data || []); setTodos(td.data || []); setLib(lb.data || [])
    setMeetings(mt.data || []); setFlags(fl.data || []); setAttendees(at.data || []); setOutstanding(os.data || [])
  }
  useEffect(() => { load() }, [id])

  const todosFor = cid => todos.filter(t => t.client_id === cid)
  const attFor = cid => attendees.filter(a => a.client_id === cid)
  const outFor = cid => outstanding.filter(o => o.client_id === cid)
  const meetingFor = (cid, type) => meetings.find(m => m.client_id === cid && m.type === type)

  // ---- clients ----
  async function addClient() {
    if (!canEdit) return
    const nm = (newClient || '').trim(); if (!nm) return
    const { data, error } = await supabase.from('event_clients').insert({ project_id: id, name: nm, sort_order: clients.length }).select().single()
    if (error) { setErr(error.message); return }
    const seed = lib.map((r, i) => ({ project_id: id, client_id: data.id, label: r.label, sort_order: i }))
    if (seed.length) await supabase.from('client_todos').insert(seed)
    setNewClient(''); load()
  }
  async function delClient(c) {
    if (!canEdit || !window.confirm('Remove ' + c.name + ' and all their data?')) return
    await supabase.from('client_todos').delete().eq('client_id', c.id)
    await supabase.from('client_meetings').delete().eq('client_id', c.id)
    await supabase.from('client_attendees').delete().eq('client_id', c.id)
    await supabase.from('client_outstanding').delete().eq('client_id', c.id)
    await supabase.from('event_clients').delete().eq('id', c.id); load()
  }
  async function saveSheet(c, url) {
    await supabase.from('event_clients').update({ sheet_url: url || null }).eq('id', c.id)
    setClients(cs => cs.map(x => x.id === c.id ? { ...x, sheet_url: url } : x))
  }
  async function saveContact(c, field, val) {
    await supabase.from('event_clients').update({ [field]: val || null }).eq('id', c.id)
    setClients(cs => cs.map(x => x.id === c.id ? { ...x, [field]: val } : x))
  }

  // ---- meetings ----
  async function setMeeting(c, type, patch) {
    if (!canEdit) return
    const ex = meetingFor(c.id, type) || {}
    await supabase.from('client_meetings').upsert({
      project_id: id, client_id: c.id, type,
      status: patch.status ?? ex.status ?? 'Not Booked',
      meeting_date: patch.meeting_date !== undefined ? (patch.meeting_date || null) : (ex.meeting_date ?? null),
      meeting_time: patch.meeting_time !== undefined ? (patch.meeting_time || null) : (ex.meeting_time ?? null),
      participants: patch.participants !== undefined ? (patch.participants || null) : (ex.participants ?? null),
      notes: patch.notes !== undefined ? patch.notes : (ex.notes ?? ''),
      source: 'manual', updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,type' })
    load()
  }

  // ---- todos + library ----
  async function addTodo(c) {
    if (!canEdit) return
    const t = (todoDraft[c.id] || '').trim(); if (!t) return
    const { error } = await supabase.from('client_todos').insert({ project_id: id, client_id: c.id, label: t, sort_order: todosFor(c.id).length })
    if (error) { setErr(error.message); return }
    if (libSave[c.id]) await supabase.from('client_task_library').upsert({ label: t, sort_order: lib.length }, { onConflict: 'label' })
    setTodoDraft(d => ({ ...d, [c.id]: '' })); setLibSave(v => ({ ...v, [c.id]: false })); load()
  }
  async function addStandardTask(c, label) {
    if (!canEdit || !label) return
    await supabase.from('client_todos').insert({ project_id: id, client_id: c.id, label, sort_order: todosFor(c.id).length }); load()
  }
  async function toggleTodo(t) {
    if (!canEdit) return
    await supabase.from('client_todos').update({ done: !t.done }).eq('id', t.id)
    setTodos(ts => ts.map(x => x.id === t.id ? { ...x, done: !t.done } : x))
  }
  async function delTodo(t) { if (canEdit) { await supabase.from('client_todos').delete().eq('id', t.id); load() } }
  async function addLibItem() {
    if (!canEdit) return
    const l = (newLib || '').trim(); if (!l) return
    await supabase.from('client_task_library').upsert({ label: l, sort_order: lib.length }, { onConflict: 'label' })
    setNewLib(''); load()
  }
  async function delLibItem(item) { if (canEdit) { await supabase.from('client_task_library').delete().eq('id', item.id); load() } }

  // ---- attendees ----
  async function addAttendee(c) {
    if (!canEdit) return
    const raw = (attDraft[c.id] || '').trim(); if (!raw) return
    const [name, email] = raw.split('|').map(s => (s || '').trim())
    await supabase.from('client_attendees').insert({ project_id: id, client_id: c.id, name: name || raw, email: email || null, sort_order: attFor(c.id).length })
    setAttDraft(d => ({ ...d, [c.id]: '' })); load()
  }
  async function delAttendee(a) { if (canEdit) { await supabase.from('client_attendees').delete().eq('id', a.id); load() } }

  // ---- outstanding ----
  async function addOutstanding(c) {
    if (!canEdit) return
    const t = (outDraft[c.id] || '').trim(); if (!t) return
    await supabase.from('client_outstanding').insert({ project_id: id, client_id: c.id, item: t, sort_order: outFor(c.id).length })
    setOutDraft(d => ({ ...d, [c.id]: '' })); load()
  }
  async function toggleOut(o) { if (canEdit) { await supabase.from('client_outstanding').update({ done: !o.done }).eq('id', o.id); setOutstanding(os => os.map(x => x.id === o.id ? { ...x, done: !o.done } : x)) } }
  async function delOut(o) { if (canEdit) { await supabase.from('client_outstanding').delete().eq('id', o.id); load() } }

  const inputStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13 }

  return (
    <div className="wrap sans">
      <div className="crumb"><Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Events</Link></div>
      <h1 style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{project ? project.name : '…'}</h1>
      <div className="sub sans" style={{ marginBottom: 10 }}>Client Hub</div>
      <EventTabs id={id} active="client" />
      {err && <div className="banner sans">{err}</div>}
      {!canEdit && <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#f5f4ef', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 11px', marginBottom: 12 }}>View-only — Nic, Beth, and Christina can edit this hub.</div>}

      {/* Scan findings */}
      {flags.length > 0 && (
        <div className="card sans" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Instrument Sans, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>🔍 Scan findings ({flags.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {flags.map(f => (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: FLAG_BG[f.level] || '#f0fdf4', borderRadius: 8, padding: '9px 12px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: FLAG_COLOR[f.level] || '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 52, paddingTop: 2 }}>{f.level}</span>
                <span style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>{f.text}</span>
                {canEdit && <button className="cmtbtn" onClick={async () => { await supabase.from('scan_flags').update({ resolved: true }).eq('id', f.id); load() }} style={{ fontSize: 11, color: 'var(--muted)' }}>dismiss</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meetings matrix */}
      {clients.length > 0 && (
        <div className="card sans" style={{ marginBottom: 14, padding: 0, overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#f7f6f2' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>Client</th>
                {MTYPES.map(mt => (
                  <th key={mt.id} style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)', verticalAlign: 'top' }}>
                    <div style={{ color: mt.color, fontWeight: 800, fontSize: 12, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{mt.label}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 400, marginTop: 1 }}>Host: {mt.host}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c, ri) => (
                <tr key={c.id}>
                  <td style={{ padding: '14px 16px', verticalAlign: 'top', borderTop: ri ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                    {c.contact_name && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{c.contact_name}</div>}
                  </td>
                  {MTYPES.map(mt => {
                    const m = meetingFor(c.id, mt.id) || {}
                    return (
                      <td key={mt.id} style={{ padding: '14px 16px', verticalAlign: 'top', borderLeft: '1px solid var(--line)', borderTop: ri ? '1px solid var(--line)' : 'none', minWidth: 180 }}>
                        <StatusPill status={m.status} canEdit={canEdit} onChange={v => setMeeting(c, mt.id, { status: v })} />
                        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
                          <EditText date value={m.meeting_date} canEdit={canEdit} placeholder="Set date" onSave={v => setMeeting(c, mt.id, { meeting_date: v })} />
                        </div>
                        <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>
                          <EditText value={m.meeting_time} canEdit={canEdit} placeholder="add time" onSave={v => setMeeting(c, mt.id, { meeting_time: v })} />
                        </div>
                        <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--ink)' }}>
                          <EditText value={m.participants} canEdit={canEdit} placeholder="add participants" onSave={v => setMeeting(c, mt.id, { participants: v })} />
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                          <EditText value={m.notes} canEdit={canEdit} placeholder="notes" onSave={v => setMeeting(c, mt.id, { notes: v })} />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add client */}
      {canEdit && (
        <div className="card sans" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Add a client (e.g. Reachify)" value={newClient} onChange={e => setNewClient(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addClient() }} style={{ flex: 1, ...inputStyle, padding: '9px 11px', fontSize: 14 }} />
          <button className="btn" onClick={addClient}>Add client</button>
        </div>
      )}

      {/* Library manager */}
      {canEdit && (
        <div className="card sans">
          <div onClick={() => setShowLib(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Instrument Sans, sans-serif', fontWeight: 700, fontSize: 15 }}>
            <span>{showLib ? '▾' : '▸'}</span>⭐ Standard client task library ({lib.length})
            <span style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto' }}>Applied to every new client</span>
          </div>
          {showLib && (
            <div style={{ marginTop: 10 }}>
              {lib.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid #eef0f4', fontSize: 13.5 }}>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <button className="cmtbtn" onClick={() => delLibItem(item)} style={{ color: 'var(--red)', fontSize: 12 }}>remove</button>
                </div>
              ))}
              {lib.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 13, padding: '6px 0' }}>Library is empty — add tasks below (run 16-client-task-library.sql to seed defaults).</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input placeholder="Add a standard task to the library…" value={newLib} onChange={e => setNewLib(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLibItem() }} style={{ flex: 1, ...inputStyle }} />
                <button className="btn sm" onClick={addLibItem}>Add to library</button>
              </div>
            </div>
          )}
        </div>
      )}

      {clients.length === 0 && <div className="card sans" style={{ color: 'var(--faint)' }}>No clients yet{canEdit ? ' — add one above.' : '.'}</div>}

      {/* Per-client cards */}
      {clients.map(c => {
        const ct = todosFor(c.id); const doneN = ct.filter(t => t.done).length
        const ca = attFor(c.id); const co = outFor(c.id)
        return (
          <div key={c.id} className="card sans">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Instrument Sans, sans-serif', fontSize: 18, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{doneN}/{ct.length} done</span>
              {c.sheet_url && <a className="pill" href={c.sheet_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>📄 Attendee sheet ↗</a>}
              {canEdit && <button className="btn ghost sm" onClick={() => delClient(c)} style={{ marginLeft: 'auto', color: '#b42318' }}>Remove</button>}
            </div>

            {/* contact */}
            <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '8px 0 2px' }}>
              Primary contact:{' '}
              {canEdit ? (
                <>
                  <input placeholder="name" defaultValue={c.contact_name || ''} onBlur={e => { if (e.target.value !== (c.contact_name || '')) saveContact(c, 'contact_name', e.target.value.trim()) }} style={{ ...inputStyle, fontSize: 12.5, padding: '3px 7px', width: 150 }} />{' '}
                  <input placeholder="email" defaultValue={c.contact_email || ''} onBlur={e => { if (e.target.value !== (c.contact_email || '')) saveContact(c, 'contact_email', e.target.value.trim()) }} style={{ ...inputStyle, fontSize: 12.5, padding: '3px 7px', width: 220 }} />
                </>
              ) : <span>{c.contact_name || '—'}{c.contact_email ? ' · ' + c.contact_email : ''}</span>}
            </div>
            {canEdit && <div style={{ margin: '8px 0' }}><input placeholder="Paste attendee sheet link…" defaultValue={c.sheet_url || ''} onBlur={e => saveSheet(c, e.target.value.trim())} style={{ width: '100%', boxSizing: 'border-box', ...inputStyle, fontSize: 12.5 }} /></div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 8 }}>
              {/* to-dos */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>To-dos</div>
                {ct.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: '1px solid #eef0f4', fontSize: 13.5 }}>
                    <input type="checkbox" checked={t.done} disabled={!canEdit} onChange={() => toggleTodo(t)} style={{ cursor: canEdit ? 'pointer' : 'default' }} />
                    <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--muted)' : 'var(--ink)' }}>{t.label}</span>
                    {canEdit && <button className="cmtbtn" onClick={() => delTodo(t)} style={{ color: 'var(--red)', fontSize: 12 }}>remove</button>}
                  </div>
                ))}
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <input placeholder="Add a to-do…" value={todoDraft[c.id] || ''} onChange={e => setTodoDraft(d => ({ ...d, [c.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addTodo(c) }} style={{ flex: 1, minWidth: 140, ...inputStyle, fontSize: 12.5 }} />
                    <button className="btn sm" onClick={() => addTodo(c)}>Add</button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!libSave[c.id]} onChange={e => setLibSave(v => ({ ...v, [c.id]: e.target.checked }))} />★ library
                    </label>
                    {(() => { const have = new Set(ct.map(t => t.label)); const avail = lib.map(r => r.label).filter(l => !have.has(l)); return avail.length ? (
                      <select value="" onChange={e => { addStandardTask(c, e.target.value); e.target.value = '' }} style={{ ...inputStyle, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}>
                        <option value="">+ standard…</option>
                        {avail.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>) : null })()}
                  </div>
                )}
              </div>

              {/* attendees */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Attendees</div>
                {ca.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: '1px solid #eef0f4', fontSize: 13.5 }}>
                    <span style={{ flex: 1 }}>{a.name}{a.email ? <span style={{ color: 'var(--muted)', fontSize: 12 }}> · {a.email}</span> : ''}</span>
                    {canEdit && <button className="cmtbtn" onClick={() => delAttendee(a)} style={{ color: 'var(--red)', fontSize: 12 }}>remove</button>}
                  </div>
                ))}
                {ca.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12.5, padding: '4px 0' }}>None yet.</div>}
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input placeholder="Name | email" value={attDraft[c.id] || ''} onChange={e => setAttDraft(d => ({ ...d, [c.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addAttendee(c) }} style={{ flex: 1, ...inputStyle, fontSize: 12.5 }} />
                    <button className="btn sm" onClick={() => addAttendee(c)}>Add</button>
                  </div>
                )}
              </div>
            </div>

            {/* outstanding */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b42318', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Outstanding</div>
              {co.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: '1px solid #eef0f4', fontSize: 13.5 }}>
                  <input type="checkbox" checked={o.done} disabled={!canEdit} onChange={() => toggleOut(o)} style={{ cursor: canEdit ? 'pointer' : 'default' }} />
                  <span style={{ flex: 1, textDecoration: o.done ? 'line-through' : 'none', color: o.done ? 'var(--muted)' : 'var(--ink)' }}>{o.item}</span>
                  {canEdit && <button className="cmtbtn" onClick={() => delOut(o)} style={{ color: 'var(--red)', fontSize: 12 }}>remove</button>}
                </div>
              ))}
              {co.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12.5, padding: '4px 0' }}>Nothing outstanding.</div>}
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input placeholder="Add an outstanding item…" value={outDraft[c.id] || ''} onChange={e => setOutDraft(d => ({ ...d, [c.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addOutstanding(c) }} style={{ flex: 1, ...inputStyle, fontSize: 12.5 }} />
                  <button className="btn sm" onClick={() => addOutstanding(c)}>Add</button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
