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
const H = { fontFamily: 'Instrument Sans, sans-serif', fontWeight: 700, fontSize: 16 }
const secHead = (title, onAdd, canEdit) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 10px' }}>
    <span style={H}>{title}</span>
    {canEdit && onAdd && <button className="btn sm" onClick={onAdd}>+ Add</button>}
  </div>
)

export default function InternalHub() {
  const { id } = useParams()
  const [user] = useCurrentUser()
  const canEdit = isMaster(user)
  const [project, setProject] = useState(null)
  const [team, setTeam] = useState([])
  const [days, setDays] = useState([])
  const [items, setItems] = useState([])
  const [blocks, setBlocks] = useState([])

  async function load() {
    const [pr, tm, dy, it, bl] = await Promise.all([
      supabase.from('projects').select('id,name').eq('id', id).single(),
      supabase.from('onsite_team').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('ros_days').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('ros_items').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('internal_blocks').select('*').eq('project_id', id).order('sort_order'),
    ])
    if (pr.data) setProject(pr.data)
    setTeam(tm.data || []); setDays(dy.data || []); setItems(it.data || []); setBlocks(bl.data || [])
  }
  useEffect(() => { load() }, [id])
  const itemsFor = did => items.filter(x => x.day_id === did)
  const blocksOf = sec => blocks.filter(b => b.section === sec)

  // blocks
  async function addBlock(section, withLabel) { if (!canEdit) return; await supabase.from('internal_blocks').insert({ project_id: id, section, label: withLabel ? '' : null, value: '', sort_order: blocksOf(section).length }); load() }
  async function updBlock(b, f, v) { await supabase.from('internal_blocks').update({ [f]: v || null }).eq('id', b.id); setBlocks(bs => bs.map(x => x.id === b.id ? { ...x, [f]: v } : x)) }
  async function delBlock(b) { if (canEdit) { await supabase.from('internal_blocks').delete().eq('id', b.id); load() } }
  // team
  async function addPerson() { if (!canEdit) return; await supabase.from('onsite_team').insert({ project_id: id, name: 'New person', emoji: '🙂', sort_order: team.length }); load() }
  async function updPerson(p, f, v) { await supabase.from('onsite_team').update({ [f]: v || null }).eq('id', p.id); setTeam(t => t.map(x => x.id === p.id ? { ...x, [f]: v } : x)) }
  async function delPerson(p) { if (canEdit && window.confirm('Remove ' + p.name + '?')) { await supabase.from('onsite_team').delete().eq('id', p.id); load() } }
  // run of show
  async function addDay() { if (!canEdit) return; await supabase.from('ros_days').insert({ project_id: id, label: 'New day', color: '#5F6368', sort_order: days.length }); load() }
  async function updDay(d, f, v) { await supabase.from('ros_days').update({ [f]: v || null }).eq('id', d.id); setDays(ds => ds.map(x => x.id === d.id ? { ...x, [f]: v } : x)) }
  async function delDay(d) { if (canEdit && window.confirm('Remove ' + (d.label || 'this day') + ' and its items?')) { await supabase.from('ros_items').delete().eq('day_id', d.id); await supabase.from('ros_days').delete().eq('id', d.id); load() } }
  async function addItem(d) { if (!canEdit) return; await supabase.from('ros_items').insert({ project_id: id, day_id: d.id, title: 'New item', sort_order: itemsFor(d.id).length }); load() }
  async function updItem(it, f, v) { await supabase.from('ros_items').update({ [f]: v || null }).eq('id', it.id); setItems(xs => xs.map(x => x.id === it.id ? { ...x, [f]: v } : x)) }
  async function toggleFlag(it) { if (!canEdit) return; await supabase.from('ros_items').update({ flag: !it.flag }).eq('id', it.id); setItems(xs => xs.map(x => x.id === it.id ? { ...x, flag: !it.flag } : x)) }
  async function delItem(it) { if (canEdit) { await supabase.from('ros_items').delete().eq('id', it.id); load() } }

  const meta = blocksOf('meta')[0]

  const bulletList = (section, color) => (
    <>
      {blocksOf(section).map(b => (
        <div key={b.id} className="card sans" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', marginBottom: 8, borderLeft: color ? '3px solid ' + color : undefined }}>
          {color && <span style={{ color, fontWeight: 700, flexShrink: 0 }}>⚠</span>}
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}><EditText value={b.value} canEdit={canEdit} area onSave={v => updBlock(b, 'value', v)} /></div>
          {canEdit && <button className="cmtbtn" onClick={() => delBlock(b)} style={{ color: 'var(--red)', fontSize: 11 }}>remove</button>}
        </div>
      ))}
    </>
  )

  return (
    <div className="wrap sans">
      <div className="crumb"><Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Events</Link></div>
      <h1 style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{project ? project.name : '…'}</h1>
      <div className="sub sans" style={{ marginBottom: 6 }}>Internal Hub · Run of Show</div>
      {(meta || canEdit) && <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>
        <EditText value={meta ? meta.value : ''} canEdit={canEdit} area placeholder={canEdit ? 'add a version/subtitle note' : ''} onSave={v => meta ? updBlock(meta, 'value', v) : supabase.from('internal_blocks').insert({ project_id: id, section: 'meta', value: v, sort_order: 0 }).then(load)} />
      </div>}
      <EventTabs id={id} active="internal" />
      {!canEdit && <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#f5f4ef', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 11px', margin: '12px 0' }}>View-only — only Fernando and Christina can edit this hub.</div>}

      {secHead('⚠ Flags to Confirm', () => addBlock('flags'), canEdit)}
      {bulletList('flags', '#B45309')}

      {secHead('🗒️ Key Notes', () => addBlock('keynotes'), canEdit)}
      {bulletList('keynotes')}

      {secHead('👤 Roles & Responsibilities', () => addBlock('roles', true), canEdit)}
      {blocksOf('roles').map(b => (
        <div key={b.id} className="card sans" style={{ padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, fontFamily: 'Instrument Sans, sans-serif' }}><EditText value={b.label} canEdit={canEdit} placeholder="person" onSave={v => updBlock(b, 'label', v)} /></span>
            {canEdit && <button className="cmtbtn" onClick={() => delBlock(b)} style={{ color: 'var(--red)', fontSize: 11 }}>remove</button>}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}><EditText value={b.value} canEdit={canEdit} area onSave={v => updBlock(b, 'value', v)} /></div>
        </div>
      ))}

      {secHead('🤝 VIP Dinner & Lunch Intro Strategy', () => addBlock('vip_strategy'), canEdit)}
      {bulletList('vip_strategy')}

      {/* Run of Show */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 10px' }}>
        <span style={H}>🗓️ Run of Show</span>
        {canEdit && <button className="btn sm" onClick={addDay}>+ Add day</button>}
      </div>
      {days.map(d => (
        <div key={d.id} className="card sans" style={{ padding: 0, overflow: 'hidden', marginBottom: 12, borderLeft: '4px solid ' + (d.color || '#5F6368') }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: d.color || 'var(--ink)' }}><EditText value={d.label} canEdit={canEdit} onSave={v => updDay(d, 'label', v)} style={{ color: d.color || 'var(--ink)' }} /></span>
            {canEdit && <span style={{ display: 'flex', gap: 10 }}><button className="btn ghost sm" onClick={() => addItem(d)}>+ item</button><button className="cmtbtn" onClick={() => delDay(d)} style={{ color: 'var(--red)', fontSize: 11 }}>remove day</button></span>}
          </div>
          <div>
            {itemsFor(d.id).map(it => (
              <div key={it.id} style={{ display: 'flex', gap: 14, padding: '11px 16px', borderTop: '1px solid #eef0f4', alignItems: 'flex-start' }}>
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: d.color || 'var(--ink)' }}><EditText value={it.time} canEdit={canEdit} placeholder="time" onSave={v => updItem(it, 'time', v)} style={{ color: d.color || 'var(--ink)' }} /></div>
                  <div style={{ fontSize: 11, color: 'var(--faint)' }}><EditText value={it.duration} canEdit={canEdit} placeholder={canEdit ? 'dur.' : ''} onSave={v => updItem(it, 'duration', v)} /></div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {it.flag && <span style={{ color: '#B45309', marginRight: 5 }}>⚠</span>}
                    <EditText value={it.title} canEdit={canEdit} onSave={v => updItem(it, 'title', v)} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}><EditText value={it.notes} canEdit={canEdit} area placeholder={canEdit ? 'notes' : ''} onSave={v => updItem(it, 'notes', v)} /></div>
                </div>
                {canEdit && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                  <button className="cmtbtn" onClick={() => toggleFlag(it)} style={{ color: it.flag ? '#B45309' : 'var(--faint)', fontSize: 11 }}>{it.flag ? 'unflag' : 'flag'}</button>
                  <button className="cmtbtn" onClick={() => delItem(it)} style={{ color: 'var(--red)', fontSize: 11 }}>✕</button>
                </div>}
              </div>
            ))}
          </div>
          {(d.footnote || canEdit) && <div style={{ padding: '10px 16px', borderTop: '1px solid #eef0f4', background: '#faf9f5', fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
            <EditText value={d.footnote} canEdit={canEdit} area placeholder={canEdit ? 'add a day footnote' : ''} onSave={v => updDay(d, 'footnote', v)} />
          </div>}
        </div>
      ))}

      {/* Onsite Team */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 10px' }}>
        <span style={H}>✈️ Onsite Team & Travel</span>
        {canEdit && <button className="btn sm" onClick={addPerson}>+ Add person</button>}
      </div>
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
    </div>
  )
}
