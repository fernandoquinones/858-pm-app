'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import { PEOPLE, canEditSeating, roleOf } from '../../../../lib/roles'
import { useCurrentUser } from '../../../../lib/useCurrentUser'

function initials(n) { return (n || '?').split(' ').map(x => x[0]).slice(0, 2).join('') }

export default function Seating() {
  const { id } = useParams()
  const [user, setUser] = useCurrentUser()
  const canEdit = canEditSeating(user)

  const [tables, setTables] = useState([])
  const [guests, setGuests] = useState([])
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [tb, gs] = await Promise.all([
      supabase.from('seating_tables').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('guests').select('*').eq('project_id', id).order('sort_order')
    ])
    setTables(tb.data || [])
    setGuests(gs.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('seat-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seating_tables' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  const confirmed = guests.filter(g => g.status === 'confirmed')
  const waitlist = guests.filter(g => g.status === 'waitlist')
  const seatedCount = confirmed.filter(g => g.table_id).length
  const capTotal = tables.reduce((a, t) => a + (t.capacity || 0), 0)

  async function moveGuest(guestId, tableId) {
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, table_id: tableId, status: 'confirmed' } : g))
    await supabase.from('guests').update({ table_id: tableId, status: 'confirmed' }).eq('id', guestId)
  }
  async function swap(aId, bId) {
    const a = guests.find(g => g.id === aId), b = guests.find(g => g.id === bId)
    if (!a || !b) return
    await Promise.all([
      supabase.from('guests').update({ table_id: b.table_id }).eq('id', a.id),
      supabase.from('guests').update({ table_id: a.table_id }).eq('id', b.id)
    ])
    load()
  }

  function clickSeatedGuest(g) {
    if (!canEdit) return
    if (!selected) { setSelected({ kind: 'guest', id: g.id }); setNote(`Selected ${g.name} — click an open seat or another guest.`); return }
    if (selected.kind === 'guest' && selected.id === g.id) { setSelected(null); setNote(''); return }
    if (selected.kind === 'guest') {
      const a = guests.find(x => x.id === selected.id)
      swap(selected.id, g.id); setNote(`Swapped ${a?.name} ↔ ${g.name}.`); setSelected(null); return
    }
    if (selected.kind === 'waitlist') { moveGuest(selected.id, g.table_id); setNote('Seated from waitlist.'); setSelected(null) }
  }
  function clickEmpty(tableId) {
    if (!canEdit) return
    if (!selected) { setNote('Select a guest first, then click an open seat.'); return }
    const who = guests.find(x => x.id === selected.id)
    moveGuest(selected.id, tableId)
    setNote(`Moved ${who?.name} ${selected.kind === 'waitlist' ? '(from waitlist) ' : ''}to a seat.`)
    setSelected(null)
  }
  async function noShow(g) {
    if (!canEdit) return
    setNote(`${g.name} marked no-show — seat freed.`)
    await supabase.from('guests').update({ status: 'noshow', table_id: null }).eq('id', g.id)
  }

  if (loading) return <div className="wrap"><div className="loading sans">Loading seating…</div></div>

  return (
    <div className="wrap">
      <div className="crumb sans"><Link href={`/project/${id}`}>← Project plan</Link></div>
      <div className="topbar">
        <div>
          <h1>Seating</h1>
          <div className="sub sans">{seatedCount}/{capTotal} seated · {tables.length} tables</div>
        </div>
        <div className="chips sans">
          <div className="chip"><span className="dot"></span> Live · synced</div>
          <label className="chip" style={{ gap: 6 }}>Acting as
            <select value={user} onChange={e => setUser(e.target.value)} style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>
              {PEOPLE.map(p => <option key={p.name} value={p.name}>{p.name} ({p.role})</option>)}
            </select>
          </label>
        </div>
      </div>

      {canEdit ? (
        <div className="banner sans" style={{ background: '#E1F5EE', borderColor: '#5DCAA5', color: '#0F6E56' }}>
          You can build this seating chart — assign seats, swap, mark no-shows, seat from the waitlist.
        </div>
      ) : (
        <div className="banner sans" style={{ background: '#E7F0FA', borderColor: '#9DC2E5', color: '#15263C' }}>
          View only — the seating chart is built by JG (and Christina/Fern). Switch &ldquo;Acting as&rdquo; to JG to edit.
        </div>
      )}

      <div className="panel">
        <h2>Seating board <span className="meta sans">{canEdit ? 'click a guest, then an open seat to move · hover to mark no-show' : 'read-only'}</span></h2>
        <div className="pad">
          {canEdit && <div className="selnote sans">{note || 'Click a guest, then an open seat to move them. Hover a guest to mark a no-show.'}</div>}
          <div className="tables">
            {tables.map(t => {
              const occ = confirmed.filter(g => g.table_id === t.id)
              const empties = Math.max(0, (t.capacity || 0) - occ.length)
              return (
                <div className={`tbl ${t.is_host ? 'host' : ''}`} key={t.id}>
                  <div className="th"><span className="name">{t.name}</span><span className="cap sans">{occ.length}/{t.capacity}</span></div>
                  {occ.map(g => (
                    <div key={g.id} className={`seat ${selected && selected.id === g.id ? 'sel' : ''} ${canEdit ? '' : 'ro'}`} onClick={() => clickSeatedGuest(g)}>
                      <span className={`av gav ${g.tier === 1 ? 't1' : g.tier === 2 ? 't2' : 't0'}`}>{initials(g.name)}</span>
                      <div className="ginfo">
                        <div className="gn">{g.name} {g.tier ? <span className={`tp t${g.tier}`}>T{g.tier}</span> : null}</div>
                        <div className="gc">{g.company}</div>
                      </div>
                      {canEdit && <span className="noshow sans" onClick={(e) => { e.stopPropagation(); noShow(g) }}>no-show ✕</span>}
                    </div>
                  ))}
                  {Array.from({ length: empties }).map((_, i) => (
                    <div key={'e' + i} className={`seat empty ${canEdit ? '' : 'ro'}`} onClick={() => clickEmpty(t.id)}>+ open seat</div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {(waitlist.length > 0 || canEdit) && (
        <div className="panel">
          <h2>Waitlist <span className="meta sans">{canEdit ? 'click one, then an open seat to seat them' : 'read-only'}</span></h2>
          <div className="pad">
            {waitlist.length === 0 ? <span className="sans" style={{ color: 'var(--faint)', fontSize: 12 }}>No one on the waitlist.</span> : (
              <div className="waitlist">
                {waitlist.map(g => (
                  <div key={g.id} className={`wl sans ${selected && selected.id === g.id ? 'sel' : ''} ${canEdit ? '' : 'ro'}`}
                    onClick={() => { if (!canEdit) return; setSelected({ kind: 'waitlist', id: g.id }); setNote(`Selected ${g.name} from waitlist — click an open seat.`) }}>
                    <span className={`av gav ${g.tier === 1 ? 't1' : g.tier === 2 ? 't2' : 't0'}`}>{initials(g.name)}</span>
                    <span>{g.name} <span style={{ color: 'var(--faint)' }}>· {g.company}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
