'use client'
import { useState } from 'react'

const COLOR = { overdue: '#E24B4A', upcoming: '#185FA5', event: '#534AB7', post: '#888780' }
const STAT = {
  overdue: { label: 'Overdue', color: '#A32D2D', bg: '#FCEBEB' },
  upcoming: { label: 'Upcoming', color: '#0C447C', bg: '#E6F1FB' },
  event: { label: 'Event', color: '#3C3489', bg: '#EEEDFE' },
  post: { label: 'Post-event', color: '#5F5E5A', bg: '#F1EFE8' },
}
const fmt = ymd => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) }
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

// Live "open task timeline" — populated by To-do + In progress tasks that have a due date.
export function TaskTimeline({ tasks = [], eventDate = '', eventEndDate = '', eventName = '' }) {
  const [active, setActive] = useState(null)
  const [hover, setHover] = useState(null)
  const today = todayStr()

  const open = tasks.filter(t => (t.status === 'todo' || t.status === 'prog') && t.due_date)
  const cat = due => {
    const end = eventEndDate || eventDate
    if (due < today) return 'overdue'
    if (eventDate && due >= eventDate && due <= end) return 'event'
    if (eventDate && due > end) return 'post'
    return 'upcoming'
  }
  const map = {}
  open.forEach(t => { (map[t.due_date] = map[t.due_date] || []).push(t.title) })
  const buckets = Object.keys(map).sort().map(d => ({ date: d, type: cat(d), tasks: map[d] }))
  const counts = { overdue: 0, upcoming: 0, event: 0, post: 0 }
  buckets.forEach(b => { counts[b.type] += b.tasks.length })
  const total = buckets.reduce((s, b) => s + b.tasks.length, 0)
  const maxC = Math.max(1, ...buckets.map(b => b.tasks.length))

  const items = []; let inserted = false
  buckets.forEach(b => { if (!inserted && b.date >= today) { items.push({ today: true }); inserted = true } items.push(b) })
  if (!inserted) items.push({ today: true })

  return (
    <div style={{ fontFamily: 'inherit' }}>
      <div style={{ marginBottom: 14 }}>
        <div className="subh" style={{ margin: 0 }}>🕒 Open task timeline <span style={{ color: 'var(--faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· live</span></div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{eventName ? eventName + ' — ' : ''}to-do + in progress · today {fmt(today)}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {['overdue', 'upcoming', 'event', 'post'].map(k => (
          <div key={k} style={{ background: STAT[k].bg, borderRadius: 10, padding: '10px 14px', minWidth: 96 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: STAT[k].color, textTransform: 'uppercase', letterSpacing: '.05em' }}>{STAT[k].label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: STAT[k].color }}>{counts[k]}</div>
          </div>
        ))}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', minWidth: 96 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total open</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>{total}</div>
        </div>
      </div>

      {total === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--faint)', padding: '10px 0' }}>No open (to-do / in progress) tasks with due dates.</div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minHeight: 210, padding: '18px 4px 0' }}>
            {items.map((b, i) => b.today ? (
              <div key={'t' + i} style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minWidth: 8 }}>
                <div style={{ flex: 1, borderLeft: '2px dashed #E24B4A', width: 0 }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#E24B4A', transform: 'rotate(-40deg)', transformOrigin: 'top center', marginTop: 8, whiteSpace: 'nowrap' }}>today</span>
              </div>
            ) : (
              <div key={b.date} onMouseEnter={() => setHover(b.date)} onMouseLeave={() => setHover(null)}
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minWidth: 30, opacity: active && active !== b.type ? 0.25 : 1 }}>
                {hover === b.date && (
                  <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, background: '#fff', border: '1px solid #e5e4e0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', width: 210, zIndex: 5, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLOR[b.type], marginBottom: 4 }}>{fmt(b.date)} · {b.tasks.length} task{b.tasks.length !== 1 ? 's' : ''}</div>
                    {b.tasks.map((t, k) => <div key={k} style={{ fontSize: 10.5, color: '#5F5E5A', lineHeight: 1.35, margin: '2px 0' }}>· {t}</div>)}
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: COLOR[b.type], marginBottom: 3 }}>{b.tasks.length}</div>
                <div style={{ width: 22, height: Math.round(b.tasks.length / maxC * 150) + 4, background: COLOR[b.type], borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontSize: 9.5, color: '#5F5E5A', transform: 'rotate(-40deg)', transformOrigin: 'top center', marginTop: 10, whiteSpace: 'nowrap' }}>{fmt(b.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {['overdue', 'upcoming', 'event', 'post'].map(k => (
          <button key={k} onClick={() => setActive(active === k ? null : k)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', opacity: active === null || active === k ? 1 : 0.4, fontFamily: 'inherit' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLOR[k] }} />
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{STAT[k].label}</span>
          </button>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px' }}>
          <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#E24B4A" strokeWidth="2" strokeDasharray="5,3" /></svg>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>today</span>
        </span>
      </div>
    </div>
  )
}
