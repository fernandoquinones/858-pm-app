'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, BASE_ACTIVATIONS, parseActs } from '../lib/supabaseClient'
import { PEOPLE, isMaster, roleOf } from '../lib/roles'
import { AuthBar } from '../lib/AuthBar'
import { useCurrentUser } from '../lib/useCurrentUser'
import { ActivationChips } from '../lib/ActivationChips'

export default function Home() {
  const router = useRouter()
  const [user, setUser, authed] = useCurrentUser()
  const master = isMaster(user)

  const [projects, setProjects] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [actOpts, setActOpts] = useState(BASE_ACTIVATIONS)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [slackMsg, setSlackMsg] = useState(null)

  // structured create
  const [evName, setEvName] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evEnd, setEvEnd] = useState('')
  const [evVenue, setEvVenue] = useState('')
  const [evCity, setEvCity] = useState('')
  const [evState, setEvState] = useState('')
  const [venueDraft, setVenueDraft] = useState({})
  const [evActs, setEvActs] = useState([])
  const [creating, setCreating] = useState(false)

  // optional Claude box
  const [prompt, setPrompt] = useState('858 LA Holiday Party — evening reception, ~80 guests, Dec 12.')
  const [gen, setGen] = useState(false)
  const [eventFilter, setEventFilter] = useState('current')

  async function load() {
    const [pr, lib, tk] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('library_tasks').select('applies_to'),
      supabase.from('tasks').select('status,due_date,project_id')
    ])
    if (pr.error) setErr(pr.error.message); else setProjects(pr.data || [])
    setAllTasks(tk.data || [])
    const found = new Set(BASE_ACTIVATIONS)
    ;(lib.data || []).forEach(r => parseActs(r.applies_to).forEach(a => { if (a !== 'All events') found.add(a) }))
    setActOpts([...found])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function createEvent() {
    if (!evName.trim()) { setErr('Give the event a name.'); return }
    if (!evDate) { setErr('Pick an event date.'); return }
    if (!evCity.trim()) { setErr('Add a city.'); return }
    if (!evState.trim()) { setErr('Add a state.'); return }
    setCreating(true); setErr(null)
    try {
      const r = await fetch('/api/create-event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: evName, date: evDate || null, endDate: evEnd || null, venue: evVenue || null, city: evCity || null, state: evState || null, activations: evActs }) })
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Could not create event'); setCreating(false); return }
      router.push(`/project/${j.projectId}`)
    } catch (e) { setErr(String(e)); setCreating(false) }
  }

  async function generate() {
    if (!prompt.trim()) { setErr('Describe the event first.'); return }
    if (!evDate) { setErr('Pick an event date.'); return }
    if (!evCity.trim()) { setErr('Add a city.'); return }
    if (!evState.trim()) { setErr('Add a state.'); return }
    setGen(true); setErr(null)
    try {
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, date: evDate || null, endDate: evEnd || null, venue: evVenue || null, city: evCity || null, state: evState || null }) })
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Generation failed'); setGen(false); return }
      router.push(`/project/${j.projectId}`)
    } catch (e) { setErr(String(e)); setGen(false) }
  }

  function isPastEvent(p) {
    if (!p.event_date) return false
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - 1)
    return new Date(p.event_date + 'T00:00:00') < cutoff
  }
  function eventTime(p) { return p.event_date ? new Date(p.event_date + 'T00:00:00').getTime() : Infinity }
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const fmtRange = (s, e) => {
    if (!s) return ''
    if (!e || e === s) return fmtDate(s)
    const ds = new Date(s + 'T00:00:00'), de = new Date(e + 'T00:00:00'), o = { month: 'short', day: 'numeric' }
    if (ds.getFullYear() === de.getFullYear() && ds.getMonth() === de.getMonth()) return ds.toLocaleDateString('en-US', o) + '\u2013' + de.getDate() + ', ' + ds.getFullYear()
    if (ds.getFullYear() === de.getFullYear()) return ds.toLocaleDateString('en-US', o) + ' \u2013 ' + de.toLocaleDateString('en-US', o) + ', ' + ds.getFullYear()
    return fmtDate(s) + ' \u2013 ' + fmtDate(e)
  }
  const cityState = (p) => [p.city, p.state].filter(Boolean).join(', ')
  async function saveVenue(p) {
    const v = venueDraft[p.id]; if (v === undefined) return
    const { error } = await supabase.from('projects').update({ venue: v || null }).eq('id', p.id)
    if (error) setErr('Update venue failed: ' + error.message)
    else setProjects(ps => ps.map(x => x.id === p.id ? { ...x, venue: v || null } : x))
  }
  async function pushSlack(kind) {
    setSlackMsg('Sending…')
    try {
      const url = kind === 'remind' ? '/api/slack/remind' : '/api/slack/digest'
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'remind' ? {} : { type: kind }) })
      const j = await r.json()
      if (j.skipped) setSlackMsg('Slack not configured yet — ' + j.skipped)
      else { const delivered = (j.sent || []).filter(x => x.ok).length; setSlackMsg('Sent · ' + (j.taskCount ?? 0) + ' task(s) in window · ' + delivered + ' DM(s) delivered') }
    } catch (e) { setSlackMsg('Error: ' + e) }
    setTimeout(() => setSlackMsg(null), 7000)
  }
  const shownProjects = projects
    .filter(p => eventFilter === 'current' ? !isPastEvent(p) : isPastEvent(p))
    .sort((a, b) => eventFilter === 'current' ? eventTime(a) - eventTime(b) : eventTime(b) - eventTime(a))
  const currentIds = new Set(projects.filter(p => !isPastEvent(p)).map(p => p.id))
  const openTasks = allTasks.filter(t => currentIds.has(t.project_id) && t.status !== 'done')
  const _todayMid = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()
  const overdueCount = openTasks.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00') < _todayMid).length

  async function deleteEvent(e, p) {
    e.preventDefault(); e.stopPropagation()
    if (!master) return
    if (!window.confirm('Delete \u201c' + p.name + '\u201d and all of its tasks, comments and attachments? This cannot be undone.')) return
    const { error } = await supabase.from('projects').delete().eq('id', p.id)
    if (error) { setErr('Delete failed: ' + error.message); return }
    setProjects(ps => ps.filter(x => x.id !== p.id))
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.svg" alt="858" style={{ height: 30 }} />
          <div>
            <h1>Project Tool</h1>
            <div className="sub sans">Multifunction event project plans — single source of truth</div>
          </div>
        </div>
        <div className="chips sans">
          <div className="chip"><span className="dot"></span> Live · Supabase</div>
          <Link className="chip" href="/dossier-demo" style={{ textDecoration: 'none', cursor: 'pointer' }}>🗂 Client dossier (demo)</Link>
          <AuthBar />
          {!authed && <label className="chip" style={{ gap: 6 }}>Acting as
            <select value={user} onChange={e => setUser(e.target.value)} style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>
              {PEOPLE.map(p => <option key={p.name} value={p.name}>{p.name} ({p.role})</option>)}
            </select>
          </label>}
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
              <input type="date" value={evEnd} onChange={e => setEvEnd(e.target.value)} title="End date (optional — for multi-day events)" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)' }} />
              <input placeholder="City" value={evCity} onChange={e => setEvCity(e.target.value)} style={{ flex: 1, minWidth: 120, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
              <input placeholder="State" value={evState} onChange={e => setEvState(e.target.value)} style={{ width: 90, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
              <input placeholder="Venue (optional)" value={evVenue} onChange={e => setEvVenue(e.target.value)} style={{ flex: 1, minWidth: 140, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 7 }}>Activations happening at this event:</div>
            <ActivationChips value={evActs} options={actOpts} onChange={setEvActs} includeAllEvents={false} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
              <button className="btn" onClick={createEvent} disabled={creating}>{creating ? 'Building plan…' : 'Create event plan'}</button>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Name, date &amp; location required. Pulls every &ldquo;All events&rdquo; task plus the activations you pick. No AI needed.</span>
            </div>
          </div>

          {/* Optional: describe it to Claude */}
          <div className="card sans">
            <div className="subh">✨ Or describe it to Claude</div>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="Describe the event in one sentence…" style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
              <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} title="Event date" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }} />
              <input type="date" value={evEnd} onChange={e => setEvEnd(e.target.value)} title="End date (optional — for multi-day events)" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)' }} />
              <input placeholder="City" value={evCity} onChange={e => setEvCity(e.target.value)} style={{ flex: 1, minWidth: 120, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
              <input placeholder="State" value={evState} onChange={e => setEvState(e.target.value)} style={{ width: 90, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
              <input placeholder="Venue (optional)" value={evVenue} onChange={e => setEvVenue(e.target.value)} style={{ flex: 1, minWidth: 140, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <button className="btn ghost" onClick={generate} disabled={gen}>{gen ? 'Claude is building…' : 'Generate with Claude'}</button>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Description, date &amp; location required (needs the Anthropic key).</span>
            </div>
          </div>

          {/* Slack digests + manual reminders */}
          <div className="card sans">
            <div className="subh">📣 Slack digests &amp; reminders</div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 10 }}>Auto: personal DMs every Monday (this week) &amp; Friday (next week) at 11am ET — you &amp; Christina also get the full cross-event view. Push manually anytime:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn ghost sm" onClick={() => pushSlack('remind')}>⏰ Send day-before reminders</button>
              <button className="btn ghost sm" onClick={() => pushSlack('weekly')}>📅 Send this-week digest now</button>
              <button className="btn ghost sm" onClick={() => pushSlack('preview')}>👀 Send next-week preview now</button>
              {slackMsg && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{slackMsg}</span>}
            </div>
          </div>
        </>
      ) : (
        <div className="card sans" style={{ color: 'var(--faint)' }}>
          You have <b style={{ color: 'var(--ink)' }}>{roleOf(user)}</b> access — view everything, comment on any task, and update your own. Creating events is limited to Christina and Fernando.
        </div>
      )}

      <div className="tiles sans">
        <div className="tile accent"><div className="tnum">{currentIds.size}</div><div className="tlab">Active events</div></div>
        <div className="tile"><div className="tnum">{openTasks.length}</div><div className="tlab">Open tasks</div></div>
        <div className="tile warn"><div className="tnum">{overdueCount}</div><div className="tlab">Overdue</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '20px 0 4px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Instrument Sans, sans-serif', margin: 0 }}>Project plans</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setEventFilter('current')} style={{ fontSize: 12, borderRadius: 999, padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (eventFilter === 'current' ? 'var(--accent)' : 'var(--line)'), color: eventFilter === 'current' ? 'var(--accent)' : 'var(--muted)', background: eventFilter === 'current' ? '#eef3fb' : 'transparent', fontWeight: eventFilter === 'current' ? 700 : 400 }}>Current events</button>
          <button type="button" onClick={() => setEventFilter('past')} style={{ fontSize: 12, borderRadius: 999, padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (eventFilter === 'past' ? 'var(--accent)' : 'var(--line)'), color: eventFilter === 'past' ? 'var(--accent)' : 'var(--muted)', background: eventFilter === 'past' ? '#eef3fb' : 'transparent', fontWeight: eventFilter === 'past' ? 700 : 400 }}>Past events</button>
        </div>
      </div>

      {loading ? <div className="loading sans">Loading…</div> : (
        <div>
          {shownProjects.length === 0 && <div className="card sans" style={{ color: 'var(--faint)' }}>{eventFilter === 'current' ? 'No current events — create one above.' : 'No past events yet.'}</div>}
          {shownProjects.map(p => (
            <div key={p.id} className="card sans" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/project/${p.id}`} style={{ fontWeight: 600, fontSize: 15, fontFamily: 'Instrument Sans, sans-serif', color: 'var(--ink)', textDecoration: 'none' }}>{p.name}</Link>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.event_date ? fmtRange(p.event_date, p.event_end_date) : 'No date set'}{cityState(p) ? ` · ${cityState(p)}` : ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Venue</span>
                  {master
                    ? <input value={venueDraft[p.id] !== undefined ? venueDraft[p.id] : (p.venue || '')} onChange={e => setVenueDraft(d => ({ ...d, [p.id]: e.target.value }))} onBlur={() => saveVenue(p)} placeholder="TBD" style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)', minWidth: 130 }} />
                    : <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.venue || 'TBD'}</span>}
                </div>
                {p.activations && parseActs(p.activations).length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>{parseActs(p.activations).map(a => <span key={a} style={{ fontSize: 10.5, background: '#FFF6D6', border: '1px solid #D9A800', color: '#7a5e00', borderRadius: 999, padding: '2px 8px' }}>{a}</span>)}</div>}
              </div>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {master && <button className="btn ghost sm" onClick={e => deleteEvent(e, p)} style={{ color: '#b42318', borderColor: '#f0c4c0' }}>Delete</button>}
                <Link href={`/project/${p.id}`} className="btn ghost sm" style={{ textDecoration: 'none' }}>Open →</Link>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
