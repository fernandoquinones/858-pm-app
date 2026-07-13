'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabaseClient'
import { useCurrentUser } from '../../../../lib/useCurrentUser'
import { isMaster } from '../../../../lib/roles'
import { EventTabs } from '../../../../lib/EventTabs'

export default function ClientHub() {
  const { id } = useParams()
  const [user] = useCurrentUser()
  const master = isMaster(user)
  const [project, setProject] = useState(null)
  const [clients, setClients] = useState([])
  const [todos, setTodos] = useState([])
  const [err, setErr] = useState(null)
  const [newClient, setNewClient] = useState('')
  const [todoDraft, setTodoDraft] = useState({})

  async function load() {
    const [pr, cl, td] = await Promise.all([
      supabase.from('projects').select('id,name').eq('id', id).single(),
      supabase.from('event_clients').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('client_todos').select('*').eq('project_id', id).order('sort_order'),
    ])
    if (pr.data) setProject(pr.data)
    setClients(cl.data || []); setTodos(td.data || [])
  }
  useEffect(() => { load() }, [id])

  async function addClient() {
    if (!master) return
    const nm = (newClient || '').trim(); if (!nm) return
    const { error } = await supabase.from('event_clients').insert({ project_id: id, name: nm, sort_order: clients.length })
    if (error) { setErr(error.message); return }
    setNewClient(''); load()
  }
  async function delClient(c) {
    if (!master || !window.confirm('Remove ' + c.name + ' and their to-dos?')) return
    await supabase.from('client_todos').delete().eq('client_id', c.id)
    await supabase.from('event_clients').delete().eq('id', c.id); load()
  }
  async function saveSheet(c, url) {
    await supabase.from('event_clients').update({ sheet_url: url || null }).eq('id', c.id)
    setClients(cs => cs.map(x => x.id === c.id ? { ...x, sheet_url: url } : x))
  }
  async function addTodo(c) {
    if (!master) return
    const t = (todoDraft[c.id] || '').trim(); if (!t) return
    const { error } = await supabase.from('client_todos').insert({ project_id: id, client_id: c.id, label: t, sort_order: todos.filter(x => x.client_id === c.id).length })
    if (error) { setErr(error.message); return }
    setTodoDraft(d => ({ ...d, [c.id]: '' })); load()
  }
  async function toggleTodo(t) {
    await supabase.from('client_todos').update({ done: !t.done }).eq('id', t.id)
    setTodos(ts => ts.map(x => x.id === t.id ? { ...x, done: !t.done } : x))
  }
  async function delTodo(t) { if (master) { await supabase.from('client_todos').delete().eq('id', t.id); load() } }
  const todosFor = cid => todos.filter(t => t.client_id === cid)

  return (
    <div className="wrap sans">
      <div className="crumb"><Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Events</Link></div>
      <h1 style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{project ? project.name : '…'}</h1>
      <div className="sub sans" style={{ marginBottom: 10 }}>Client Hub</div>
      <EventTabs id={id} active="client" />
      {err && <div className="banner sans">{err}</div>}
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Per-client to-do checklists, plus a link to each client’s attendee sheet. (Attendee data lives in the sheet for now.)</div>

      {master && (
        <div className="card sans" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Add a client (e.g. Reachify)" value={newClient} onChange={e => setNewClient(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addClient() }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 14 }} />
          <button className="btn" onClick={addClient}>Add client</button>
        </div>
      )}
      {clients.length === 0 && <div className="card sans" style={{ color: 'var(--faint)' }}>No clients yet{master ? ' — add one above.' : '.'}</div>}

      {clients.map(c => {
        const ct = todosFor(c.id); const doneN = ct.filter(t => t.done).length
        return (
          <div key={c.id} className="card sans">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Instrument Sans, sans-serif', fontSize: 18, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{doneN}/{ct.length} done</span>
              {c.sheet_url && <a className="pill" href={c.sheet_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>📄 Attendee sheet ↗</a>}
              {master && <button className="btn ghost sm" onClick={() => delClient(c)} style={{ marginLeft: 'auto', color: '#b42318' }}>Remove</button>}
            </div>
            {master && <div style={{ margin: '10px 0' }}><input placeholder="Paste attendee sheet link…" defaultValue={c.sheet_url || ''} onBlur={e => saveSheet(c, e.target.value.trim())} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 12.5 }} /></div>}
            <div style={{ marginTop: 6 }}>
              {ct.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #eef0f4', fontSize: 14 }}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t)} style={{ cursor: 'pointer' }} />
                  <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--muted)' : 'var(--ink)' }}>{t.label}</span>
                  {master && <button className="cmtbtn" onClick={() => delTodo(t)} style={{ marginLeft: 'auto', color: 'var(--red)', fontSize: 12 }}>remove</button>}
                </div>
              ))}
              {master && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input placeholder="Add a client to-do…" value={todoDraft[c.id] || ''} onChange={e => setTodoDraft(d => ({ ...d, [c.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addTodo(c) }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13 }} />
                  <button className="btn sm" onClick={() => addTodo(c)}>Add</button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
