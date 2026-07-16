'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabaseClient'
import { useCurrentUser } from '../../../../lib/useCurrentUser'
import { isMaster } from '../../../../lib/roles'
import { EventTabs } from '../../../../lib/EventTabs'

function EditText({ value, onSave, canEdit, placeholder, area, style }) {
  const [editing, setEditing] = useState(false)
  if (canEdit && editing) {
    const common = {
      autoFocus: true, defaultValue: value || '',
      onBlur: e => { const v = e.target.value.trim(); if (v !== (value || '')) onSave(v); setEditing(false) },
      style: { font: 'inherit', width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 7px', ...style },
    }
    return area
      ? <textarea rows={3} {...common} onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} />
      : <input {...common} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false) }} />
  }
  const empty = !value
  if (empty && !canEdit) return <span style={{ color: 'var(--faint)', ...style }}>—</span>
  return <span onClick={() => canEdit && setEditing(true)} style={{ cursor: canEdit ? 'text' : 'default', whiteSpace: area ? 'pre-wrap' : 'normal', ...style }}>
    {empty ? <span style={{ color: 'var(--faint)' }}>{placeholder || '—'}</span> : value}
  </span>
}

const LBL = { fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 3 }
function Field({ label, value, onSave, canEdit, area }) {
  return <div><div style={LBL}>{label}</div><div style={{ fontSize: 13 }}><EditText value={value} onSave={onSave} canEdit={canEdit} area={area} /></div></div>
}

export default function InternalHub() {
  const { id } = useParams()
  const [user] = useCurrentUser()
  const canEdit = isMaster(user)
  const [project, setProject] = useState(null)
  const [team, setTeam] = useState([])
  const [days, setDays] = useState([])
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState([])

  async function load() {
    const [pr, tm, dy, it, nt] = await Promise.all([
      supabase.from('projects').select('id,name').eq('id', id).single(),
      supabase.from('onsite_team').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('ros_days').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('ros_items').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('ros_notes').select('*').eq('project_id', id).order('sort_order'),
    ])
    if (pr.data) setProject(pr.data)
    setTeam(tm.data || []); setDays(dy.data || []); setItems(it.data || []); setNotes(nt.data || [])
  }
  useEffect(() => { load() }, [id])
  const itemsFor = did => items.filter(x => x.day_id === did)

  // onsite team
  async function addPerson() { if (!canEdit) return; await supabase.from('onsite_team').insert({ project_id: id, name: 'New person', emoji: '🙂', sort_order: team.length }); load() }
  async function updPerson(p, f, v) { await supabase.from('onsite_team').update({ [f]: v || null }).eq('id', p.id); setTeam(t => t.map(x => x.id === p.id ? { ...x, [f]: v } : x)) }
  async function delPerson(p) { if (canEdit && window.confirm('Remove ' + p.name + '?')) { await supabase.from('onsite_team').delete().eq('id', p.id); load() } }
  // run of show
  async function addDay() { if (!canEdit) return; await supabase.from('ros_days').insert({ project_id: id, label: 'New day', color: '#5F6368', sort_order: days.length }); load() }
  async function updDay(d, f, v) { await supabase.from('ros_days').update({ [f]: v || null }).eq('id', d.id); setDays(ds => ds.map(x => x.id === d.id ? { ...x, [f]: v } : x)) }
  async function delDay(d) { if (canEdit && window.confirm('Remove ' + (d.label || 'this day') + ' and its items?')) { await supabase.from('ros_items').delete().eq('day_id', d.id); await supabase.from('ros_days').delete().eq('id', d.id); load() } }
  async function addItem(d) { if (!canEdit) return; await supabase.from('ros_items').insert({ project_id: id, day_id: d.id, title: 'New item', sort_order: itemsFor(d.id).length }); load() }
  async function updItem(it, f, v) { await supabase.from('ros_items').update({ [f]: v || null }).eq('id', it.id); setItems(xs => xs.map(x => x.id === it.id ? { ...x, [f]: v } : x)) }
  async function delItem(it) { if (canEdit) { await supabase.from('ros_items').delete().eq('id', it.id); load() } }
  // notes
  async function addNote() { if (!canEdit) return; await supabase.from('ros_notes').insert({ project_id: id, label: 'New', note: '', sort_order: notes.length }); load() }
  async function updNote(n, f, v) { await supabase.from('ros_notes').update({ [f]: v || null }).eq('id', n.id); setNotes(ns => ns.map(x => x.id === n.id ? { ...x, [f]: v } : x)) }
  async function delNote(n) { if (canEdit) { await supabase.from('ros_notes').delete().eq('id', n.id); load() } }

  const H = { fontFamily: 'Instrument Sans, sans-serif', fontWeight: 700, fontSize: 16 }

  return (
    <div className="wrap sans">
      <div className="crumb"><Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Events</Link></div>
      <h1 style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{project ? project.name : '…'}</h1>
      <div className="sub sans" style={{ marginBottom: 10 }}>Internal Hub</div>
      <EventTabs id={id} active="internal" />
      {!canEdit && <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#f5f4ef', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 11px', margin: '12px 0' }}>View-only — only Fernando and Christina can edit this hub.</div>}

      {/* Onsite Team */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' }}>
        <span style={H}>👥 Onsite Team</span>
        {canEdit && <button className="btn sm" onClick={addPerson}>+ Add person</button>}
      </div>
      {team.length === 0 && <div className="card sans" style={{ color: 'var(--faint)' }}>No onsite team yet.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {team.map(p => (
          <div key={p.id} className="card sans">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{p.emoji || '🙂'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}><EditText value={p.name} canEdit={canEdit} onSave={v => updPerson(p, 'name', v)} /></div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}><EditText value={p.role} canEdit={canEdit} placeholder="role" onSave={v => updPerson(p, 'role', v)} /></div>
              </div>
              {canEdit && <button className="cmtbtn" onClick={() => delPerson(p)} style={{ color: 'var(--red)', fontSize: 12 }}>remove</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><Field label="Email" value={p.email} canEdit={canEdit} onSave={v => updPerson(p, 'email', v)} /></div>
              <Field label="Hotel" value={p.hotel} canEdit={canEdit} onSave={v => updPerson(p, 'hotel', v)} />
              <Field label="Confirmation #" value={p.confirmation_number} canEdit={canEdit} onSave={v => updPerson(p, 'confirmation_number', v)} />
              <Field label="Check-in" value={p.check_in} canEdit={canEdit} onSave={v => updPerson(p, 'check_in', v)} />
              <Field label="Check-out" value={p.check_out} canEdit={canEdit} onSave={v => updPerson(p, 'check_out', v)} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '.05em' }}>✈️ Inbound</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 5 }}>
              <Field label="Date" value={p.flight_in_date} canEdit={canEdit} onSave={v => updPerson(p, 'flight_in_date', v)} />
              <Field label="Route" value={p.flight_in_from} canEdit={canEdit} onSave={v => updPerson(p, 'flight_in_from', v)} />
              <Field label="Time" value={p.flight_in_time} canEdit={canEdit} onSave={v => updPerson(p, 'flight_in_time', v)} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '.05em' }}>✈️ Outbound</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 5 }}>
              <Field label="Date" value={p.flight_out_date} canEdit={canEdit} onSave={v => updPerson(p, 'flight_out_date', v)} />
              <Field label="Route" value={p.flight_out_to} canEdit={canEdit} onSave={v => updPerson(p, 'flight_out_to', v)} />
              <Field label="Time" value={p.flight_out_time} canEdit={canEdit} onSave={v => updPerson(p, 'flight_out_time', v)} />
            </div>
            <div style={{ marginTop: 12 }}><Field label="Notes" value={p.notes} canEdit={canEdit} area onSave={v => updPerson(p, 'notes', v)} /></div>
          </div>
        ))}
      </div>

      {/* Run of Show */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 0 10px' }}>
        <span style={H}>🗓️ Run of Show</span>
        {canEdit && <button className="btn sm" onClick={addDay}>+ Add day</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {days.map(d => (
          <div key={d.id} className="card sans" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: d.color || '#5F6368', padding: '12px 14px' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}><EditText value={d.label} canEdit={canEdit} onSave={v => updDay(d, 'label', v)} style={{ color: '#fff' }} /></div>
              <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 11 }}><EditText value={d.day_date} canEdit={canEdit} placeholder="date" onSave={v => updDay(d, 'day_date', v)} style={{ color: 'rgba(255,255,255,.9)' }} /></div>
            </div>
            <div style={{ padding: '4px 14px 10px' }}>
              {itemsFor(d.id).map(it => (
                <div key={it.id} style={{ padding: '10px 0', borderTop: '1px solid #eef0f4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: d.color || '#5F6368' }}><EditText value={it.time} canEdit={canEdit} placeholder="time" onSave={v => updItem(it, 'time', v)} style={{ color: d.color || '#5F6368' }} /></span>
                    {canEdit && <button className="cmtbtn" onClick={() => delItem(it)} style={{ color: 'var(--red)', fontSize: 11 }}>✕</button>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}><EditText value={it.title} canEdit={canEdit} onSave={v => updItem(it, 'title', v)} /></div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}><EditText value={it.notes} canEdit={canEdit} placeholder={canEdit ? 'notes' : ''} area onSave={v => updItem(it, 'notes', v)} /></div>
                </div>
              ))}
              {canEdit && <button className="btn ghost sm" onClick={() => addItem(d)} style={{ marginTop: 10 }}>+ Add item</button>}
              {canEdit && <button className="cmtbtn" onClick={() => delDay(d)} style={{ color: 'var(--red)', fontSize: 11, marginLeft: 10 }}>remove day</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Notes & Open Items */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 0 10px' }}>
        <span style={H}>🗒️ Notes &amp; Open Items</span>
        {canEdit && <button className="btn sm" onClick={addNote}>+ Add note</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {notes.map(n => (
          <div key={n.id} className="card sans">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ ...LBL, marginBottom: 0 }}><EditText value={n.label} canEdit={canEdit} onSave={v => updNote(n, 'label', v)} style={LBL} /></span>
              {canEdit && <button className="cmtbtn" onClick={() => delNote(n)} style={{ color: 'var(--red)', fontSize: 11 }}>remove</button>}
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}><EditText value={n.note} canEdit={canEdit} area placeholder="note…" onSave={v => updNote(n, 'note', v)} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
